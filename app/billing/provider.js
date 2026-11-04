import {createHmac,timingSafeEqual} from 'node:crypto';
import {BillingError,billingDate,billingId,stripeId,threeMonthPause} from './model.js';

export const stripeVersion='2026-10-28.endive';
const unavailable=()=>new BillingError('stripe_unavailable','Secure billing is temporarily unavailable. Please try again shortly.',503);
const identity=()=>new BillingError('billing_identity','The billing account could not be verified.',409);
const id=value=>typeof value==='string'?value:value?.id;
const metadata=(object,accountId)=>object?.metadata?.goldtrails_app==='goldtrails'&&object.metadata.goldtrails_account_id===accountId;
const cancellationAt=sub=>Number.isSafeInteger(sub.cancel_at)&&sub.cancel_at>0?sub.cancel_at:null;
function encode(values){const fields=new URLSearchParams();const add=(key,value)=>{if(value===undefined||value===null)return;if(Array.isArray(value))value.forEach((v,i)=>add(`${key}[${i}]`,v));else if(typeof value==='object')for(const [k,v] of Object.entries(value))add(key?`${key}[${k}]`:k,v);else fields.append(key,String(value));};for(const [k,v]of Object.entries(values||{}))add(k,v);return fields;}
export function stripeRedirect(value,kind){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname!==(kind==='portal'?'billing.stripe.com':'checkout.stripe.com'))throw Error();return url.href;}catch{throw unavailable();}
}
export function verifyStripeSignature(raw,header,secret,{now=()=>new Date(),tolerance=300}={}){
 if(!Buffer.isBuffer(raw)||typeof header!=='string'||header.length>2048||!/^whsec_[A-Za-z0-9]{16,240}$/.test(secret||''))throw new BillingError('webhook_signature','Invalid webhook signature.',400);
 const parts=header.split(',').map(part=>part.trim().split('=')),timestamps=parts.filter(([k])=>k==='t'),signatures=parts.filter(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v||''));
 const timestamp=timestamps[0]?.[1];
 if(timestamps.length!==1||!/^\d{1,12}$/.test(timestamp||'')||Math.abs(Math.floor(billingDate(now(),{nullable:false}).getTime()/1000)-Number(timestamp))>tolerance||!signatures.length)throw new BillingError('webhook_signature','Invalid webhook signature.',400);
 const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
 if(!signatures.some(([,signature])=>timingSafeEqual(expected,Buffer.from(signature,'hex'))))throw new BillingError('webhook_signature','Invalid webhook signature.',400);
}

// Receipts must prove a full paid monthly service period. Zero-value invoices,
// discounts, prorations and manually marked outside payments do not extend access.
export function confirmedInvoice(invoice,subscription,item,config){
 const lines=invoice?.lines;
 if(!invoice||invoice.object!=='invoice'||invoice.livemode!==config.livemode||invoice.status!=='paid'||id(invoice.customer)!==id(subscription.customer)||id(invoice.parent?.subscription_details?.subscription)!==subscription.id||!['subscription_create','subscription_cycle','subscription_update'].includes(invoice.billing_reason)||invoice.currency!=='usd'||!Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<500||invoice.amount_remaining!==0||invoice.amount_paid_off_stripe!==0||invoice.paid_out_of_band===true||!Number.isSafeInteger(invoice.status_transitions?.paid_at)||!lines||lines.has_more||lines.data?.length!==1||(invoice.total_discount_amounts||[]).some(x=>x.amount!==0))return false;
 const line=lines.data[0],details=line.parent?.subscription_item_details;
 return line.currency==='usd'&&line.amount===500&&line.quantity===1&&line.pricing?.price_details?.price===config.priceId&&id(details?.subscription)===subscription.id&&id(details?.subscription_item)===item.id&&details?.proration===false&&line.period?.start===item.current_period_start&&line.period?.end===item.current_period_end&&(line.discount_amounts||[]).every(x=>x.amount===0)&&(line.pretax_credit_amounts||[]).every(x=>x.amount===0);
}

