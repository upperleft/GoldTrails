export class BillingError extends Error {
 constructor(code,message,status=400){super(message);this.name='BillingError';this.code=code;this.status=status;}
}

const input=()=>new BillingError('billing_input','The billing information could not be verified.');
const mismatch=()=>new BillingError('billing_identity','The billing account could not be verified.',409);
export const billingId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function stripeId(value,prefix){
 return typeof value==='string'&&value.length<=(prefix==='acct'?64:255)&&new RegExp(`^${prefix}_[A-Za-z0-9_]{1,240}$`).test(value);
}
export function billingDate(value,{nullable=true}={}){
 if(value===null||value===undefined||value===''){if(nullable)return null;throw input();}
 let date;
 if(value instanceof Date)date=new Date(value);
 else if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)date=new Date(value*1000);
 else if(typeof value==='string'&&/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z)?$/.test(value)){
  // DATETIME values from MariaDB are UTC. Never use the host's local timezone.
  date=new Date(value.replace(' ','T').replace(/(\.\d{3})\d+(?=Z?$)/,'$1').replace(/Z?$/,'Z'));
  const parts=value.match(/\d+/g).slice(0,6).map(Number);
  if(parts.some((part,index)=>part!==[date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds()][index]))throw input();
 }else throw input();
 if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<1970||date.getUTCFullYear()>9999)throw input();
 return date;
}
export const sqlDate=value=>value===null?null:billingDate(value,{nullable:false}).toISOString().slice(0,23).replace('T',' ');

export function billingConfig(config={}){
 if(!stripeId(config.stripeAccountId,'acct')||typeof config.livemode!=='boolean'||!stripeId(config.priceId,'price'))throw new BillingError('billing_configuration','Billing is not configured.',503);
 if(config.allowTestEntitlements!==undefined&&typeof config.allowTestEntitlements!=='boolean')throw new BillingError('billing_configuration','Billing is not configured.',503);
 if(config.now!==undefined&&typeof config.now!=='function')throw new BillingError('billing_configuration','Billing is not configured.',503);
 return{...config,provider:config.livemode?'stripe':'stripe_test',allowTestEntitlements:config.allowTestEntitlements===true,now:config.now||(()=>new Date())};
}

const statuses=new Set(['pending','trialing','active','past_due','canceled','expired','incomplete','incomplete_expired','unpaid','paused']);
export function normalizeSubscriptionSnapshot(snapshot,options){
 const config=billingConfig(options);
 if(!snapshot||!billingId(snapshot.accountId)||!stripeId(snapshot.customerId,'cus')||!stripeId(snapshot.subscriptionId,'sub'))throw input();
 if(snapshot.stripeAccountId!==config.stripeAccountId||snapshot.livemode!==config.livemode)throw mismatch();
 if(typeof snapshot.status!=='string'||!/^[a-z_]{1,40}$/.test(snapshot.status)||typeof snapshot.latestInvoicePaid!=='boolean'||typeof snapshot.cancelAtPeriodEnd!=='boolean')throw input();
 const currentPeriodStart=billingDate(snapshot.currentPeriodStart),currentPeriodEnd=billingDate(snapshot.currentPeriodEnd),paidThrough=billingDate(snapshot.paidThrough);
 const pauseAt=billingDate(snapshot.pauseAt),resumeAt=billingDate(snapshot.resumeAt);
 if(currentPeriodStart&&currentPeriodEnd&&currentPeriodEnd<=currentPeriodStart)throw input();
 if((pauseAt&&!resumeAt)||(!pauseAt&&resumeAt)||(pauseAt&&resumeAt<=pauseAt))throw input();
 if(snapshot.scheduleId!=null&&!stripeId(snapshot.scheduleId,'sub_sched'))throw input();
 if(snapshot.latestInvoicePaid&&(!paidThrough||!currentPeriodEnd||!currentPeriodStart||paidThrough<=currentPeriodStart||paidThrough>currentPeriodEnd))throw input();
 // An unexpected provider-side plan must be persisted so it cannot retain access.
 const priceValid=snapshot.priceId===config.priceId&&snapshot.quantity===1&&snapshot.currency==='usd'&&snapshot.unitAmount===500&&snapshot.interval==='month'&&snapshot.intervalCount===1;
 return{...snapshot,status:statuses.has(snapshot.status)?snapshot.status:'unknown',providerStatus:snapshot.status,priceId:stripeId(snapshot.priceId,'price')?snapshot.priceId:null,priceValid,currentPeriodStart,currentPeriodEnd,paidThrough,pauseAt,resumeAt,scheduleId:snapshot.scheduleId||null};
}

export function eligiblePaidSnapshot(snapshot,options,confirmedPaidThrough=snapshot.paidThrough){
 const config=billingConfig(options),now=billingDate(config.now(),{nullable:false});
 const paidThrough=billingDate(confirmedPaidThrough);
 return(config.livemode||config.allowTestEntitlements)&&snapshot.status==='active'&&snapshot.priceValid===true&&!!snapshot.currentPeriodStart&&snapshot.currentPeriodStart<=now&&!!snapshot.currentPeriodEnd&&snapshot.currentPeriodEnd>now&&!!paidThrough&&paidThrough>now;
}

// Service pauses start when the paid period ends. Calendar months retain the UTC
// time and clamp month-end (November 30 + three months = February's last day).
export function threeMonthPause(paidThrough,{now=()=>new Date()}={}){
 const pauseAt=billingDate(paidThrough,{nullable:false});
 if(pauseAt<=billingDate(typeof now==='function'?now():now,{nullable:false}))throw new BillingError('pause_unavailable','A future paid period is required to schedule a pause.',409);
 const resumeAt=new Date(pauseAt),day=resumeAt.getUTCDate();
 resumeAt.setUTCDate(1);resumeAt.setUTCMonth(resumeAt.getUTCMonth()+3);
 const last=new Date(Date.UTC(resumeAt.getUTCFullYear(),resumeAt.getUTCMonth()+1,0)).getUTCDate();
 resumeAt.setUTCDate(Math.min(day,last));
 return{pauseAt,resumeAt};
}
