// Opt in only against an empty, independently migrated, socket-only test server.
// RUN_BILLING_DB_TESTS=true BILLING_DB_SOCKET=/private/tmp/goldtrails-billing-db-.../mysql.sock node --test tests/billing-mariadb.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import mariadb from 'mariadb';
import {createBillingStore} from '../app/billing/store.js';
import {createStripeProvider} from '../app/billing/provider.js';
import {createBillingHandler} from '../app/billing/handler.js';
import {createMemberStore} from '../app/member-store.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createServer} from '../app/server.js';

const socket=process.env.BILLING_DB_SOCKET||'';
const enabled=process.env.RUN_BILLING_DB_TESTS==='true'&&/^\/private\/tmp\/goldtrails-billing-db-[A-Za-z0-9_-]+\/mysql\.sock$/.test(socket);
test('isolated MariaDB billing identity, transactions, concurrency and entitlements',{skip:!enabled},async t=>{
 const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_billing_test',connectionLimit:6,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
 const config={stripeAccountId:'acct_fixture',livemode:true,priceId:'price_plus',now:()=>new Date('2030-11-03T12:00:00Z')};
 const store=createBillingStore(db,config),ids={owner:randomUUID(),member:randomUUID(),other:randomUUID(),creator:randomUUID(),restricted:randomUUID(),test:randomUUID(),checkout:randomUUID(),serial:randomUUID(),failure:randomUUID(),flow:randomUUID(),rejoin:randomUUID()};
 let seeded=false,eventNumber=0;
 t.after(async()=>{try{if(seeded){
  for(const table of ['billing_events','billing_checkout_attempts','billing_customers','member_audit_log','member_sessions','member_memberships','member_subscriptions'])await db.query('DELETE FROM '+table);
  await db.query('DELETE FROM member_accounts');
 }}finally{await db.end();}});
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'Never use an existing member database.');
 assert.equal(await store.ready(),true,'Apply migrations 001,004,016 to this isolated fixture.');seeded=true;
 for(const [name,id] of Object.entries(ids)){
  await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[id,'billing_'+name,name+'@example.invalid','x'.repeat(100)]);
  await db.query('INSERT INTO member_memberships(account_id) VALUES(?)',[id]);
  if(name!=='owner')await store.bindCustomer(id,'cus_'+name);
 }
 const snapshot=(name,extra={})=>({accountId:ids[name],stripeAccountId:config.stripeAccountId,livemode:true,customerId:'cus_'+name,subscriptionId:'sub_'+name,status:'active',priceId:'price_plus',quantity:1,currency:'usd',unitAmount:500,interval:'month',intervalCount:1,currentPeriodStart:'2030-11-01T00:00:00Z',currentPeriodEnd:'2030-12-01T00:00:00Z',cancelAtPeriodEnd:false,latestInvoicePaid:true,paidThrough:'2030-12-01T00:00:00Z',...extra});
 const event=(name,extra={})=>({accountId:ids[name],subscriptionId:'sub_'+name,eventId:'evt_'+(++eventNumber),eventType:'invoice.paid',eventCreated:1920000000+eventNumber,livemode:true,...extra});
 const member=async name=>(await db.query('SELECT * FROM member_memberships WHERE account_id=?',[ids[name]]))[0];
 await t.test('customer identities bind once and cannot cross accounts',async()=>{
  assert.deepEqual(await store.bindCustomer(ids.member,'cus_member'),{customerId:'cus_member',created:false});
  await assert.rejects(()=>store.bindCustomer(ids.member,'cus_replacement'),e=>e.code==='billing_identity');
  await assert.rejects(()=>store.bindCustomer(ids.owner,'cus_member'),e=>e.code==='billing_identity');
  assert.equal(await store.accountForCustomer('cus_member'),ids.member);
  assert.equal(await createBillingStore(db,{...config,stripeAccountId:'acct_other'}).accountForCustomer('cus_member'),null);
 });
 await t.test('simultaneous checkout starts share one attempt and never grant access',async()=>{
  const [first,second]=await Promise.all([store.reserveCheckout(ids.checkout),store.reserveCheckout(ids.checkout)]);assert.equal(first.id,second.id);assert.equal(first.idempotencyKey,second.idempotencyKey);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM billing_checkout_attempts WHERE account_id=?',[ids.checkout]))[0].n),1);
  await assert.rejects(()=>store.finishCheckout(ids.other,first.id,{sessionId:'cs_live_checkout',customerId:'cus_other',expiresAt:'2030-11-04T00:00:00Z'}),e=>e.code==='billing_identity');
  const open=await store.finishCheckout(ids.checkout,first.id,{sessionId:'cs_live_checkout',customerId:'cus_checkout',expiresAt:'2030-11-04T00:00:00Z'});assert.equal(open.status,'open');
  const retried=await store.reserveCheckout(ids.checkout);assert.equal(retried.providerSessionId,'cs_live_checkout');
  await store.completeCheckout(ids.checkout,'cs_live_checkout');assert.equal((await member('checkout')).level,'free');
  assert.deepEqual(await store.expireCheckout(ids.checkout,'cs_live_checkout'),{expired:false});
 });
 await t.test('a verified expired checkout permits retry; a time limit alone does not',async()=>{
  const attempt=await store.reserveCheckout(ids.other);
  await store.finishCheckout(ids.other,attempt.id,{sessionId:'cs_live_expired',customerId:'cus_other',expiresAt:'2030-11-04T00:00:00Z'});
  const later=createBillingStore(db,{...config,now:()=>new Date('2030-11-05T00:00:00Z')});
  await assert.rejects(()=>later.reserveCheckout(ids.other),e=>e.code==='checkout_unresolved');
  await later.expireCheckout(ids.other,'cs_live_expired');assert.notEqual((await later.reserveCheckout(ids.other)).id,attempt.id);
 });
 await t.test('paid authoritative subscription grants exactly its paid term without roles',async()=>{
  const result=await store.applySubscription(event('member'),async()=>snapshot('member'));assert.equal(result.membershipOutcome,'paid_access');
  const m=await member('member');assert.equal(m.grant_source,'payment');assert.equal(m.status,'active');assert.match(m.ends_at,/^2030-12-01 00:00:00/);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_role_grants WHERE account_id=?',[ids.member]))[0].n),0);
  const state=await store.billingState(ids.member);assert.equal(state.subscription.priceValid,true);assert.equal(state.customerId,'cus_member');
  await assert.rejects(()=>store.reserveCheckout(ids.member),e=>e.code==='subscription_exists');
 });
 await t.test('concurrent duplicate events are durable and skip the second provider fetch',async()=>{
  const same=event('member');let fetched=0;
  const results=await Promise.all([store.applySubscription(same,async()=>{fetched++;return snapshot('member');}),store.applySubscription(same,async()=>{fetched++;return snapshot('member');})]);
  assert.equal(fetched,1);assert.equal(results.filter(x=>x.duplicate).length,1);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM billing_events WHERE event_id=?',[same.eventId]))[0].n),1);
 });
 await t.test('an old event retrieves current provider truth and does not regress access',async()=>{
  await store.applySubscription(event('member',{eventCreated:1900000000}),async()=>snapshot('member',{currentPeriodStart:'2030-11-02T00:00:00Z',currentPeriodEnd:'2030-12-02T00:00:00Z',paidThrough:'2030-12-02T00:00:00Z'}));
  assert.match((await member('member')).ends_at,/^2030-12-02/);
  const saved=(await store.billingState(ids.member)).subscription;assert.equal(saved.paidThrough.toISOString(),'2030-12-02T00:00:00.000Z');
 });
 await t.test('unpaid snapshots cannot extend a previously confirmed paid-through',async()=>{
  await store.applySubscription(event('member'),async()=>snapshot('member',{latestInvoicePaid:false,paidThrough:'2031-01-01T00:00:00Z',currentPeriodEnd:'2031-01-01T00:00:00Z'}));
  assert.equal((await store.billingState(ids.member)).subscription.paidThrough.toISOString(),'2030-12-02T00:00:00.000Z');
  assert.match((await member('member')).ends_at,/^2030-12-02/);
 });
 await t.test('wrong customer, subscription, business account or mode rolls back before recording an event',async()=>{
  for(const extra of [{customerId:'cus_other'},{subscriptionId:'sub_other'},{stripeAccountId:'acct_other'},{livemode:false}]){
   const incoming=event('member');await assert.rejects(()=>store.applySubscription(incoming,async()=>snapshot('member',extra)),e=>e.code==='billing_identity');
   assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM billing_events WHERE event_id=?',[incoming.eventId]))[0].n),0);
  }
 });
 await t.test('wrong plan and unsupported states withdraw only the linked payment grant',async()=>{
  await store.applySubscription(event('member'),async()=>snapshot('member',{unitAmount:1000}));assert.equal((await member('member')).status,'expired');
  await store.applySubscription(event('member'),async()=>snapshot('member'));assert.equal((await member('member')).status,'active');
  for(const status of ['past_due','unpaid','incomplete','paused','trialing','unknown_provider_state']){
   await store.applySubscription(event('member'),async()=>snapshot('member',{status,latestInvoicePaid:false,paidThrough:null}));assert.equal((await member('member')).status,'expired');
  }
 });
 await t.test('creator complimentary grants survive payment, nonpayment and cancellation unchanged',async()=>{
  await db.query("UPDATE member_memberships SET level='subscriber',grant_source='complimentary',granted_by=?,ends_at=NULL WHERE account_id=?",[ids.owner,ids.creator]);
  const before=await member('creator');
  for(const status of ['active','past_due','canceled'])assert.equal((await store.applySubscription(event('creator'),async()=>snapshot('creator',{status}))).membershipOutcome,'complimentary_preserved');
  assert.deepEqual(await member('creator'),before);
  await assert.rejects(()=>store.reserveCheckout(ids.creator),e=>e.code==='billing_unavailable');
 });
 await t.test('suspended memberships and suspended or archived accounts cannot be revived',async()=>{
  await db.query("UPDATE member_memberships SET status='suspended' WHERE account_id=?",[ids.restricted]);
  assert.equal((await store.applySubscription(event('restricted'),async()=>snapshot('restricted'))).membershipOutcome,'membership_suspended');assert.equal((await member('restricted')).level,'free');
  await db.query("UPDATE member_memberships SET status='active' WHERE account_id=?",[ids.restricted]);
  await db.query("UPDATE member_accounts SET status='suspended' WHERE id=?",[ids.restricted]);
  assert.equal((await store.applySubscription(event('restricted'),async()=>snapshot('restricted'))).membershipOutcome,'account_restricted');
  await db.query("UPDATE member_accounts SET status='active',archived_at=UTC_TIMESTAMP(6) WHERE id=?",[ids.restricted]);
  assert.equal((await store.applySubscription(event('restricted'),async()=>snapshot('restricted'))).membershipOutcome,'account_restricted');assert.equal((await member('restricted')).level,'free');
 });
 await t.test('test-mode billing cannot change live membership or collide with a live event',async()=>{
  const testStore=createBillingStore(db,{...config,livemode:false});await testStore.bindCustomer(ids.test,'cus_test_mode');
  const incoming=event('test',{livemode:false,eventId:'evt_test_shared'});
  assert.equal((await testStore.applySubscription(incoming,async()=>snapshot('test',{livemode:false,customerId:'cus_test_mode'}))).membershipOutcome,'test_ignored');
  assert.equal((await member('test')).level,'free');assert.equal((await store.billingState(ids.test)).subscription,null);
  assert.equal((await store.applySubscription({...incoming,livemode:true},async()=>snapshot('test'))).membershipOutcome,'paid_access');
  await testStore.applySubscription(event('test',{livemode:false}),async()=>snapshot('test',{livemode:false,customerId:'cus_test_mode',status:'canceled'}));assert.equal((await member('test')).status,'active');
 });
 await t.test('fresh provider retrievals serialize after the account lock',async()=>{
  let active=0,maxActive=0,calls=0;
  const fetch=async()=>{active++;maxActive=Math.max(maxActive,active);const index=++calls;await new Promise(r=>setTimeout(r,30));active--;return snapshot('serial',index===1?{}:{status:'canceled'});};
  await Promise.all([store.applySubscription(event('serial'),fetch),store.applySubscription(event('serial'),fetch)]);
  assert.equal(maxActive,1);assert.equal((await store.billingState(ids.serial)).subscription.status,'canceled');assert.equal((await member('serial')).status,'expired');
 });
 await t.test('a different paid subscription cannot replace an existing grant',async()=>{
  await store.applySubscription(event('member'),async()=>snapshot('member'));
  const before=await member('member');
  const result=await store.applySubscription(event('member',{subscriptionId:'sub_duplicate'}),async()=>snapshot('member',{subscriptionId:'sub_duplicate'}));
  assert.equal(result.membershipOutcome,'other_subscription_preserved');assert.deepEqual(await member('member'),before);
 });
 await t.test('a former subscriber can rejoin only after terminal billing and the entire paid term have elapsed',async()=>{
  await store.applySubscription(event('rejoin'),async()=>snapshot('rejoin'));
  await store.applySubscription(event('rejoin'),async()=>snapshot('rejoin',{status:'canceled'}));
  assert.equal((await store.billingState(ids.rejoin)).canSubscribe,false);await assert.rejects(()=>store.reserveCheckout(ids.rejoin),e=>e.code==='subscription_exists');
  const later=createBillingStore(db,{...config,now:()=>new Date('2031-01-03T12:00:00Z')});assert.equal((await later.billingState(ids.rejoin)).canSubscribe,true);
  await later.reserveCheckout(ids.rejoin);const prior=(await member('rejoin')).subscription_id;
  const incoming=event('rejoin',{subscriptionId:'sub_rejoined'});
  const result=await later.applySubscription(incoming,async()=>snapshot('rejoin',{subscriptionId:'sub_rejoined',currentPeriodStart:'2031-01-01T00:00:00Z',currentPeriodEnd:'2031-02-01T00:00:00Z',paidThrough:'2031-02-01T00:00:00Z'}));
  assert.equal(result.membershipOutcome,'paid_access');assert.equal((await member('rejoin')).status,'active');assert.notEqual((await member('rejoin')).subscription_id,prior);
 });
 await t.test('late audit failure rolls back subscription, payment access and event together',async()=>{
  const failing={getConnection:async()=>{const c=await db.getConnection();return{beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:(sql,args)=>{if(sql.startsWith('INSERT INTO member_audit_log'))throw Error('isolated late audit failure');return c.query(sql,args);}};}};
  const incoming=event('failure');await assert.rejects(()=>createBillingStore(failing,config).applySubscription(incoming,async()=>snapshot('failure')),/isolated late audit failure/);
  assert.equal((await member('failure')).level,'free');assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_subscriptions WHERE account_id=?',[ids.failure]))[0].n),0);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM billing_events WHERE event_id=?',[incoming.eventId]))[0].n),0);
  assert.equal((await store.applySubscription(incoming,async()=>snapshot('failure'))).membershipOutcome,'paid_access','The exact event retries after rollback.');
 });
 await t.test('pause dates persist, reminders dedupe by exact resume date, and resume requires payment',async()=>{
  const pause={status:'paused',latestInvoicePaid:false,paidThrough:null,scheduleId:'sub_sched_fixture',pauseAt:'2030-11-01T00:00:00Z',resumeAt:'2030-11-08T00:00:00Z'};
  await store.applySubscription(event('member'),async()=>snapshot('member',pause));assert.equal((await member('member')).status,'expired');
  assert.ok((await store.duePauseReminders()).some(x=>x.accountId===ids.member));
  assert.deepEqual(await store.markPauseReminderSent(ids.member,'sub_member','2030-11-08T00:00:00Z'),{marked:true});
  assert.deepEqual(await store.markPauseReminderSent(ids.member,'sub_member','2030-11-08T00:00:00Z'),{marked:false});
  await store.applySubscription(event('member'),async()=>snapshot('member',pause));assert.equal((await store.duePauseReminders()).some(x=>x.accountId===ids.member),false);
  await store.reconcileSubscription({accountId:ids.member,subscriptionId:'sub_member'},async()=>snapshot('member',{...pause,resumeAt:'2030-11-09T00:00:00Z'}));assert.ok((await store.duePauseReminders()).some(x=>x.accountId===ids.member));
  await store.applySubscription(event('member'),async()=>snapshot('member',{status:'incomplete',latestInvoicePaid:false,paidThrough:null}));assert.equal((await member('member')).status,'expired');
  await store.applySubscription(event('member'),async()=>snapshot('member'));assert.equal((await member('member')).status,'active');
  await assert.rejects(()=>db.query("UPDATE member_subscriptions SET pause_at='2030-12-01 00:00:00',resume_at=NULL WHERE account_id=?",[ids.member]),e=>e.code==='ER_CONSTRAINT_FAILED','A half-configured pause is rejected by the actual database constraint.');
 });
 await t.test('HTTP checkout and signed webhook update real membership and gated Almanac access',async t=>{
  const start=Math.floor(Date.now()/1000)-3600,end=start+28*86400,csrf='a'.repeat(64),meta={goldtrails_app:'goldtrails',goldtrails_account_id:ids.flow};
  const settings={...config,now:()=>new Date(),enabled:true,origin:'https://goldtrails.org',secretKey:'sk_live_'+ 'x'.repeat(24),webhookSecret:'whsec_'+ 'y'.repeat(24),portalConfigurationId:'bpc_fixture'};
  const billingStore=createBillingStore(db,settings),sessions=createMemberStore(db,{billing:settings}),session=await sessions.login(ids.flow,0,csrf);
  let checkoutStatus='open',providerStatus='active',invoiceStatus='paid',cancelAtPeriodEnd=false;
  const subscription=()=>({id:'sub_flow',livemode:true,customer:'cus_flow',metadata:meta,status:providerStatus,cancel_at_period_end:cancelAtPeriodEnd,schedule:null,items:{data:[{id:'si_flow',current_period_start:start,current_period_end:end,quantity:1,price:{id:'price_plus',currency:'usd',unit_amount:500,recurring:{interval:'month',interval_count:1}}}]},latest_invoice:{id:'in_flow',object:'invoice',livemode:true,status:invoiceStatus,customer:'cus_flow',parent:{subscription_details:{subscription:'sub_flow'}},billing_reason:'subscription_create',currency:'usd',amount_paid:invoiceStatus==='paid'?500:0,amount_paid_off_stripe:0,amount_remaining:invoiceStatus==='paid'?0:500,status_transitions:{paid_at:start},lines:{has_more:false,data:[{amount:500,currency:'usd',quantity:1,pricing:{price_details:{price:'price_plus'}},parent:{subscription_item_details:{subscription:'sub_flow',subscription_item:'si_flow',proration:false}},period:{start,end}}]}}});
  const provider=createStripeProvider(settings,{fetchImpl:async(url,options)=>{
   const path=new URL(url).pathname;let data;
   if(path==='/v1/account')data={id:'acct_fixture',type:'standard',charges_enabled:true,details_submitted:true};
   else if(path==='/v1/prices/price_plus')data={id:'price_plus',livemode:true,active:true,type:'recurring',currency:'usd',unit_amount:500,recurring:{interval:'month',interval_count:1,usage_type:'licensed'},product:{active:true}};
   else if(path==='/v1/billing_portal/configurations/bpc_fixture')data={id:'bpc_fixture',livemode:true,active:true,features:{subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false},payment_method_update:{enabled:true}}};
   else if(path==='/v1/customers/cus_flow')data={id:'cus_flow',livemode:true,metadata:meta};
   else if(['/v1/checkout/sessions','/v1/checkout/sessions/cs_live_flow'].includes(path))data={id:'cs_live_flow',mode:'subscription',livemode:true,status:checkoutStatus,customer:'cus_flow',client_reference_id:ids.flow,metadata:meta,subscription:checkoutStatus==='complete'?'sub_flow':null,expires_at:Math.floor(Date.now()/1000)+3600,url:'https://checkout.stripe.com/c/pay/fixture'};
   else if(path==='/v1/subscriptions/sub_flow'){if(options.method==='POST')cancelAtPeriodEnd=true;data=subscription();}
   else throw Error('Unexpected fixture Stripe route');
   return new Response(JSON.stringify(data),{status:200});
  }});
  const members={...sessions,allow:async()=>true},billing=createBillingHandler({store:billingStore,members,provider,config:settings,log:()=>{}});
  const server=createServer({billing,guests:null,memberSessions:members,almanac:createAlmanacHandler({members,guests:null,store:async()=>({})}),goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const request=(path,init={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...init,headers:{Cookie:`__Host-gold-member=${session}; __Host-gold-form=${csrf}`,Origin:settings.origin,...init.headers}});
  const post=path=>request(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});
  const webhook=async type=>{const object=type.startsWith('checkout.')?{id:'cs_live_flow',livemode:true,customer:'cus_flow'}:subscription(),event={id:'evt_flow_'+(++eventNumber),livemode:true,created:Math.floor(Date.now()/1000),type,data:{object}},body=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000),signature=createHmac('sha256',settings.webhookSecret).update(timestamp+'.'+body).digest('hex');return request('/billing/webhook/',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':`t=${timestamp},v1=${signature}`},body});};
  assert.equal((await request('/api/gold-almanac/nevada/')).status,403);
  assert.equal((await post('/billing/subscribe/')).headers.get('location'),'https://checkout.stripe.com/c/pay/fixture');
  assert.equal((await sessions.session(session)).effective_level,'free');
  assert.equal((await request('/billing/return/?paid=true')).status,200);assert.equal((await sessions.session(session)).effective_level,'free');
  checkoutStatus='complete';assert.equal((await webhook('checkout.session.completed')).status,200);
  assert.equal((await sessions.session(session)).effective_level,'subscriber');assert.equal((await request('/api/gold-almanac/nevada/')).status,200);
  providerStatus='past_due';invoiceStatus='open';assert.equal((await webhook('customer.subscription.updated')).status,200);
  assert.equal((await sessions.session(session)).effective_level,'free');assert.equal((await request('/api/gold-almanac/nevada/')).status,403);
  providerStatus='active';invoiceStatus='paid';assert.equal((await webhook('customer.subscription.updated')).status,200);assert.equal((await sessions.session(session)).effective_level,'subscriber');
  assert.equal((await post('/billing/cancel/')).status,303);assert.equal((await billingStore.billingState(ids.flow)).subscription.cancelAtPeriodEnd,true);assert.equal((await sessions.session(session)).effective_level,'subscriber','Cancellation retains confirmed paid access.');
 });
 assert.ok((await store.listSubscriptions()).length>0);
});
