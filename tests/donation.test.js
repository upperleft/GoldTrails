import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {createBillingHandler} from '../app/billing/handler.js';
import {createPlusHandler} from '../app/plus/handler.js';

async function request(handler, path, {method='GET',headers={},body=[]}={}) {
 const req=Object.assign(Readable.from(body),{method,headers});
 let status,html;
 const res={
  writeHead(code){status=code;},
  end(content){html=content;},
 };
 assert.equal(await handler(req,res,new URL(path,'https://goldtrails.org')),true);
 return {status,html};
}

test('guests can choose a one-time tip amount at the configured Stripe Checkout',async()=>{
 for(const host of ['buy.stripe.com','donate.stripe.com']){
  const donationLink='https://'+host+'/aBc123DEF456';
  const {status,html}=await request(createPlusHandler({donationLink}),'/donate/');
  assert.equal(status,200);
  assert.ok(html.includes('<a class="gold-button" href="'+donationLink+'">Leave a one-time tip</a>'));
  assert.match(html,/Choose your amount in Stripe Checkout/);
  assert.match(html,/does not unlock Gold Trails Plus/);
  assert.match(html,/without a Gold Trails account/);
  assert.doesNotMatch(html,/disabled aria-describedby=/);
 }
});

test('blank and unsupported donation links leave checkout disabled',async()=>{
 const disabledLinks=[
  '',
  'https://buy.stripe.com/test_aBc123DEF456',
  'https://buy.stripe.com.example.invalid/aBc123DEF456',
  'https://buy.stripe.com@elsewhere.invalid/aBc123DEF456',
  'http://buy.stripe.com/aBc123DEF456',
  'https://buy.stripe.com/aBc123DEF456?amount=5',
  'https://donate.stripe.com/aBc123DEF456#extra',
 ];
 for(const donationLink of disabledLinks){
  const {status,html}=await request(createPlusHandler({donationLink}),'/donate/');
  assert.equal(status,200);
  assert.match(html,/disabled aria-describedby="donation-payment-status"/);
  assert.doesNotMatch(html,/href="[^"]*stripe\.com/);
 }
});

test('only well-formed signed one-time Checkout events bypass subscription processing',async()=>{
 const calls=[];
 const now=()=>new Date('2030-11-03T12:00:00Z');
 const timestamp=Math.floor(now().getTime()/1000);
 const webhookSecret='whsec_'+'y'.repeat(24);
 const handler=createBillingHandler({
  config:{livemode:true,stripeAccountId:'acct_fixture',webhookSecret},
  store:{
   ready:async()=>true,
   accountForCustomer:async()=>{calls.push('lookup');return '11111111-1111-4111-8111-111111111111';},
   applySubscription:async(event,load)=>{calls.push('apply');await load();},
   completeCheckout:async()=>{calls.push('complete');},
  },
  provider:{
   checkout:async()=>{calls.push('checkout');return {status:'complete',subscriptionId:'sub_fixture'};},
   snapshot:async()=>{calls.push('snapshot');return {};},
  },
  members:{},
  now,
 });
 const session={object:'checkout.session',id:'cs_live_tipFixture',mode:'payment',livemode:true,subscription:null};
 const send=async(object,{type='checkout.session.completed',signed=true}={})=>{
  const event={id:'evt_fixture',created:timestamp,livemode:true,type,data:{object}};
  const raw=Buffer.from(JSON.stringify(event));
  const signature=createHmac('sha256',webhookSecret).update(timestamp+'.').update(raw).digest('hex');
  const {status,html}=await request(handler,'/billing/webhook/',{
   method:'POST',
   headers:{'content-type':'application/json','stripe-signature':signed?'t='+timestamp+',v1='+signature:''},
   body:[raw],
  });
  return {status,body:JSON.parse(html)};
 };

 assert.deepEqual(await send({...session,customer:null}),{status:200,body:{received:true,ignored:true}});
 assert.deepEqual(await send({...session,customer:'cus_fixture'},{type:'checkout.session.async_payment_succeeded'}),{status:200,body:{received:true,ignored:true}});
 assert.deepEqual(await send({...session,customer:null},{type:'checkout.session.expired'}),{status:200,body:{received:true,ignored:true}});
 for(const invalid of [{object:'invoice'},{livemode:false},{id:'cs_test_tipFixture'},{subscription:'sub_fixture'}]){
  assert.deepEqual(await send({...session,...invalid}),{status:400,body:{error:'webhook_identity'}});
 }
 assert.deepEqual(await send(session,{signed:false}),{status:400,body:{error:'webhook_signature'}});
 assert.deepEqual(calls,[]);

 assert.deepEqual(await send({...session,mode:'subscription',customer:'cus_fixture',subscription:'sub_fixture'}),{status:200,body:{received:true}});
 assert.deepEqual(calls,['lookup','checkout','apply','snapshot','complete']);
});
