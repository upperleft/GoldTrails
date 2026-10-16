import {createHmac,timingSafeEqual} from 'node:crypto';
import {uuid,eventUrl} from './model.js';
const labels={new_event:'A new gathering near your trail',rsvp:'Your Gold Connections RSVP',reminder:'A gathering is coming up',update:'An event you joined has changed',cancellation:'An event you joined was cancelled',promotion:'A space has opened for you',announcement:'A note from your event organizer'};
export function unsubscribeLinks(secret){
 if(typeof secret!=='string'||secret.length<32)return null;
 const sign=value=>createHmac('sha256',secret).update(value).digest('hex');
 return {token:account=>account+'.'+sign('unsubscribe:'+account),verify(value){if(typeof value!=='string')return null;const[account,hash]=value.split('.');if(!uuid(account)||!(/^[a-f0-9]{64}$/).test(hash||'')||value!==account+'.'+hash)return null;return timingSafeEqual(Buffer.from(hash),Buffer.from(sign('unsubscribe:'+account)))?account:null;},confirmation:value=>sign('confirm:'+value)};
}
export function notificationPayload(job,recipient,{origin,unsubscribe}){
 const e=recipient.event,url=origin+eventUrl(e.id),off=origin+'/connections/unsubscribe/?token='+encodeURIComponent(unsubscribe.token(recipient.accountId));
 return {to:recipient.email,subject:labels[job.kind]+' · Gold Trails',text:labels[job.kind]+'\n\n'+e.title+'\n'+e.startLocal.replace('T',' ')+' ('+e.timeZone+')\n\nView the latest event details, your RSVP and organizer updates:\n'+url+'\n\nYou chose Gold Connections notifications in your account. Turn them off:\n'+off+'\n\nGold Trails · '+origin,headers:{'List-Unsubscribe':'<'+off+'>'}};
}
export function connectionsMail(env=process.env,send=fetch){
 // A separate switch protects verification/password-reset mail from this feature.
 if(env.CONNECTIONS_EMAIL_ENABLED!=='true'||!env.RESEND_API_KEY||!env.MEMBER_MAIL_FROM||/[\r\n]/.test(env.MEMBER_MAIL_FROM))return null;
 return async(payload,key)=>{
  const r=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.MEMBER_MAIL_FROM,to:[payload.to],subject:payload.subject,text:payload.text,headers:payload.headers}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Notification provider unavailable');const result=await r.json();if(typeof result.id!=='string')throw Error('Notification provider did not acknowledge delivery');return result.id;
 };
}
export async function dispatchNotifications({store,send,origin,unsubscribe,limit=20}){
 if(!send||!unsubscribe||!origin?.startsWith('https://'))throw Error('Notification delivery is disabled or not configured');
 return store.withDispatchLock(async()=>{
  const result={sent:0,skipped:0,pending:0,failed:0};await store.enqueueReminders();
  for(let i=0;i<Math.min(20,limit);i++){
   const job=await store.claimNotification();if(!job)break;if(job.waitMs){await new Promise(resolve=>setTimeout(resolve,Math.max(1,job.waitMs)));i--;continue;}
   // Recheck consent and entitlement even when a prior attempt froze a payload.
   const recipient=await store.notificationRecipient(job);
   if(!recipient||job.payload&&job.payload.to!==recipient.email){await store.finishNotification(job.id,'skipped');result.skipped++;continue;}
   const payload=job.payload||await store.freezeNotification(job.id,notificationPayload(job,recipient,{origin,unsubscribe}));
   try{const providerId=await send(payload,'gold-connections/'+job.id);await store.finishNotification(job.id,'sent',providerId);result.sent++;}
   catch{const status=job.attempts>=5?'uncertain':'pending';await store.finishNotification(job.id,status);result[status==='pending'?'pending':'failed']++;}
  }
  return result;
 });
}