export function createStripeProvider(config,{fetchImpl=fetch,now=()=>new Date()}={}){
 if(!config||config.origin!=='https://goldtrails.org')throw unavailable();
 let verifiedAt=0,verifying=null,identityAt=0;
 const request=async(method,path,values={},key=null)=>{
  // Stripe object IDs are case-sensitive and can contain uppercase letters.
  // Keep every segment explicit so queries, escapes and traversal stay blocked.
  if(!/^\/v1\/[a-z][a-z0-9_]*(?:\/[A-Za-z0-9_]+)*$/.test(path))throw identity();
  const params=encode(values),url='https://api.stripe.com'+path+(method==='GET'&&params.size?'?'+params:'');
  try{
   const response=await fetchImpl(url,{method,redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+config.secretKey,'Stripe-Version':stripeVersion,...(method!=='GET'?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},...(method!=='GET'?{body:params.toString()}:{})});
   if(!response.ok)throw unavailable();const raw=await response.text();if(raw.length>2*1024*1024)throw unavailable();const result=JSON.parse(raw);if(!result||typeof result!=='object'||result.error)throw unavailable();return result;
  }catch(error){if(error instanceof BillingError)throw error;throw unavailable();}
 };
 const ensureIdentity=async()=>{
  if(identityAt&&now().getTime()-identityAt<60000)return true;
  const account=await request('GET','/v1/account');
  if(account.id!==config.stripeAccountId)throw identity();identityAt=now().getTime();return true;
 };
 const ensureReady=async()=>{
  if(!config.enabled||!stripeId(config.portalConfigurationId,'bpc'))throw unavailable();
  if(verifiedAt&&now().getTime()-verifiedAt<60000)return true;
  if(verifying)return verifying;
  verifying=(async()=>{
   const [account,price,portal]=await Promise.all([request('GET','/v1/account'),request('GET','/v1/prices/'+config.priceId,{expand:['product']}),request('GET','/v1/billing_portal/configurations/'+config.portalConfigurationId)]);
   const full=account.type==='standard'||account.controller?.stripe_dashboard?.type==='full';
   if(account.id!==config.stripeAccountId||!full||(config.livemode&&(!account.charges_enabled||!account.details_submitted))||price.id!==config.priceId||price.livemode!==config.livemode||price.active!==true||price.type!=='recurring'||price.currency!=='usd'||price.unit_amount!==500||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.recurring?.usage_type!=='licensed'||price.product?.active!==true||portal.id!==config.portalConfigurationId||portal.livemode!==config.livemode||portal.active!==true||portal.features?.subscription_cancel?.enabled!==true||portal.features.subscription_cancel.mode!=='at_period_end'||portal.features?.subscription_update?.enabled!==false||portal.features?.payment_method_update?.enabled!==true)throw new BillingError('billing_configuration','Secure billing setup needs attention. Existing access is unchanged.',503);
   verifiedAt=now().getTime();identityAt=verifiedAt;return true;
  })();
  try{return await verifying;}finally{verifying=null;}
 };
 const customerObject=async(customerId,accountId)=>{
  if(!stripeId(customerId,'cus')||!billingId(accountId))throw identity();
  const customer=await request('GET','/v1/customers/'+customerId);
  if(customer.deleted||customer.livemode!==config.livemode||!metadata(customer,accountId))throw identity();return customer;
 };
 const subscriptionObject=async(subscriptionId,accountId,customerId)=>{
  if(!stripeId(subscriptionId,'sub')||!billingId(accountId)||!stripeId(customerId,'cus'))throw identity();
  // This scalar is includable rather than returned by default; Stripe uses
  // expand for it as well as the linked invoice and schedule objects.
  const sub=await request('GET','/v1/subscriptions/'+subscriptionId,{expand:['latest_invoice','latest_invoice.amount_paid_off_stripe','schedule']});
  if(sub.id!==subscriptionId||sub.livemode!==config.livemode||id(sub.customer)!==customerId||!metadata(sub,accountId))throw identity();return sub;
 };
 const snapshotFrom=sub=>{
  const items=sub.items?.data||[],item=items[0]||{},price=item.price||{},invoice=sub.latest_invoice;
  const single=items.length===1&&sub.items?.has_more!==true;
  const paid=single&&confirmedInvoice(invoice,sub,item,config);
  const schedule=typeof sub.schedule==='object'?sub.schedule:null,pause=schedule?.pause_schedules?.[0];
  const pauseAt=pause?.pause?.pause_at,resumeAt=pause?.resume?.resume_at;
  // Flexible-billing Portal cancellations use cancel_at instead of the boolean.
  const cancelAt=cancellationAt(sub),cancelAtPeriodEnd=sub.cancel_at_period_end===true||(single&&cancelAt!==null&&cancelAt===item.current_period_end);
  return{accountId:sub.metadata.goldtrails_account_id,stripeAccountId:config.stripeAccountId,livemode:sub.livemode,customerId:id(sub.customer),subscriptionId:sub.id,status:sub.status,priceId:price.id,quantity:single?item.quantity:0,currency:price.currency,unitAmount:price.unit_amount,interval:price.recurring?.interval,intervalCount:price.recurring?.interval_count,currentPeriodStart:item.current_period_start??null,currentPeriodEnd:item.current_period_end??null,cancelAtPeriodEnd,latestInvoicePaid:paid,paidThrough:paid?item.current_period_end:null,scheduleId:id(sub.schedule)||null,pauseAt:Number.isSafeInteger(pauseAt)&&Number.isSafeInteger(resumeAt)?pauseAt:null,resumeAt:Number.isSafeInteger(pauseAt)&&Number.isSafeInteger(resumeAt)?resumeAt:null};
 };
 const getCheckout=async(sessionId,accountId,customerId)=>{
  if(!stripeId(sessionId,config.livemode?'cs_live':'cs_test'))throw identity();
  const session=await request('GET','/v1/checkout/sessions/'+sessionId);
  if(session.id!==sessionId||session.livemode!==config.livemode||session.mode!=='subscription'||id(session.customer)!==customerId||session.client_reference_id!==accountId||!metadata(session,accountId))throw identity();return session;
 };
 return{
  ensureReady,ensureIdentity,
  async createCustomer(member){
   await ensureReady();if(!billingId(member?.id)||typeof member.email!=='string'||member.email.length>254||!/^\S+@\S+\.\S+$/.test(member.email))throw identity();
   const result=await request('POST','/v1/customers',{email:member.email,metadata:{goldtrails_app:'goldtrails',goldtrails_account_id:member.id}},`goldtrails:${config.stripeAccountId}:${config.livemode?'live':'test'}:customer:${member.id}`);
   if(!stripeId(result.id,'cus')||result.livemode!==config.livemode||!metadata(result,member.id))throw identity();return result.id;
  },
  async createCheckout(accountId,attempt){
   await ensureReady();await customerObject(attempt.customerId,accountId);
   const session=await request('POST','/v1/checkout/sessions',{mode:'subscription',ui_mode:'hosted_page',customer:attempt.customerId,client_reference_id:accountId,line_items:[{price:config.priceId,quantity:1}],allowed_payment_method_types:['card'],payment_method_collection:'always',allow_promotion_codes:false,automatic_tax:{enabled:config.automaticTax===true},success_url:config.origin+'/billing/return/',cancel_url:config.origin+'/billing/?checkout=canceled',metadata:{goldtrails_app:'goldtrails',goldtrails_account_id:accountId,goldtrails_checkout_id:attempt.id},subscription_data:{billing_mode:{type:'flexible'},metadata:{goldtrails_app:'goldtrails',goldtrails_account_id:accountId}}},attempt.idempotencyKey);
   if(session.livemode!==config.livemode||id(session.customer)!==attempt.customerId||session.client_reference_id!==accountId||!metadata(session,accountId)||!stripeId(session.id,config.livemode?'cs_live':'cs_test'))throw identity();
   return{sessionId:session.id,customerId:attempt.customerId,expiresAt:session.expires_at,url:session.status==='open'?stripeRedirect(session.url,'checkout'):null,status:session.status,subscriptionId:id(session.subscription)||null};
  },
  async checkout(sessionId,accountId,customerId){await ensureIdentity();const session=await getCheckout(sessionId,accountId,customerId);return{sessionId:session.id,customerId,expiresAt:session.expires_at,url:session.status==='open'?stripeRedirect(session.url,'checkout'):null,status:session.status,subscriptionId:id(session.subscription)||null};},
  async snapshot(subscriptionId,accountId,customerId){await ensureIdentity();return snapshotFrom(await subscriptionObject(subscriptionId,accountId,customerId));},
  async portal(accountId,customerId){
   await ensureIdentity();await customerObject(customerId,accountId);
   if(!stripeId(config.portalConfigurationId,'bpc'))throw unavailable();
   const settings=await request('GET','/v1/billing_portal/configurations/'+config.portalConfigurationId);
   if(settings.id!==config.portalConfigurationId||settings.livemode!==config.livemode||!settings.active||settings.features?.subscription_cancel?.enabled!==true||settings.features.subscription_cancel.mode!=='at_period_end'||settings.features?.subscription_update?.enabled!==false)throw unavailable();
   const result=await request('POST','/v1/billing_portal/sessions',{customer:customerId,configuration:config.portalConfigurationId,return_url:config.origin+'/billing/'});
   if(id(result.customer)!==customerId||result.livemode!==undefined&&result.livemode!==config.livemode)throw identity();return stripeRedirect(result.url,'portal');
  },
  async cancelRenewal(accountId,customerId,subscriptionId){
   await ensureIdentity();let sub=await subscriptionObject(subscriptionId,accountId,customerId);
   if(['canceled','incomplete_expired'].includes(sub.status))return{canceled:true};
   const scheduleId=id(sub.schedule);
   // The hosted portal cannot cancel a schedule-managed subscription. Releasing
   // the schedule also removes any automatic resume and leaves service in place.
   if(scheduleId){
    const released=await request('POST','/v1/subscription_schedules/'+scheduleId+'/release',{preserve_cancel_date:true},`goldtrails:${config.stripeAccountId}:cancel-release:${scheduleId}`);
    if(released.status!=='released'||id(released.released_subscription)!==subscriptionId||released.livemode!==config.livemode)throw unavailable();
    sub=await subscriptionObject(subscriptionId,accountId,customerId);
    if(sub.schedule)throw unavailable();
   }
   if(sub.status==='paused'){
    // There is no paid service to retain once the true service pause took effect.
    const canceled=await request('DELETE','/v1/subscriptions/'+subscriptionId,{invoice_now:false,prorate:false});
    if(canceled.status!=='canceled'||id(canceled.customer)!==customerId||canceled.livemode!==config.livemode)throw unavailable();
   }else{
    // Setting this boolean is itself idempotent. A long-lived request key would
    // return an obsolete cancellation after a customer re-enabled renewal.
    const updated=await request('POST','/v1/subscriptions/'+subscriptionId,{cancel_at_period_end:true,proration_behavior:'none'});
    if(updated.cancel_at_period_end!==true||id(updated.customer)!==customerId||updated.livemode!==config.livemode)throw unavailable();
   }
   return{canceled:true};
  },
  async schedulePause(accountId,customerId,subscriptionId,paidThrough){
   await ensureReady();if(!config.pauseEnabled)throw new BillingError('pause_unavailable','Subscription pauses are not open yet.',503);
   const sub=await subscriptionObject(subscriptionId,accountId,customerId),snapshot=snapshotFrom(sub),dates=threeMonthPause(paidThrough,{now});
   if(sub.status!=='active'||sub.cancel_at_period_end||cancellationAt(sub)!==null||sub.pause_collection||sub.billing_mode?.type!=='flexible'||sub.collection_method!=='charge_automatically'||sub.items?.data?.length!==1||snapshot.priceId!==config.priceId||snapshot.quantity!==1||!snapshot.latestInvoicePaid||snapshot.currentPeriodEnd!==Math.floor(dates.pauseAt.getTime()/1000))throw new BillingError('pause_unavailable','This subscription needs review before a pause can be scheduled.',409);
   const existing=typeof sub.schedule==='object'?sub.schedule:null;
   if(existing?.pause_schedules?.length){const p=existing.pause_schedules[0];if(p.pause?.pause_at===Math.floor(dates.pauseAt.getTime()/1000)&&p.resume?.resume_at===Math.floor(dates.resumeAt.getTime()/1000))return dates;throw new BillingError('pause_exists','A pause is already scheduled. Contact Paul to change it.',409);}
   const values={pause_schedules:[{pause:{pause_at:{type:'timestamp',timestamp:Math.floor(dates.pauseAt.getTime()/1000)}},resume:{resume_at:{type:'timestamp',timestamp:Math.floor(dates.resumeAt.getTime()/1000)},settings:{billing_cycle_anchor:'resume_at',payment_behavior:'resume_on_payment_success'}}}]};
   const result=await request('POST',existing?'/v1/subscription_schedules/'+existing.id:'/v1/subscription_schedules',existing?values:{from_subscription:subscriptionId,...values},`goldtrails:${config.stripeAccountId}:pause:${subscriptionId}:${Math.floor(dates.pauseAt.getTime()/1000)}`);
   const saved=result.pause_schedules?.[0];if(id(result.customer)!==customerId||id(result.subscription)!==subscriptionId||result.livemode!==config.livemode||saved?.pause?.pause_at!==Math.floor(dates.pauseAt.getTime()/1000)||saved?.resume?.resume_at!==Math.floor(dates.resumeAt.getTime()/1000))throw unavailable();
   return dates;
  }
 };
}
