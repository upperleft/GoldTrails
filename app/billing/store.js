import {randomUUID} from 'node:crypto';
import {BillingError,billingConfig,billingDate,billingId,eligiblePaidSnapshot,normalizeSubscriptionSnapshot,sqlDate,stripeId} from './model.js';

const identity=()=>new BillingError('billing_identity','The billing account could not be verified.',409);
const unavailable=()=>new BillingError('billing_unavailable','This account needs review before starting a subscription.',409);
const ongoing=['pending','active','trialing','past_due','incomplete','unpaid','paused','unknown'];
const terminal=new Set(['canceled','expired','incomplete_expired']);
const subscriptionColumns='id,account_id,provider,provider_customer_id,provider_subscription_id,status,current_period_start,current_period_end,cancel_at_period_end,stripe_account_id,livemode,price_id,price_valid,provider_status,paid_through,latest_invoice_paid,schedule_id,pause_at,resume_at,pause_reminder_sent_at,last_reconciled_at';

export function createBillingStore(db,options){
 const config=billingConfig(options),scope=[config.stripeAccountId,config.livemode?1:0];
 const now=()=>billingDate(config.now(),{nullable:false});
 const replaceablePayment=(membership,subscription,at=now())=>membership?.grant_source==='payment'&&membership.status==='expired'&&!!membership.ends_at&&billingDate(membership.ends_at)<=at&&subscription?.account_id===membership.account_id&&subscription.provider===config.provider&&subscription.stripe_account_id===config.stripeAccountId&&!!subscription.livemode===config.livemode&&terminal.has(subscription.status)&&!!subscription.paid_through&&billingDate(subscription.paid_through)<=at&&!!subscription.current_period_end&&billingDate(subscription.current_period_end)<=at;
 const tx=async fn=>{const c=await db.getConnection();try{await c.beginTransaction();const result=await fn(c);await c.commit();return result;}catch(error){await c.rollback();throw error;}finally{c.release();}};
 const requireAccount=id=>{if(!billingId(id))throw identity();};
 const lockAccount=async(c,id)=>{
  requireAccount(id);
  const account=(await c.query('SELECT id,status,email_verified_at,archived_at FROM member_accounts WHERE id=? FOR UPDATE',[id]))[0];
  if(!account)throw identity();
  const membership=(await c.query('SELECT account_id,level,status,grant_source,subscription_id,granted_by,starts_at,ends_at FROM member_memberships WHERE account_id=? FOR UPDATE',[id]))[0];
  return{account,membership};
 };
 const canBuy=({account,membership})=>{
  if(account.status!=='active'||!account.email_verified_at||account.archived_at||!membership||membership.status==='suspended'||membership.grant_source==='complimentary')throw unavailable();
 };
 const customer=async(c,accountId,lock=true)=>(await c.query(`SELECT provider_customer_id FROM billing_customers WHERE account_id=? AND stripe_account_id=? AND livemode=?${lock?' FOR UPDATE':''}`,[accountId,...scope]))[0]?.provider_customer_id||null;
 const audit=(c,accountId,action)=>c.query('INSERT INTO member_audit_log(id,account_id,action) VALUES(?,?,?)',[randomUUID(),accountId,action]);
 const attemptView=row=>row?{id:row.id,customerId:row.provider_customer_id,providerSessionId:row.provider_session_id||null,status:row.status,idempotencyKey:`goldtrails:${config.stripeAccountId}:${config.livemode?'live':'test'}:checkout:${row.id}`,expiresAt:billingDate(row.expires_at)}:null;
 const subscriptionView=row=>row?{id:row.id,accountId:row.account_id,customerId:row.provider_customer_id,subscriptionId:row.provider_subscription_id,stripeAccountId:row.stripe_account_id,livemode:!!row.livemode,status:row.status,providerStatus:row.provider_status,priceId:row.price_id,priceValid:!!row.price_valid,currentPeriodStart:billingDate(row.current_period_start),currentPeriodEnd:billingDate(row.current_period_end),cancelAtPeriodEnd:!!row.cancel_at_period_end,paidThrough:billingDate(row.paid_through),latestInvoicePaid:!!row.latest_invoice_paid,scheduleId:row.schedule_id,pauseAt:billingDate(row.pause_at),resumeAt:billingDate(row.resume_at),pauseReminderSentAt:billingDate(row.pause_reminder_sent_at),lastReconciledAt:billingDate(row.last_reconciled_at)}:null;

 const apply=async(c,{accountId,subscriptionId},loadCurrent,event=null)=>{
  const locked=await lockAccount(c,accountId);
  if(event){
   const previous=(await c.query('SELECT account_id,provider_subscription_id,membership_outcome FROM billing_events WHERE stripe_account_id=? AND livemode=? AND event_id=? FOR UPDATE',[...scope,event.eventId]))[0];
   if(previous){if(previous.account_id!==accountId||previous.provider_subscription_id!==subscriptionId)throw identity();return{duplicate:true,membershipOutcome:previous.membership_outcome};}
  }
  const customerId=await customer(c,accountId);
  if(!customerId)throw identity();
  // Fetch under the account lock: concurrent deliveries cannot apply an older
  // network response after a newer one. The callback must use a bounded timeout.
  const snapshot=normalizeSubscriptionSnapshot(await loadCurrent(),config);
  if(snapshot.accountId!==accountId||snapshot.subscriptionId!==subscriptionId||snapshot.customerId!==customerId)throw identity();
  let subscription=(await c.query(`SELECT ${subscriptionColumns} FROM member_subscriptions WHERE provider=? AND provider_subscription_id=? FOR UPDATE`,[config.provider,subscriptionId]))[0]||null;
  if(subscription&&(subscription.account_id!==accountId||subscription.provider_customer_id!==customerId||subscription.stripe_account_id!==config.stripeAccountId||!!subscription.livemode!==config.livemode))throw identity();
  const subscriptionRowId=subscription?.id||randomUUID();
  const previousPaid=billingDate(subscription?.paid_through),newPaid=snapshot.latestInvoicePaid?snapshot.paidThrough:null;
  const paidThrough=previousPaid&&(!newPaid||previousPaid>=newPaid)?previousPaid:newPaid;
  const timestamp=now(),eventTime=event?event.eventCreated:timestamp;
  const fields=[snapshot.status,sqlDate(snapshot.currentPeriodStart),sqlDate(snapshot.currentPeriodEnd),snapshot.cancelAtPeriodEnd?1:0,snapshot.priceId,snapshot.priceValid?1:0,snapshot.providerStatus,sqlDate(paidThrough),snapshot.latestInvoicePaid?1:0,snapshot.scheduleId,sqlDate(snapshot.pauseAt),sqlDate(snapshot.resumeAt),sqlDate(timestamp)];
  if(subscription){
   // Event creation time is audit information only; a fresh provider read drives
   // state even when an old webhook caused the reconciliation.
   await c.query('UPDATE member_subscriptions SET status=?,current_period_start=?,current_period_end=?,cancel_at_period_end=?,price_id=?,price_valid=?,provider_status=?,paid_through=?,latest_invoice_paid=?,schedule_id=?,pause_reminder_sent_at=IF(NOT(pause_at<=>?) OR NOT(resume_at<=>?),NULL,pause_reminder_sent_at),pause_at=?,resume_at=?,last_reconciled_at=?,last_event_at=GREATEST(COALESCE(last_event_at,?),?),canceled_at=IF(?=\'canceled\',COALESCE(canceled_at,?),NULL) WHERE id=?',[...fields.slice(0,10),fields[10],fields[11],fields[10],fields[11],fields[12],sqlDate(eventTime),sqlDate(eventTime),snapshot.status,sqlDate(timestamp),subscriptionRowId]);
  }else{
   await c.query('INSERT INTO member_subscriptions(id,account_id,provider,provider_customer_id,provider_subscription_id,stripe_account_id,livemode,status,current_period_start,current_period_end,cancel_at_period_end,price_id,price_valid,provider_status,paid_through,latest_invoice_paid,schedule_id,pause_at,resume_at,last_reconciled_at,last_event_at,canceled_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[subscriptionRowId,accountId,config.provider,customerId,subscriptionId,...scope,...fields,sqlDate(eventTime),snapshot.status==='canceled'?sqlDate(timestamp):null]);
  }
  let membershipOutcome='unchanged';
  const {account,membership}=locked;
  const enabledMode=config.livemode||config.allowTestEntitlements;
  if(!enabledMode)membershipOutcome='test_ignored';
  else if(account.status!=='active'||!account.email_verified_at||account.archived_at)membershipOutcome='account_restricted';
  else if(!membership)membershipOutcome='membership_missing';
  else if(membership.status==='suspended')membershipOutcome='membership_suspended';
  else if(membership.grant_source==='complimentary')membershipOutcome='complimentary_preserved';
  else{
   const eligible=eligiblePaidSnapshot(snapshot,config,paidThrough);
   const same=membership.grant_source==='payment'&&membership.subscription_id===subscriptionRowId;
   // Rejoining is allowed only after the previous scoped subscription is both
   // terminal and fully past its confirmed paid term. Dates alone are not proof
   // that renewal stopped, and cannot release an ongoing subscription.
   let different=membership.grant_source==='payment'&&!same;
   if(different){const prior=(await c.query(`SELECT ${subscriptionColumns} FROM member_subscriptions WHERE id=? AND account_id=? FOR UPDATE`,[membership.subscription_id,accountId]))[0];different=!replaceablePayment(membership,prior,timestamp);}
   if(different)membershipOutcome='other_subscription_preserved';
   else if(eligible){
    const endsAt=new Date(Math.min(paidThrough.getTime(),snapshot.currentPeriodEnd.getTime()));
    await c.query("UPDATE member_memberships SET level='subscriber',status='active',grant_source='payment',subscription_id=?,granted_by=NULL,starts_at=?,ends_at=? WHERE account_id=?",[subscriptionRowId,sqlDate(snapshot.currentPeriodStart),sqlDate(endsAt),accountId]);
    membershipOutcome='paid_access';
   }else if(same){
    await c.query("UPDATE member_memberships SET status='expired' WHERE account_id=? AND grant_source='payment' AND subscription_id=? AND status<>'suspended'",[accountId,subscriptionRowId]);
    membershipOutcome='paid_access_ended';
   }else membershipOutcome='not_paid';
  }
  if(event)await c.query('INSERT INTO billing_events(stripe_account_id,livemode,event_id,account_id,provider_subscription_id,event_type,event_created,membership_outcome) VALUES(?,?,?,?,?,?,?,?)',[...scope,event.eventId,accountId,subscriptionId,event.eventType,sqlDate(event.eventCreated),membershipOutcome]);
  await audit(c,accountId,event?'billing_webhook_reconciled':'billing_reconciled');
  return{duplicate:false,subscriptionId:subscriptionRowId,membershipOutcome,status:snapshot.status,priceValid:snapshot.priceValid,paidThrough};
 };

 return{
  async ready(){return(await db.query("SELECT version FROM schema_migrations WHERE version='016_stripe_billing'")).length===1;},
  async billingState(accountId){
   requireAccount(accountId);
   const account=(await db.query('SELECT id,status,email_verified_at,archived_at FROM member_accounts WHERE id=?',[accountId]))[0]||null;
   if(!account)return null;
   const membership=(await db.query('SELECT account_id,level,status,grant_source,subscription_id,granted_by,starts_at,ends_at FROM member_memberships WHERE account_id=?',[accountId]))[0]||null;
   const customerId=await customer(db,accountId,false);
   const subscriptions=await db.query(`SELECT ${subscriptionColumns} FROM member_subscriptions WHERE account_id=? AND stripe_account_id=? AND livemode=? AND provider=? ORDER BY created_at DESC,id DESC LIMIT 25`,[accountId,...scope,config.provider]);
   const checkout=(await db.query("SELECT id,provider_customer_id,provider_session_id,status,expires_at FROM billing_checkout_attempts WHERE account_id=? AND stripe_account_id=? AND livemode=? AND status IN('creating','open') ORDER BY created_at DESC,id DESC LIMIT 1",[accountId,...scope]))[0]||null;
   const selected=subscriptions.find(s=>s.id===membership?.subscription_id)||subscriptions.find(s=>ongoing.includes(s.status))||subscriptions[0]||null;
   const prior=subscriptions.find(s=>s.id===membership?.subscription_id);
   const canSubscribe=account.status==='active'&&!!account.email_verified_at&&!account.archived_at&&!!membership&&membership.status!=='suspended'&&membership.grant_source!=='complimentary'&&!subscriptions.some(s=>ongoing.includes(s.status))&&(membership.grant_source!=='payment'||replaceablePayment(membership,prior));
   return{account,membership,customerId,subscription:subscriptionView(selected),subscriptions:subscriptions.map(subscriptionView),checkout:attemptView(checkout),canSubscribe};
  },
  async accountForCustomer(customerId){
   if(!stripeId(customerId,'cus'))throw identity();
   return(await db.query('SELECT account_id FROM billing_customers WHERE stripe_account_id=? AND livemode=? AND provider_customer_id=?',[...scope,customerId]))[0]?.account_id||null;
  },
  async bindCustomer(accountId,customerId){
   requireAccount(accountId);if(!stripeId(customerId,'cus'))throw identity();
   return tx(async c=>{
    canBuy(await lockAccount(c,accountId));
    const bound=await customer(c,accountId);
    if(bound){if(bound!==customerId)throw identity();return{customerId:bound,created:false};}
    const other=(await c.query('SELECT account_id FROM billing_customers WHERE stripe_account_id=? AND livemode=? AND provider_customer_id=? FOR UPDATE',[...scope,customerId]))[0];
    if(other&&other.account_id!==accountId)throw identity();
    await c.query('INSERT INTO billing_customers(account_id,stripe_account_id,livemode,provider_customer_id) VALUES(?,?,?,?)',[accountId,...scope,customerId]);
    await audit(c,accountId,'billing_customer_bound');return{customerId,created:true};
   });
  },
  async reserveCheckout(accountId){
   requireAccount(accountId);
   return tx(async c=>{
    const locked=await lockAccount(c,accountId);canBuy(locked);
    const customerId=await customer(c,accountId);if(!customerId)throw identity();
    const subscriptions=await c.query(`SELECT id FROM member_subscriptions WHERE account_id=? AND provider=? AND status IN(${ongoing.map(()=>'?').join(',')}) FOR UPDATE`,[accountId,config.provider,...ongoing]);
    let previousBlocks=false;
    if(locked.membership.grant_source==='payment'){const prior=(await c.query(`SELECT ${subscriptionColumns} FROM member_subscriptions WHERE id=? AND account_id=? FOR UPDATE`,[locked.membership.subscription_id,accountId]))[0];previousBlocks=!replaceablePayment(locked.membership,prior);}
    if(subscriptions.length||previousBlocks)throw new BillingError('subscription_exists','Manage your existing subscription before starting another.',409);
    const timestamp=now();
    // An unresolved creating attempt retains its idempotency key. Do not assume
    // that an expired network request failed to create a provider subscription.
    const existing=(await c.query("SELECT id,provider_customer_id,provider_session_id,status,expires_at FROM billing_checkout_attempts WHERE account_id=? AND stripe_account_id=? AND livemode=? AND status IN('creating','open') ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE",[accountId,...scope]))[0];
    if(existing){
     if(existing.provider_customer_id!==customerId)throw identity();
     if(billingDate(existing.expires_at)<=timestamp)throw new BillingError('checkout_unresolved','The previous checkout needs verification before starting another.',409);
     return attemptView(existing);
    }
    const row={id:randomUUID(),provider_customer_id:customerId,provider_session_id:null,status:'creating',expires_at:new Date(timestamp.getTime()+24*60*60*1000)};
    await c.query('INSERT INTO billing_checkout_attempts(id,account_id,stripe_account_id,livemode,provider_customer_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?)',[row.id,accountId,...scope,customerId,sqlDate(timestamp),sqlDate(row.expires_at)]);
    await audit(c,accountId,'billing_checkout_reserved');return attemptView(row);
   });
  },
  async finishCheckout(accountId,id,{sessionId,customerId,expiresAt,status='open'}={}){
   requireAccount(accountId);
   if(!billingId(id)||!stripeId(sessionId,config.livemode?'cs_live':'cs_test')||!stripeId(customerId,'cus')||!['open','complete','expired'].includes(status))throw identity();
   const expiry=billingDate(expiresAt,{nullable:false});
   return tx(async c=>{
    await lockAccount(c,accountId);
    if(await customer(c,accountId)!==customerId)throw identity();
    const row=(await c.query('SELECT id,account_id,provider_customer_id,provider_session_id,status,expires_at FROM billing_checkout_attempts WHERE id=? AND account_id=? AND stripe_account_id=? AND livemode=? FOR UPDATE',[id,accountId,...scope]))[0];
    if(!row||row.provider_customer_id!==customerId||(row.provider_session_id&&row.provider_session_id!==sessionId))throw identity();
    if(row.provider_session_id===sessionId)return attemptView(row);
    if(row.status!=='creating'||status==='open'&&expiry<=now())throw new BillingError('checkout_expired','This checkout has expired. Please try again.',409);
    // A completed provider session stays unresolved locally until its current
    // subscription is durably reconciled; otherwise creator conversion can race.
    const localStatus=status==='complete'?'open':status;
    await c.query('UPDATE billing_checkout_attempts SET provider_session_id=?,status=?,expires_at=?,finished_at=? WHERE id=?',[sessionId,localStatus,sqlDate(expiry),status==='expired'?sqlDate(now()):null,id]);
    return attemptView({...row,provider_session_id:sessionId,status:localStatus,expires_at:expiry});
   });
  },
  async completeCheckout(accountId,sessionId){
   requireAccount(accountId);if(!stripeId(sessionId,config.livemode?'cs_live':'cs_test'))throw identity();
   return tx(async c=>{
    await lockAccount(c,accountId);
    const row=(await c.query('SELECT id,provider_customer_id,status FROM billing_checkout_attempts WHERE account_id=? AND stripe_account_id=? AND livemode=? AND provider_session_id=? FOR UPDATE',[accountId,...scope,sessionId]))[0];
    if(!row||row.provider_customer_id!==await customer(c,accountId))throw identity();
    if(row.status!=='completed')await c.query("UPDATE billing_checkout_attempts SET status='completed',finished_at=? WHERE id=?",[sqlDate(now()),row.id]);
    // Completing hosted Checkout does not itself prove an invoice was paid.
    return{completed:true};
   });
  },
  async expireCheckout(accountId,sessionId){
   requireAccount(accountId);if(!stripeId(sessionId,config.livemode?'cs_live':'cs_test'))throw identity();
   // Invoke only after retrieving this provider session and verifying "expired".
   return tx(async c=>{
    await lockAccount(c,accountId);
    const row=(await c.query('SELECT id,provider_customer_id,status FROM billing_checkout_attempts WHERE account_id=? AND stripe_account_id=? AND livemode=? AND provider_session_id=? FOR UPDATE',[accountId,...scope,sessionId]))[0];
    if(!row||row.provider_customer_id!==await customer(c,accountId))throw identity();
    if(row.status==='completed')return{expired:false};
    if(row.status!=='expired')await c.query("UPDATE billing_checkout_attempts SET status='expired',finished_at=? WHERE id=?",[sqlDate(now()),row.id]);
    return{expired:true};
   });
  },
  async applySubscription(event,loadCurrent){
   if(!event||!billingId(event.accountId)||!stripeId(event.subscriptionId,'sub')||!stripeId(event.eventId,'evt')||typeof event.eventType!=='string'||!/^[a-z][a-z0-9_.]{1,99}$/.test(event.eventType)||event.livemode!==config.livemode||typeof loadCurrent!=='function')throw identity();
   const normalized={...event,eventCreated:billingDate(event.eventCreated,{nullable:false})};
   return tx(c=>apply(c,normalized,loadCurrent,normalized));
  },
  async reconcileSubscription({accountId,subscriptionId}={},loadCurrent){
   requireAccount(accountId);if(!stripeId(subscriptionId,'sub')||typeof loadCurrent!=='function')throw identity();
   return tx(c=>apply(c,{accountId,subscriptionId},loadCurrent));
  },
  async listSubscriptions(limit=100){
   if(!Number.isInteger(limit)||limit<1||limit>1000)throw new BillingError('billing_input','Choose a valid reconciliation batch size.');
   return(await db.query(`SELECT ${subscriptionColumns} FROM member_subscriptions WHERE stripe_account_id=? AND livemode=? AND provider=? ORDER BY COALESCE(last_reconciled_at,'1970-01-01'),id LIMIT ?`,[...scope,config.provider,limit])).map(subscriptionView);
  },
  async duePauseReminders(limit=100){
   if(!Number.isInteger(limit)||limit<1||limit>1000)throw new BillingError('billing_input','Choose a valid reminder batch size.');
   const timestamp=now(),until=new Date(timestamp.getTime()+7*24*60*60*1000);
   return(await db.query(`SELECT ${subscriptionColumns} FROM member_subscriptions WHERE stripe_account_id=? AND livemode=? AND provider=? AND status='paused' AND resume_at>? AND resume_at<=? AND pause_reminder_sent_at IS NULL ORDER BY resume_at,id LIMIT ?`,[...scope,config.provider,sqlDate(timestamp),sqlDate(until),limit])).map(subscriptionView);
  },
  async markPauseReminderSent(accountId,subscriptionId,resumeAt){
   requireAccount(accountId);if(!stripeId(subscriptionId,'sub'))throw identity();
   const expected=billingDate(resumeAt,{nullable:false});
   return tx(async c=>{
    await lockAccount(c,accountId);
    const result=await c.query("UPDATE member_subscriptions SET pause_reminder_sent_at=? WHERE account_id=? AND provider=? AND provider_subscription_id=? AND stripe_account_id=? AND livemode=? AND status='paused' AND resume_at=? AND pause_reminder_sent_at IS NULL",[sqlDate(now()),accountId,config.provider,subscriptionId,...scope,sqlDate(expected)]);
    return{marked:Number(result.affectedRows)===1};
   });
  }
 };
}
