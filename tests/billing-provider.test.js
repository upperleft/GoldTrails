import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {billingScope,stripeConfig} from '../app/billing/config.js';
import {confirmedInvoice,createStripeProvider,stripeRedirect,stripeVersion,verifyStripeSignature} from '../app/billing/provider.js';

const accountId='11111111-1111-4111-8111-111111111111';
const env={BILLING_ENABLED:'true',STRIPE_MODE:'test',STRIPE_ACCOUNT_ID:'acct_fixture',STRIPE_SECRET_KEY:'sk_test_'+ 'x'.repeat(24),STRIPE_WEBHOOK_SECRET:'whsec_'+ 'y'.repeat(24),STRIPE_PRICE_ID:'price_plus',STRIPE_PORTAL_CONFIGURATION_ID:'bpc_fixture',MEMBER_ORIGIN:'https://goldtrails.org',STRIPE_SERVICE_PAUSE_ENABLED:'true'};
const config=stripeConfig(env),now=()=>new Date('2030-11-03T12:00:00Z');
const meta={goldtrails_app:'goldtrails',goldtrails_account_id:accountId};
const unix=value=>Math.floor(new Date(value).getTime()/1000);
function objects(){
 const item={id:'si_fixture',quantity:1,current_period_start:unix('2030-11-01T00:00:00Z'),current_period_end:unix('2030-12-01T00:00:00Z'),price:{id:'price_plus',unit_amount:500,currency:'usd',recurring:{interval:'month',interval_count:1}}};
 const invoice={id:'in_fixture',object:'invoice',livemode:false,status:'paid',customer:'cus_fixture',parent:{subscription_details:{subscription:'sub_fixture'}},billing_reason:'subscription_cycle',currency:'usd',amount_paid:500,amount_paid_off_stripe:0,amount_remaining:0,status_transitions:{paid_at:unix('2030-11-01T00:00:00Z')},total_discount_amounts:[],lines:{has_more:false,data:[{amount:500,currency:'usd',quantity:1,pricing:{price_details:{price:'price_plus'}},parent:{subscription_item_details:{subscription:'sub_fixture',subscription_item:'si_fixture',proration:false}},period:{start:item.current_period_start,end:item.current_period_end},discount_amounts:[],pretax_credit_amounts:[]}]}};
 const sub={id:'sub_fixture',object:'subscription',livemode:false,customer:'cus_fixture',status:'active',metadata:meta,items:{data:[item]},latest_invoice:invoice,schedule:null,cancel_at_period_end:false,billing_mode:{type:'flexible'},collection_method:'charge_automatically'};
 return{item,invoice,sub};
}
function fixture(overrides={}){
 const data=objects(),calls=[];
 const responses={account:{id:'acct_fixture',type:'standard',charges_enabled:true,details_submitted:true},price:{id:'price_plus',livemode:false,active:true,type:'recurring',currency:'usd',unit_amount:500,recurring:{interval:'month',interval_count:1,usage_type:'licensed'},product:{active:true}},portal:{id:'bpc_fixture',livemode:false,active:true,features:{subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false},payment_method_update:{enabled:true}}},...overrides};
 const fetchImpl=async(url,options)=>{
  const parsed=new URL(url),fields=new URLSearchParams(options.body||'');calls.push({url:parsed,options,fields});let result;
  if(parsed.pathname==='/v1/account')result=responses.account;
  else if(parsed.pathname==='/v1/prices/price_plus')result=responses.price;
  else if(parsed.pathname==='/v1/billing_portal/configurations/bpc_fixture')result=responses.portal;
  else if(parsed.pathname==='/v1/customers/cus_fixture'||parsed.pathname==='/v1/customers')result={id:'cus_fixture',livemode:false,metadata:meta};
  else if(parsed.pathname==='/v1/subscriptions/sub_fixture'){
   if(options.method==='POST')data.sub.cancel_at_period_end=true;
   if(options.method==='DELETE')data.sub.status='canceled';
   result=responses.sub||data.sub;
  }
  else if(parsed.pathname==='/v1/checkout/sessions')result={id:'cs_test_fixture',livemode:false,status:'open',mode:'subscription',customer:'cus_fixture',client_reference_id:accountId,metadata:meta,expires_at:unix('2030-11-04T00:00:00Z'),url:'https://checkout.stripe.com/c/pay/fixture'};
  else if(parsed.pathname==='/v1/billing_portal/sessions')result={customer:'cus_fixture',url:'https://billing.stripe.com/p/session/fixture'};
  else if(parsed.pathname==='/v1/subscription_schedules')result={id:'sub_sched_fixture',livemode:false,customer:'cus_fixture',subscription:'sub_fixture',pause_schedules:[{pause:{pause_at:Number(fields.get('pause_schedules[0][pause][pause_at][timestamp]'))},resume:{resume_at:Number(fields.get('pause_schedules[0][resume][resume_at][timestamp]'))}}]};
  else if(parsed.pathname==='/v1/subscription_schedules/sub_sched_fixture/release'){data.sub.schedule=null;result={id:'sub_sched_fixture',livemode:false,status:'released',released_subscription:'sub_fixture'};}
  else throw Error('Unexpected API route');
  return new Response(JSON.stringify(result),{status:200});
 };
 return{provider:createStripeProvider(overrides.config||config,{fetchImpl,now}),calls,data,responses};
}
test('configuration fails closed and maintenance preserves a separately validated billing scope',()=>{
 assert.equal(stripeConfig({}),null);assert.equal(billingScope(env).livemode,false);
 const maintenance=stripeConfig({...env,BILLING_ENABLED:'false'});assert.equal(maintenance.enabled,false);assert.equal(maintenance.priceId,'price_plus');
 for(const change of [{STRIPE_MODE:'live'},{MEMBER_ORIGIN:'https://attacker.invalid'},{STRIPE_PORTAL_CONFIGURATION_ID:''},{STRIPE_PRICE_ID:'other'},{STRIPE_WEBHOOK_SECRET:'wrong'}])assert.throws(()=>stripeConfig({...env,...change}),e=>e.code==='billing_configuration');
 assert.equal('secretKey' in billingScope(env),false);
});
test('signature checks exact bytes, timestamp tolerance, multiple rotation signatures and duplicate timestamps',()=>{
 const raw=Buffer.from('{"test": 1}\n'),timestamp=unix(now()),signature=createHmac('sha256',config.webhookSecret).update(timestamp+'.').update(raw).digest('hex');
 verifyStripeSignature(raw,`t=${timestamp},v1=${'a'.repeat(64)},v1=${signature}`,config.webhookSecret,{now});
 for(const [body,header]of [[Buffer.from('{"test":1}'),`t=${timestamp},v1=${signature}`],[raw,`t=${timestamp-301},v1=${signature}`],[raw,`t=${timestamp},t=${timestamp},v1=${signature}`],[raw,`t=${timestamp+301},v1=${signature}`]])assert.throws(()=>verifyStripeSignature(body,header,config.webhookSecret,{now}),e=>e.code==='webhook_signature');
});
test('all requests pin Endive on the fixed Stripe API and checkout has a single fixed monthly price',async()=>{
 const {provider,calls}=fixture();assert.equal(await provider.createCustomer({id:accountId,email:'member@example.invalid'}),'cus_fixture');
 const attempt={id:accountId,customerId:'cus_fixture',idempotencyKey:'fixture-checkout-key'};
 const session=await provider.createCheckout(accountId,attempt);assert.equal(session.sessionId,'cs_test_fixture');
 for(const call of calls){assert.equal(call.url.origin,'https://api.stripe.com');assert.equal(call.options.headers['Stripe-Version'],stripeVersion);assert.equal(call.options.redirect,'error');}
 const checkout=calls.find(c=>c.url.pathname==='/v1/checkout/sessions');assert.equal(checkout.fields.get('line_items[0][price]'),'price_plus');assert.equal(checkout.fields.get('line_items[0][quantity]'),'1');assert.equal(checkout.fields.get('allow_promotion_codes'),'false');assert.equal(checkout.fields.get('subscription_data[billing_mode][type]'),'flexible');assert.equal(checkout.fields.get('success_url'),'https://goldtrails.org/billing/return/');assert.equal(checkout.options.headers['Idempotency-Key'],attempt.idempotencyKey);assert.equal([...checkout.fields.keys()].some(k=>/trial|coupon|amount/.test(k)),false);
});
test('readiness blocks Express, wrong prices, wrong mode and unsafe portal settings before provider writes',async()=>{
 for(const change of [{account:{id:'acct_fixture',type:'express'}},{price:{id:'price_plus',unit_amount:5000}},{portal:{id:'bpc_fixture',active:true,livemode:true}}]){
  const {provider,calls}=fixture(change);await assert.rejects(()=>provider.createCustomer({id:accountId,email:'member@example.invalid'}),e=>e.code==='billing_configuration');assert.equal(calls.some(c=>c.options.method==='POST'),false);
 }
});
test('only a fully paid, matching invoice line proves the service period',()=>{
 const {sub,item,invoice}=objects();assert.equal(confirmedInvoice(invoice,sub,item,config),true);
 for(const extra of [{amount_paid:0},{amount_paid_off_stripe:500},{currency:'cad'},{status:'open'},{billing_reason:'manual'},{total_discount_amounts:[{amount:500}]},{parent:{subscription_details:{subscription:'sub_other'}}}])assert.equal(confirmedInvoice({...invoice,...extra},sub,item,config),false);
 const altered=structuredClone(invoice);altered.lines.data[0].period.end++;assert.equal(confirmedInvoice(altered,sub,item,config),false);
 const proration=structuredClone(invoice);proration.lines.data[0].parent.subscription_item_details.proration=true;assert.equal(confirmedInvoice(proration,sub,item,config),false);
});
test('subscription snapshot uses item periods and refuses customer or metadata reassignment',async()=>{
 const f=fixture(),snapshot=await f.provider.snapshot('sub_fixture',accountId,'cus_fixture');assert.equal(snapshot.latestInvoicePaid,true);assert.equal(snapshot.paidThrough,f.data.item.current_period_end);assert.equal(snapshot.priceId,'price_plus');
 assert.ok(f.calls.find(c=>c.url.pathname==='/v1/subscriptions/sub_fixture').url.searchParams.toString().includes('amount_paid_off_stripe'));
 f.responses.sub={...f.data.sub,customer:'cus_other'};await assert.rejects(()=>f.provider.snapshot('sub_fixture',accountId,'cus_fixture'),e=>e.code==='billing_identity');
});
test('maintenance disables new purchases while cancellation portal and authoritative reads still work',async()=>{
 const {provider}=fixture({config:{...config,enabled:false}});
 await assert.rejects(()=>provider.createCustomer({id:accountId,email:'member@example.invalid'}),e=>e.code==='stripe_unavailable');
 assert.equal((await provider.snapshot('sub_fixture',accountId,'cus_fixture')).status,'active');assert.equal(await provider.portal(accountId,'cus_fixture'),'https://billing.stripe.com/p/session/fixture');
});
test('three-month pause uses true service scheduling at paid period end and resumes only after payment',async()=>{
 const {provider,calls}=fixture();const dates=await provider.schedulePause(accountId,'cus_fixture','sub_fixture','2030-12-01T00:00:00Z');assert.equal(dates.resumeAt.toISOString(),'2031-03-01T00:00:00.000Z');
 const schedule=calls.find(c=>c.url.pathname==='/v1/subscription_schedules');assert.equal(schedule.fields.get('from_subscription'),'sub_fixture');assert.equal(schedule.fields.get('pause_schedules[0][resume][settings][payment_behavior]'),'resume_on_payment_success');assert.equal(schedule.fields.get('pause_schedules[0][resume][settings][billing_cycle_anchor]'),'resume_at');assert.equal([...schedule.fields.keys()].some(k=>k.includes('pause_collection')),false);
});
test('scheduled pause cancellation releases the schedule then retains the paid active term',async()=>{
 const f=fixture({config:{...config,enabled:false}});f.data.sub.schedule={id:'sub_sched_fixture'};
 await f.provider.cancelRenewal(accountId,'cus_fixture','sub_fixture');
 const mutations=f.calls.filter(c=>c.options.method!=='GET');assert.deepEqual(mutations.map(c=>c.url.pathname),['/v1/subscription_schedules/sub_sched_fixture/release','/v1/subscriptions/sub_fixture']);
 assert.equal(mutations[1].fields.get('cancel_at_period_end'),'true');assert.equal(mutations[1].fields.get('proration_behavior'),'none');assert.equal(f.data.sub.status,'active');assert.equal(f.data.sub.cancel_at_period_end,true);
});
test('canceling an already paused subscription removes automatic resume without a final charge',async()=>{
 const f=fixture();f.data.sub.status='paused';f.data.sub.schedule={id:'sub_sched_fixture'};
 await f.provider.cancelRenewal(accountId,'cus_fixture','sub_fixture');const cancel=f.calls.find(c=>c.options.method==='DELETE');assert.equal(cancel.fields.get('invoice_now'),'false');assert.equal(cancel.fields.get('prorate'),'false');assert.equal(f.data.sub.status,'canceled');
});
test('Stripe redirects permit only the exact hosted HTTPS origin',()=>{
 for(const value of ['https://checkout.stripe.com.attacker.invalid/','http://checkout.stripe.com/','https://user@checkout.stripe.com/','https://billing.stripe.com/','https://checkout.stripe.com:8443/'])assert.throws(()=>stripeRedirect(value,'checkout'),e=>e.code==='stripe_unavailable');
});
