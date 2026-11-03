import test from 'node:test';
import assert from 'node:assert/strict';
import {BillingError,billingDate,eligiblePaidSnapshot,normalizeSubscriptionSnapshot,sqlDate,threeMonthPause} from '../app/billing/model.js';
import {createBillingStore} from '../app/billing/store.js';

const accountId='11111111-1111-4111-8111-111111111111';
const config={stripeAccountId:'acct_fixture',livemode:true,priceId:'price_plus',now:()=>new Date('2030-11-03T12:00:00.000Z')};
const snapshot=(extra={})=>({accountId,stripeAccountId:'acct_fixture',livemode:true,customerId:'cus_fixture',subscriptionId:'sub_fixture',status:'active',priceId:'price_plus',quantity:1,currency:'usd',unitAmount:500,interval:'month',intervalCount:1,currentPeriodStart:'2030-11-01T00:00:00Z',currentPeriodEnd:'2030-12-01T00:00:00Z',cancelAtPeriodEnd:false,latestInvoicePaid:true,paidThrough:'2030-12-01T00:00:00Z',...extra});
const failure=code=>error=>error instanceof BillingError&&error.code===code;

test('only the configured USD 5 monthly single-item price qualifies',()=>{
 const valid=normalizeSubscriptionSnapshot(snapshot(),config);assert.equal(valid.priceValid,true);assert.equal(eligiblePaidSnapshot(valid,config),true);
 for(const change of [{priceId:'price_other'},{quantity:2},{quantity:'1'},{currency:'cad'},{unitAmount:499},{interval:'year'},{intervalCount:2}]){
  const observed=normalizeSubscriptionSnapshot(snapshot(change),config);assert.equal(observed.priceValid,false);assert.equal(eligiblePaidSnapshot(observed,config),false);
 }
});
test('trials, paused, unpaid and unsupported provider states never qualify',()=>{
 for(const status of ['trialing','paused','past_due','unpaid','incomplete','incomplete_expired','canceled','future_status'])assert.equal(eligiblePaidSnapshot(normalizeSubscriptionSnapshot(snapshot({status}),config),config),false);
 assert.equal(normalizeSubscriptionSnapshot(snapshot({status:'future_status'}),config).status,'unknown');
 assert.equal(eligiblePaidSnapshot(normalizeSubscriptionSnapshot(snapshot({cancelAtPeriodEnd:true}),config),config),true,'Already-paid access lasts through its paid period.');
});
test('test mode cannot grant production Plus access',()=>{
 const testConfig={...config,livemode:false},normalized=normalizeSubscriptionSnapshot(snapshot({livemode:false}),testConfig);
 assert.equal(eligiblePaidSnapshot(normalized,testConfig),false);
 assert.equal(eligiblePaidSnapshot(normalized,{...testConfig,allowTestEntitlements:true}),true,'Explicit isolated test fixtures may opt in.');
 assert.throws(()=>normalizeSubscriptionSnapshot(snapshot({livemode:false}),config),failure('billing_identity'));
 assert.throws(()=>normalizeSubscriptionSnapshot(snapshot({stripeAccountId:'acct_other'}),config),failure('billing_identity'));
});
test('payment eligibility requires current service and independently confirmed paid-through',()=>{
 const unpaid=normalizeSubscriptionSnapshot(snapshot({latestInvoicePaid:false,paidThrough:null}),config);
 assert.equal(eligiblePaidSnapshot(unpaid,config),false);
 assert.equal(eligiblePaidSnapshot(unpaid,config,new Date('2030-12-01T00:00:00Z')),true,'A prior confirmed payment can retain its existing term.');
 for(const extra of [{paidThrough:'2030-11-02T00:00:00Z'},{currentPeriodStart:'2030-11-04T00:00:00Z'},{currentPeriodEnd:'2030-11-03T00:00:00Z',paidThrough:'2030-11-03T00:00:00Z'}])assert.equal(eligiblePaidSnapshot(normalizeSubscriptionSnapshot(snapshot(extra),config),config),false);
 assert.throws(()=>normalizeSubscriptionSnapshot(snapshot({paidThrough:'2031-01-01T00:00:00Z'}),config),failure('billing_input'));
});
test('date parsing is explicit UTC and rejects malformed provider dates',()=>{
 assert.equal(sqlDate('2030-11-03 12:34:56.123456'),'2030-11-03 12:34:56.123');
 assert.equal(billingDate(0).toISOString(),'1970-01-01T00:00:00.000Z');
 for(const invalid of ['November 3 2030','2030-11-03T12:00:00+08:00','2030-02-30T12:00:00Z','2030-11-03T24:00:00Z',NaN,-1,{},''])assert.throws(()=>billingDate(invalid,{nullable:false}),failure('billing_input'));
 assert.throws(()=>normalizeSubscriptionSnapshot(snapshot({currentPeriodStart:'2030-12-01T00:00:00Z'}),config),failure('billing_input'));
 assert.throws(()=>normalizeSubscriptionSnapshot(snapshot({latestInvoicePaid:'true'}),config),failure('billing_input'));
});
test('three-month service pause uses calendar months with month-end clamping',()=>{
 for(const [paid,resume] of [['2030-11-30T18:20:00Z','2031-02-28T18:20:00.000Z'],['2031-11-30T18:20:00Z','2032-02-29T18:20:00.000Z'],['2030-12-31T18:20:00Z','2031-03-31T18:20:00.000Z']]){
  const result=threeMonthPause(paid,{now:config.now});assert.equal(result.resumeAt.toISOString(),resume);assert.equal(result.pauseAt.toISOString(),billingDate(paid).toISOString());
 }
 assert.throws(()=>threeMonthPause('2030-11-02T00:00:00Z',{now:config.now}),failure('pause_unavailable'));
});
test('invalid billing inputs fail before a database connection is acquired',async()=>{
 const db={getConnection:()=>{throw Error('database must not be called');},query:()=>{throw Error('database must not be called');}};
 const store=createBillingStore(db,config);
 await assert.rejects(()=>store.bindCustomer('other','cus_fixture'),failure('billing_identity'));
 await assert.rejects(()=>store.reserveCheckout('other'),failure('billing_identity'));
 await assert.rejects(()=>store.finishCheckout(accountId,accountId,{sessionId:'cs_test_fixture',customerId:'cus_fixture',expiresAt:'2030-12-01T00:00:00Z'}),failure('billing_identity'));
 await assert.rejects(()=>store.applySubscription({accountId,subscriptionId:'sub_fixture',eventId:'evt_fixture',eventType:'invoice.paid',eventCreated:2030,livemode:false},async()=>snapshot()),failure('billing_identity'));
 await assert.rejects(()=>store.listSubscriptions(1001),failure('billing_input'));
 assert.throws(()=>createBillingStore(db,{...config,livemode:'true'}),failure('billing_configuration'));
});
