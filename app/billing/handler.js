import {timingSafeEqual} from 'node:crypto';
import {digest} from '../admin-auth.js';
import {page,escapeHtml as h} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';
import {BillingError,billingDate,billingId,stripeId} from './model.js';
import {verifyStripeSignature} from './provider.js';

const routes=new Set(['/billing/','/billing/subscribe/','/billing/manage/','/billing/cancel/','/billing/pause/','/billing/refresh/','/billing/return/','/billing/webhook/','/billing/donate/']);
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp('(?:^|;\\s*)__Host-gold-'+name+'=([a-f0-9]{64})(?:;|$)'))?.[1]||null;
const equal=(a,b)=>/^[a-f0-9]{64}$/.test(a||'')&&/^[a-f0-9]{64}$/.test(b||'')&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const action=(path,csrf,label)=>`<form method="post" action="${path}"><input type="hidden" name="csrf" value="${h(csrf)}"><button class="gold-button" type="submit">${h(label)}</button></form>`;
const billingSupport='<p>If you cannot sign in or need help stopping renewals, email <a href="mailto:paul@goldtrails.org">paul@goldtrails.org</a>.</p>';
const shell=(title,body)=>page(title,'Gold Trails Plus subscription and billing.',`<section class="resource-placeholder billing-account"><h2>${h(title)}</h2>${body}</section>`,'','Your Gold Trails membership.').replace('class="category-page"','class="category-page plus-page"').replace('</head>',`<link rel="stylesheet" href="${assetUrl('plus.css')}"></head>`);
async function body(req,limit){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw new BillingError('body_too_large','This request is too large.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
async function form(req){if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw new BillingError('billing_input','Use the billing form.',415);const fields=new URLSearchParams((await body(req,4096)).toString('utf8')),seen=new Set();for(const key of fields.keys()){if(seen.has(key)||key!=='csrf')throw new BillingError('billing_input','Refresh the billing form and try again.');seen.add(key);}return fields;}
const externalId=value=>typeof value==='string'?value:value?.id;
const webhookTypes=new Set(['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','invoice.paid','invoice.payment_failed','invoice.voided','invoice.marked_uncollectible','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed']);

export function createBillingHandler({store=null,members=null,provider=null,config=null,invitations=null,log=console.error,now=()=>new Date()}={}){
 const reconcile=async(accountId,subscriptionId,customerId,event=null)=>{
  const load=()=>provider.snapshot(subscriptionId,accountId,customerId);
  return event?store.applySubscription({...event,accountId,subscriptionId},load):store.reconcileSubscription({accountId,subscriptionId},load);
 };
 const syncCheckout=async(accountId,customerId,sessionId,event=null)=>{
  const session=await provider.checkout(sessionId,accountId,customerId);
  if(session.status==='expired')await store.expireCheckout(accountId,sessionId);
  else if(session.status==='complete'){
   if(!stripeId(session.subscriptionId,'sub'))throw new BillingError('checkout_unresolved','Checkout is awaiting subscription confirmation.',409);
   await reconcile(accountId,session.subscriptionId,customerId,event);
   await store.completeCheckout(accountId,sessionId);
  }
  return session;
 };
 const handler=async(req,res,url)=>{
  if(!url.pathname.startsWith('/billing'))return false;
  // Safari also checks form-action against the hosted destination after our 303.
  const send=(status,title,content,headers={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'strict-origin','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com; base-uri 'none'",Vary:'Cookie',...headers});res.end(req.method==='HEAD'?undefined:shell(title,content));};
  const redirect=destination=>send(303,'Continue to billing','',{Location:destination});
  const json=(status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
  if(!routes.has(url.pathname)){if(routes.has(url.pathname+'/')&&['GET','HEAD'].includes(req.method)){send(308,'Billing','',{Location:url.pathname+'/'});return true;}return false;}
  try{
   if(!config||!provider||!store||!members||!await store.ready()){send(503,'Payments are not open yet','<p>Subscription setup is being completed. No payment has been created or confirmed.</p><p><a href="/plus/">Return to Gold Trails Plus</a>.</p>'+billingSupport);return true;}
   if(url.pathname==='/billing/webhook/'){
    if(req.method!=='POST'){json(405,{error:'Use POST.'});return true;}
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new BillingError('webhook_format','Use JSON.',415);
    const raw=await body(req,1024*1024);verifyStripeSignature(raw,req.headers['stripe-signature'],config.webhookSecret,{now});
    let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw new BillingError('webhook_format','Invalid webhook.',400);}
    if(!stripeId(event?.id,'evt')||event.livemode!==config.livemode||(event.account!==undefined&&event.account!==config.stripeAccountId)||!Number.isSafeInteger(event.created)||typeof event.type!=='string')throw new BillingError('webhook_identity','Webhook account or mode does not match.',400);
    if(!webhookTypes.has(event.type)){json(200,{received:true,ignored:true});return true;}
    const object=event.data?.object,customerId=externalId(object?.customer);
    if(!object||object.livemode!==config.livemode||!stripeId(customerId,'cus'))throw new BillingError('webhook_identity','Invalid billing object.',400);
    const accountId=await store.accountForCustomer(customerId);
    if(!accountId){json(200,{received:true,ignored:true});return true;}
    if(object.metadata?.goldtrails_account_id&&object.metadata.goldtrails_account_id!==accountId)throw new BillingError('webhook_identity','Invalid billing object.',400);
    const normalized={eventId:event.id,eventType:event.type,eventCreated:event.created,livemode:event.livemode};
    if(event.type.startsWith('checkout.session.'))await syncCheckout(accountId,customerId,object.id,normalized);
    else{
     const subscriptionId=event.type.startsWith('customer.subscription.')?object.id:externalId(object.parent?.subscription_details?.subscription);
     if(!stripeId(subscriptionId,'sub'))throw new BillingError('webhook_identity','Invalid subscription object.',400);
     await reconcile(accountId,subscriptionId,customerId,normalized);
    }
    json(200,{received:true});return true;
   }
   if(url.pathname==='/billing/donate/'){send(503,'Donations are not open yet','<p>Voluntary donations are being prepared separately from subscriptions.</p>');return true;}
   if(!['GET','HEAD','POST'].includes(req.method)){send(405,'Use the billing form','<p>That action is unavailable.</p>',{Allow:'GET, HEAD, POST'});return true;}
   if(['/billing/subscribe/','/billing/manage/','/billing/cancel/','/billing/pause/','/billing/refresh/'].includes(url.pathname)&&req.method!=='POST'){send(405,'Use the billing form','<p>Return to your subscription page to continue.</p><p><a href="/billing/">Your subscription</a></p>',{Allow:'POST'});return true;}
   if(['/billing/','/billing/return/'].includes(url.pathname)&&req.method==='POST'){send(405,'Your subscription','<p>Use the buttons on your subscription page.</p>',{Allow:'GET, HEAD'});return true;}
   const member=await members.session(read(req,'member'));
   if(!member||!billingId(member.id)){send(401,'Sign in to manage your subscription','<p>Use the email address for your Gold Trails member account.</p><p><a class="gold-button" href="/login/?next=%2Fplus%2F">Member sign-in</a> · <a href="/forgot-password/">Reset your password</a></p>'+billingSupport);return true;}
   const csrf=read(req,'form');
   if(req.method==='POST'){
    if(req.headers.origin!==config.origin)throw new BillingError('billing_csrf','Refresh the billing page and try again.',403);
    const fields=await form(req);
    if(!equal(csrf,fields.get('csrf'))||!equal(digest(csrf||''),member.csrf_token_hash))throw new BillingError('billing_csrf','Your billing form expired. Sign in again and retry.',403);
    if(members.allow&&!await members.allow('billing:'+member.id))throw new BillingError('billing_rate','Please try again in 15 minutes.',429);
   }
   let state=await store.billingState(member.id);
   if(!state||state.account.status!=='active'||!state.account.email_verified_at||state.account.archived_at)throw new BillingError('billing_unavailable','Your membership needs review before billing can be changed.',409);
   if(req.method==='POST'&&url.pathname==='/billing/subscribe/'){
    if(!config.enabled)throw new BillingError('billing_disabled','New subscriptions are not open yet.',503);
    if(state.membership?.status==='suspended')throw new BillingError('billing_unavailable','Your membership needs review before starting a subscription.',409);
    if(state.membership?.grant_source==='complimentary')throw new BillingError('complimentary_account','Your creator access is complimentary. No subscription fee or card is required.',409);
    const pending=read(req,'creator-invite');
    if(pending&&invitations&&await invitations.ready()&&await invitations.read(pending))throw new BillingError('creator_invitation_pending','Accept your creator invitation for complimentary access before starting a paid subscription.',409);
    await provider.ensureReady();
    if(state.checkout?.providerSessionId){const prior=await syncCheckout(member.id,state.customerId,state.checkout.providerSessionId);if(prior.status==='open'){redirect(prior.url);return true;}state=await store.billingState(member.id);}
    if(!state.customerId){const customerId=await provider.createCustomer(member);await store.bindCustomer(member.id,customerId);}
    const attempt=await store.reserveCheckout(member.id);
    let session;
    if(attempt.providerSessionId)session=await syncCheckout(member.id,attempt.customerId,attempt.providerSessionId);
    else{
     session=await provider.createCheckout(member.id,attempt);
     session=await provider.checkout(session.sessionId,member.id,attempt.customerId);
     await store.finishCheckout(member.id,attempt.id,session);
     session=await syncCheckout(member.id,attempt.customerId,session.sessionId);
    }
    if(session.status==='open'){redirect(session.url);return true;}
    redirect('/billing/');return true;
   }
   if(req.method==='POST'&&url.pathname==='/billing/manage/'){
    if(!state.customerId)throw new BillingError('subscription_missing','There is no billing account to manage.',409);
    redirect(await provider.portal(member.id,state.customerId));return true;
   }
   if(req.method==='POST'&&url.pathname==='/billing/cancel/'){
    if(!state.customerId||!state.subscription)throw new BillingError('subscription_missing','There is no subscription to cancel.',409);
    await store.reconcileSubscription({accountId:member.id,subscriptionId:state.subscription.subscriptionId},async()=>{
     await provider.cancelRenewal(member.id,state.customerId,state.subscription.subscriptionId);
     return provider.snapshot(state.subscription.subscriptionId,member.id,state.customerId);
    });redirect('/billing/');return true;
   }
   if(req.method==='POST'&&url.pathname==='/billing/pause/'){
    const subscription=state.subscription;
    if(!subscription||state.membership.status==='suspended'||state.membership.grant_source!=='payment'||subscription.id!==state.membership.subscription_id)throw new BillingError('pause_unavailable','A current paid subscription is required to schedule a pause.',409);
    // The existing account lock serializes pause/cancel commands with each other
    // and with webhook reconciliation. Re-read payment immediately before pause.
    await store.reconcileSubscription({accountId:member.id,subscriptionId:subscription.subscriptionId},async()=>{
     const current=await provider.snapshot(subscription.subscriptionId,member.id,state.customerId);
     await provider.schedulePause(member.id,state.customerId,subscription.subscriptionId,current.paidThrough);
     return provider.snapshot(subscription.subscriptionId,member.id,state.customerId);
    });redirect('/billing/');return true;
   }
   if(req.method==='POST'&&url.pathname==='/billing/refresh/'){
    if(state.checkout?.providerSessionId)await syncCheckout(member.id,state.customerId,state.checkout.providerSessionId);
    for(const subscription of state.subscriptions||[])await reconcile(member.id,subscription.subscriptionId,state.customerId);
    redirect('/billing/');return true;
   }
   // A return URL is presentation only. It never consumes a session identifier,
   // reconciles billing, marks an invoice paid, or changes membership.
   const subscription=state.subscription,complimentary=state.membership?.grant_source==='complimentary';
   let content=url.pathname==='/billing/return/'?'<p>Welcome back. Access appears once Stripe confirms your paid subscription. You can check its status below.</p>':'';
   if(state.membership?.status==='suspended')content+='<p role="status">Your Plus access is suspended. You can still manage your payment method, view invoices and stop future renewals.</p>';
   if(!config.livemode)content+='<p role="status"><strong>Test mode.</strong> Test payments do not unlock live Gold Trails Plus.</p>';
   if(complimentary)content+='<p>Your creator access is complimentary. No subscription fee or card is required.</p>';
   else if(subscription){
    content+=`<p>Gold Trails Plus · $5 USD per month. Status: <strong>${h(subscription.status.replaceAll('_',' '))}</strong>.</p>${subscription.paidThrough?`<p>Confirmed paid through ${h(subscription.paidThrough.toISOString().slice(0,10))} (UTC).</p>`:''}${subscription.cancelAtPeriodEnd?'<p>Future renewals are canceled. Your confirmed paid access continues through its paid-through date.</p>':''}${subscription.pauseAt&&subscription.resumeAt?`<p>Your service pause starts ${h(subscription.pauseAt.toISOString().slice(0,10))}. Renewal is scheduled to resume ${h(subscription.resumeAt.toISOString().slice(0,10))} at $5 USD per month, subject to successful payment.</p>`:''}`;
   }else content+='<p>Plus includes the State Almanac and Gold Connections for $5 USD per month, renewing automatically until canceled. Any applicable tax appears before payment.</p>';
   if(state.customerId&&!complimentary)content+=action('/billing/manage/',csrf||'','Manage payment method, invoices & cancellation');
   if(subscription&&!['canceled','expired','incomplete_expired'].includes(subscription.status)&&!subscription.cancelAtPeriodEnd)content+='<p>Canceling future renewals also removes a scheduled pause or automatic resume. Your confirmed paid access lasts through its paid period.</p>'+action('/billing/cancel/',csrf||'','Cancel future renewals');
   if(!complimentary&&state.membership?.status!=='suspended'&&(state.canSubscribe===true||!subscription)&&config.enabled&&csrf&&equal(digest(csrf),member.csrf_token_hash))content+=action('/billing/subscribe/',csrf,'Subscribe · $5/month');
   if(config.pauseEnabled&&state.membership?.status!=='suspended'&&subscription?.status==='active'&&!subscription.cancelAtPeriodEnd&&!subscription.pauseAt&&state.membership?.grant_source==='payment')content+='<p>A three-month pause starts after your paid period. Plus access and recurring charges pause together. Renewal resumes automatically after three calendar months, following successful payment.</p>'+action('/billing/pause/',csrf||'','Pause for three months after my paid period');
   if(!complimentary&&(state.customerId||state.checkout))content+=action('/billing/refresh/',csrf||'','Check subscription status');
   content+='<p><a href="/account/">Return to your camp</a> · <a href="/gold-almanac/">Open the Almanac</a></p>'+billingSupport;
   send(200,'Your Plus subscription',content);return true;
  }catch(error){
   if(error instanceof BillingError){if(url.pathname==='/billing/webhook/')json(error.status,{error:error.code});else send(error.status,'Your Plus subscription',`<p role="alert">${h(error.message)}</p><p><a href="/billing/">Return to your subscription</a> · <a href="/account/">Your camp</a></p>`+billingSupport);return true;}
   log('Gold Trails billing request unavailable');
   if(url.pathname==='/billing/webhook/')json(503,{error:'billing_unavailable'});else send(503,'A pause along the trail','<p>We could not confirm this request. Check your subscription status before trying another payment.</p><p><a href="/billing/">Your subscription</a></p>'+billingSupport);return true;
  }
 };
 // Plus calls this for its read-only subscription action. No Stripe object is
 // created until the authenticated member explicitly submits the subscribe form.
 handler.offer=async req=>{
  if(!config?.enabled||!store||!members)return{enabled:false};
  try{if(!await store.ready())return{enabled:false};await provider.ensureReady();const member=await members.session(read(req,'member'));if(!member)return{enabled:true};const csrf=read(req,'form'),state=await store.billingState(member.id);return{enabled:true,member,csrf:csrf&&state?.membership?.status!=='suspended'&&equal(digest(csrf),member.csrf_token_hash)?csrf:null,state};}catch{return{enabled:false};}
 };
 return handler;
}
