import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {digest} from '../app/admin-auth.js';
import {createServer} from '../app/server.js';
import {createBillingHandler} from '../app/billing/handler.js';
import {createPlusHandler} from '../app/plus/handler.js';

const accountId='11111111-1111-4111-8111-111111111111',csrf='a'.repeat(64),rawSession='b'.repeat(64),now=()=>new Date('2030-11-03T12:00:00Z');
const config={enabled:true,origin:'https://goldtrails.org',livemode:false,stripeAccountId:'acct_fixture',priceId:'price_plus',webhookSecret:'whsec_'+ 'y'.repeat(24),pauseEnabled:false};
async function fixture(t,overrides={}){
 const calls=[],member={id:accountId,email:'member@example.invalid',csrf_token_hash:digest(csrf),...overrides.member},state={account:{id:accountId,status:'active',email_verified_at:'2030-01-01',archived_at:null},membership:{grant_source:'free',status:'active'},customerId:'cus_fixture',subscription:null,subscriptions:[],checkout:null,...overrides.state};
 const store={ready:async()=>true,billingState:async()=>state,accountForCustomer:async customerId=>customerId==='cus_fixture'?accountId:null,reserveCheckout:async()=>{calls.push('reserve');return{id:accountId,customerId:'cus_fixture',idempotencyKey:'fixture'};},finishCheckout:async()=>{calls.push('finish');},completeCheckout:async()=>{calls.push('complete');},expireCheckout:async()=>{calls.push('expire');},bindCustomer:async()=>{calls.push('bind');},reconcileSubscription:async(ref,load)=>{calls.push('reconcile');await load();},applySubscription:async(event,load)=>{calls.push('apply');await load();},...overrides.store};
 const checkout={sessionId:'cs_test_fixture',customerId:'cus_fixture',status:'open',url:'https://checkout.stripe.com/c/pay/fixture',expiresAt:1919980800,...overrides.checkout};
 const provider={ensureReady:async()=>true,createCustomer:async()=>{calls.push('customer');return'cus_fixture';},createCheckout:async()=>{calls.push('create');return checkout;},checkout:async()=>{calls.push('checkout');return checkout;},snapshot:async()=>{calls.push('snapshot');return{};},portal:async()=>{calls.push('portal');return'https://billing.stripe.com/p/session/fixture';},cancelRenewal:async()=>{calls.push('cancel');},...overrides.provider};
 const billing=createBillingHandler({store,members:{session:async raw=>raw===rawSession?member:null,allow:async()=>true},provider,config:{...config,...overrides.config},invitations:overrides.invitations,now,log:()=>{}});
 let analytics=0;const server=createServer({billing,plus:createPlusHandler({billing}),guests:null,analytics:Object.assign(async()=>{analytics++;return false;},{enabled:async()=>false}),goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const request=(path,init={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...init,headers:{Cookie:`__Host-gold-member=${rawSession}; __Host-gold-form=${csrf}`,Origin:config.origin,...init.headers}});
 const post=(path,fields={csrf},headers={})=>request(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(fields)});
 const webhook=async(event,headers={})=>{const body=JSON.stringify(event,null,2),timestamp=Math.floor(now().getTime()/1000),signature=createHmac('sha256',config.webhookSecret).update(timestamp+'.'+body).digest('hex');return request('/billing/webhook/',{method:'POST',headers:{'Content-Type':'application/json','Stripe-Signature':`t=${timestamp},v1=${signature}`,...headers},body});};
 return{request,post,webhook,calls,state,analytics:()=>analytics};
}
const event=extra=>({id:'evt_fixture',created:1919980800,livemode:false,type:'customer.subscription.updated',data:{object:{id:'sub_fixture',customer:'cus_fixture',livemode:false}},...extra});
test('billing return and GET actions cannot create or confirm payments',async t=>{
 const f=await fixture(t);const r=await f.request('/billing/return/?session_id=cs_test_forged&paid=true');assert.equal(r.status,200);assert.deepEqual(f.calls,[]);assert.match(await r.text(),/once Stripe confirms/);
 for(const path of ['/billing/subscribe/','/billing/manage/','/billing/pause/','/billing/refresh/'])assert.equal((await f.request(path)).status,405);
 assert.deepEqual(f.calls,[]);assert.equal(f.analytics(),0,'Billing capabilities bypass analytics and public wrappers.');
});
test('billing overview clearly separates free, paid and complimentary membership without changing billing',async t=>{
 const free=await fixture(t),freeResponse=await free.request('/billing/'),freeHtml=await freeResponse.text();
 assert.equal(freeResponse.status,200);assert.match(freeHtml,/<h2>Membership &amp; billing<\/h2>/);
 assert.match(freeHtml,/You’re currently a free member\. You don’t have a paid Plus subscription\./);
 assert.match(freeHtml,/Upgrade to Gold Trails Plus/);assert.match(freeHtml,/\$5 USD per month, renewing automatically until canceled/);
 assert.match(freeHtml,/action="\/billing\/subscribe\/"/);assert.deepEqual(free.calls,[]);
 const ineligible=await fixture(t,{state:{subscription:null,canSubscribe:false}}),ineligibleResponse=await ineligible.request('/billing/'),ineligibleHtml=await ineligibleResponse.text();
 assert.equal(ineligibleResponse.status,200);assert.doesNotMatch(ineligibleHtml,/action="\/billing\/subscribe\/"/);assert.deepEqual(ineligible.calls,[]);
 const subscription={id:accountId,subscriptionId:'sub_fixture',status:'active',paidThrough:new Date('2030-12-03T12:00:00Z')};
 const paid=await fixture(t,{state:{membership:{grant_source:'payment',status:'active',subscription_id:accountId},subscription,canSubscribe:false}}),paidResponse=await paid.request('/billing/'),paidHtml=await paidResponse.text();
 assert.equal(paidResponse.status,200);assert.match(paidHtml,/<h2>Membership &amp; billing<\/h2>/);
 assert.match(paidHtml,/Status: <strong>active<\/strong>/);assert.match(paidHtml,/Confirmed paid through 2030-12-03 \(UTC\)/);
 assert.doesNotMatch(paidHtml,/currently a free member|Upgrade to Gold Trails Plus|action="\/billing\/subscribe\/"/);assert.deepEqual(paid.calls,[]);
 const unconfirmed=await fixture(t,{state:{subscription:{...subscription,paidThrough:null},canSubscribe:false}}),unconfirmedHtml=await(await unconfirmed.request('/billing/')).text();
 assert.match(unconfirmedHtml,/Status: <strong>active<\/strong>/);assert.doesNotMatch(unconfirmedHtml,/Confirmed paid through/);assert.deepEqual(unconfirmed.calls,[]);
 const creator=await fixture(t,{state:{membership:{grant_source:'complimentary',status:'active'},canSubscribe:true}}),creatorResponse=await creator.request('/billing/'),creatorHtml=await creatorResponse.text();
 assert.equal(creatorResponse.status,200);assert.match(creatorHtml,/<h2>Membership &amp; billing<\/h2>/);
 assert.match(creatorHtml,/Your creator access is complimentary\. No subscription fee or card is required\./);
 assert.doesNotMatch(creatorHtml,/currently a free member|Upgrade to Gold Trails Plus|action="\/billing\/subscribe\/"/);assert.deepEqual(creator.calls,[]);
});
test('subscribe requires authenticated session, exact Origin, double CSRF and fixed server fields',async t=>{
 const f=await fixture(t);
 const unsigned=await f.post('/billing/subscribe/',{csrf},{Cookie:''});assert.equal(unsigned.status,401);assert.match(await unsigned.text(),/mailto:paul@goldtrails\.org/);
 assert.equal((await f.post('/billing/subscribe/',{csrf},{Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await f.post('/billing/subscribe/',{csrf:'c'.repeat(64)})).status,403);
 assert.equal((await f.post('/billing/subscribe/',{csrf,priceId:'price_other'})).status,400);assert.deepEqual(f.calls,[]);
 const r=await f.post('/billing/subscribe/');assert.equal(r.status,303);assert.equal(r.headers.get('location'),'https://checkout.stripe.com/c/pay/fixture');assert.deepEqual(f.calls,['reserve','create','checkout','finish','checkout']);
});
test('billing form policy permits hosted Stripe redirects while keeping other origins blocked',async t=>{
 const f=await fixture(t),overview=await f.request('/billing/');
 const policy=overview.headers.get('content-security-policy'),directives=new Map(policy.split(';').map(value=>value.trim().split(/\s+/)).filter(parts=>parts[0]).map(([name,...sources])=>[name,sources]));
 const sources=directives.get('form-action');
 assert.deepEqual(new Set(sources),new Set(["'self'",'https://checkout.stripe.com','https://billing.stripe.com']));
 assert.deepEqual(directives.get('default-src'),["'self'"]);assert.deepEqual(directives.get('script-src'),["'self'"]);assert.deepEqual(directives.get('frame-ancestors'),["'none'"]);assert.deepEqual(directives.get('base-uri'),["'none'"]);
 for(const path of ['/billing/subscribe/','/billing/manage/']){
  const response=await f.post(path);assert.equal(response.status,303);
  assert.ok(sources.includes(new URL(response.headers.get('location')).origin),'The form policy must allow the actual hosted redirect destination.');
  assert.equal(response.headers.get('content-security-policy'),policy);
 }
 for(const origin of ['https://attacker.invalid','https://checkout.stripe.com.attacker.invalid','https://untrusted.stripe.com','http://checkout.stripe.com','https://billing.stripe.com:8443'])assert.equal(sources.includes(origin),false);
});
test('complimentary creators and pending invitation holders are kept out of paid checkout',async t=>{
 const creator=await fixture(t,{state:{membership:{grant_source:'complimentary',status:'active'}}});assert.equal((await creator.post('/billing/subscribe/')).status,409);assert.deepEqual(creator.calls,[]);
 const pending=await fixture(t,{invitations:{ready:async()=>true,read:async()=>({})}});assert.equal((await pending.post('/billing/subscribe/',{csrf},{Cookie:`__Host-gold-member=${rawSession}; __Host-gold-form=${csrf}; __Host-gold-creator-invite=${'d'.repeat(64)}`})).status,409);assert.deepEqual(pending.calls,[]);
});
test('a completed checkout reconciles its subscription before releasing the creator-conversion guard',async t=>{
 const f=await fixture(t,{checkout:{status:'complete',subscriptionId:'sub_fixture'}});assert.equal((await f.post('/billing/subscribe/')).status,303);assert.deepEqual(f.calls,['reserve','create','checkout','finish','checkout','reconcile','snapshot','complete']);
 const missing=await fixture(t,{checkout:{status:'complete',subscriptionId:null}});assert.equal((await missing.post('/billing/subscribe/')).status,409);assert.equal(missing.calls.includes('complete'),false);
});
test('signed Stripe webhooks are raw-body verified and current state is loaded through the store callback',async t=>{
 const f=await fixture(t);assert.equal((await f.webhook(event())).status,200);assert.deepEqual(f.calls,['apply','snapshot']);assert.equal(f.analytics(),0);
 const bad=await fixture(t);assert.equal((await bad.webhook(event(),{'Stripe-Signature':'t=1919980800,v1='+ '0'.repeat(64)})).status,400);assert.deepEqual(bad.calls,[]);
 for(const extra of [{livemode:true},{account:'acct_other'}])assert.equal((await bad.webhook(event(extra))).status,400);assert.deepEqual(bad.calls,[]);
});
test('webhook checkout completion reconciles before completed; unrelated customer or event is ignored',async t=>{
 const f=await fixture(t,{checkout:{status:'complete',subscriptionId:'sub_fixture'}});assert.equal((await f.webhook(event({type:'checkout.session.completed',data:{object:{id:'cs_test_fixture',customer:'cus_fixture',livemode:false}}}))).status,200);assert.deepEqual(f.calls,['checkout','apply','snapshot','complete']);
 const ignored=await fixture(t);assert.equal((await ignored.webhook(event({type:'product.updated'}))).status,200);assert.equal((await ignored.webhook(event({data:{object:{id:'sub_other',customer:'cus_unknown',livemode:false}}}))).status,200);assert.deepEqual(ignored.calls,[]);
});
test('checkout maintenance disables purchases without disabling webhook updates or cancellation',async t=>{
 const f=await fixture(t,{config:{enabled:false}});assert.equal((await f.post('/billing/subscribe/')).status,503);assert.equal((await f.webhook(event())).status,200);assert.equal((await f.post('/billing/manage/')).status,303);assert.deepEqual(f.calls,['apply','snapshot','portal']);
});
test('direct cancellation executes under the store lock and still works for a suspended membership',async t=>{
 const f=await fixture(t,{config:{enabled:false},state:{membership:{grant_source:'payment',status:'suspended'},subscription:{id:'local',subscriptionId:'sub_fixture',status:'active'}}});
 assert.equal((await f.request('/billing/cancel/')).status,405);assert.equal((await f.post('/billing/cancel/')).status,303);assert.deepEqual(f.calls,['reconcile','cancel','snapshot']);
});
test('suspended Plus retains read, portal, cancellation and refresh while purchase and pause stay blocked',async t=>{
 const subscription={id:accountId,subscriptionId:'sub_fixture',status:'active'},membership={grant_source:'payment',status:'suspended',subscription_id:accountId};
 const f=await fixture(t,{config:{pauseEnabled:true},state:{membership,subscription,subscriptions:[subscription]}});
 const before=structuredClone(membership),overview=await f.request('/billing/'),html=await overview.text();assert.equal(overview.status,200);assert.match(html,/Your Plus access is suspended/);assert.match(html,/action="\/billing\/manage\/"/);assert.match(html,/action="\/billing\/cancel\/"/);assert.match(html,/action="\/billing\/refresh\/"/);assert.doesNotMatch(html,/action="\/billing\/(?:subscribe|pause)\/"/);
 assert.equal((await f.post('/billing/subscribe/')).status,409);assert.equal((await f.post('/billing/pause/')).status,409);assert.deepEqual(f.calls,[]);
 assert.equal((await f.post('/billing/manage/')).status,303);assert.equal((await f.post('/billing/cancel/')).status,303);assert.equal((await f.post('/billing/refresh/')).status,303);assert.deepEqual(f.calls,['portal','reconcile','cancel','snapshot','reconcile','snapshot']);assert.deepEqual(f.state.membership,before);
 const offer=await(await f.request('/plus/')).text();assert.doesNotMatch(offer,/action="\/billing\/subscribe\/"/);
});
test('missing account authentication provides billing support without exposing data or enabling cancellation',async t=>{
 const f=await fixture(t);
 for(const [path,init]of [['/billing/',{headers:{Cookie:''}}],['/billing/cancel/',{method:'POST',headers:{Cookie:'','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})}]]){
  const response=await f.request(path,init),html=await response.text();assert.equal(response.status,401);assert.match(html,/mailto:paul@goldtrails\.org/);assert.match(html,/href="\/login\/\?next=%2Fplus%2F"/);assert.doesNotMatch(html,/cus_fixture|sub_fixture|fixture-checkout-key/);
 }
 assert.deepEqual(f.calls,[]);
});
test('webhook content type and body limits reject invalid input before provider or membership changes',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/billing/webhook/',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
 assert.equal((await f.request('/billing/webhook/',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(1024*1024+1)})).status,413);assert.deepEqual(f.calls,[]);
});
test('enabled Plus renders a real authenticated form and keeps complimentary access free',async t=>{
 const f=await fixture(t);const r=await f.request('/plus/'),html=await r.text();assert.equal(r.status,200);assert.match(html,/action="\/billing\/subscribe\/"/);assert.doesNotMatch(html,/Payments are disabled/);
 const creator=await fixture(t,{member:{effective_level:'subscriber',grant_source:'complimentary'},state:{membership:{grant_source:'complimentary',status:'active'}}});const complimentary=await(await creator.request('/plus/')).text();assert.match(complimentary,/Your Plus access is complimentary/);assert.doesNotMatch(complimentary,/action="\/billing\/subscribe\/"/);
});
