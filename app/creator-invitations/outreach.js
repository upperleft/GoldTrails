import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {digest,token} from '../admin-auth.js';
import {CreatorInvitationError,invitationActor,invitationEmail,invitationId} from './model.js';

const contacts=JSON.parse(readFileSync(new URL('./contacts.json',import.meta.url),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('../creator-catalog.json',import.meta.url),'utf8'));
export const creatorOutreachContact=slug=>{
 const contact=contacts.find(row=>row.slug===slug);
 return contact?{...contact,email:invitationEmail(contact.email)}:null;
};
const error=(code,message,status=409)=>new CreatorInvitationError(code,message,status);
const resultId=operationId=>{
 const hash=digest(operationId+':result').slice(0,32);
 return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-${((parseInt(hash[16],16)&3)|8).toString(16)}${hash.slice(17,20)}-${hash.slice(20)}`;
};
const dateValue=value=>value instanceof Date?value.getTime():new Date(/Z$|[+-]\d\d:\d\d$/.test(String(value))?value:String(value).replace(' ','T')+'Z').getTime();
const fractional=value=>String(value instanceof Date?value.toISOString():value).match(/\.(\d+)/)?.[1].padEnd(6,'0').slice(0,6)||'000000';
const auditOrder=(a,b)=>dateValue(b.created_at)-dateValue(a.created_at)||fractional(b.created_at).localeCompare(fractional(a.created_at))||String(b.id).localeCompare(String(a.id));
const mailActions=['email_attempt','email_sent','email_failed','email_uncertain'];
const suppressionActions=['email_opted_out','email_declined','email_allowed'];
// A creator's refusal follows the person even if a later request changes email.
const latestSuppression=events=>events.filter(e=>suppressionActions.includes(e.action)).sort(auditOrder)[0];
const unresolvedAttempt=events=>{
 const ids=new Map(events.map(e=>[e.id,e]));
 return events.find(e=>e.action==='email_uncertain'||e.action==='email_attempt'&&!['email_sent','email_failed'].includes(ids.get(resultId(e.id))?.action));
};
const blockedReason=(events,pendingReply)=>{
 const suppression=latestSuppression(events);
 if(suppression?.action==='email_opted_out')return 'This recipient opted out of further invitations.';
 if(suppression?.action==='email_declined')return 'This recipient declined the invitation.';
 if(pendingReply)return 'Review the new email reply before sending another invitation.';
 const unresolved=unresolvedAttempt(events);
 if(unresolved)return unresolved.action==='email_attempt'&&!events.some(e=>e.id===resultId(unresolved.id))?'A previous send has no confirmed result. Review it before sending again.':'A previous send is uncertain. Review provider records before sending again.';
 return '';
};

export function createCreatorOutreachStore(db){
 const tx=async fn=>{const c=await db.getConnection();try{await c.beginTransaction();const value=await fn(c);await c.commit();return value;}catch(e){await c.rollback();throw e;}finally{c.release();}};
 const owner=async c=>{
  const settings=(await c.query('SELECT owner_account_id FROM creator_invitation_settings WHERE id=1 FOR UPDATE'))[0];
  if(!settings?.owner_account_id)throw error('owner_required','Set your verified invitation account before sending invitations.');
  const account=(await c.query("SELECT id,email,username FROM member_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL AND archived_at IS NULL FOR UPDATE",[settings.owner_account_id]))[0];
  if(!account)throw error('owner_unavailable','Your verified invitation account needs attention before sending.');
  return account;
 };
 const audit=(c,{id=randomUUID(),invitationId,accountId,actor,action,createdAt=null})=>createdAt?c.query('INSERT INTO creator_invitation_audit(id,invitation_id,actor_account_id,actor_label,action,created_at) VALUES(?,?,?,?,?,?)',[id,invitationId,accountId,actor,action,createdAt]):c.query('INSERT INTO creator_invitation_audit(id,invitation_id,actor_account_id,actor_label,action) VALUES(?,?,?,?,?)',[id,invitationId,accountId,actor,action]);
 const creatorEvents=(c,personId)=>c.query("SELECT a.id,a.invitation_id,a.actor_account_id,a.action,a.created_at,i.target_email FROM creator_invitation_audit a JOIN creator_invitations i ON i.id=a.invitation_id WHERE i.person_id=? AND a.action LIKE 'email\\_%' ORDER BY a.created_at DESC,a.id DESC FOR UPDATE",[personId]);
 const repliesReady=async c=>(await c.query("SELECT version FROM schema_migrations WHERE version='015_creator_reply_references'")).length>0;
 const hasNewReply=async(c,personId,email)=>await repliesReady(c)&&(await c.query("SELECT id FROM creator_reply_references WHERE status='new' AND (person_id=? OR from_email=?) LIMIT 1",[personId,email])).length>0;
 return {
  async overview(){
   const people=await db.query('SELECT id,slug,display_name,publication_status,archived_at,is_sample FROM people ORDER BY display_name');
   const invitations=await db.query("SELECT id,person_id,target_email,invited_by,created_at,expires_at,consumed_at,revoked_at,accepted_account_id,CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN consumed_at IS NOT NULL THEN 'accepted' WHEN expires_at<=UTC_TIMESTAMP(6) THEN 'expired' ELSE 'pending' END AS status FROM creator_invitations ORDER BY created_at DESC,id DESC");
   const events=await db.query("SELECT a.id,a.invitation_id,a.action,a.created_at,i.person_id,i.target_email FROM creator_invitation_audit a JOIN creator_invitations i ON i.id=a.invitation_id WHERE a.action LIKE 'email\\_%' ORDER BY a.created_at DESC,a.id DESC");
   const replies=await repliesReady(db)?await db.query("SELECT person_id,from_email FROM creator_reply_references WHERE status='new'"):[];
   const allSlugs=new Set(people.map(p=>p.slug));
   const roster=people.filter(p=>!p.archived_at&&!Number(p.is_sample)).map(p=>({...p}));
   for(const p of catalog)if(!allSlugs.has(p.slug))roster.push({id:null,slug:p.slug,display_name:p.name,publication_status:'catalog'});
   const outreachCreators=roster.sort((a,b)=>a.display_name.localeCompare(b.display_name)).map(p=>{
    const history=invitations.filter(i=>i.person_id===p.id);
    const invitation=history[0]||null,contact=creatorOutreachContact(p.slug);
    const email=invitation?.target_email||contact?.email||'';
    const activity=events.filter(e=>e.person_id===p.id).sort(auditOrder);
    let latest=activity.find(e=>mailActions.includes(e.action));
    if(latest?.action==='email_attempt')latest=activity.find(e=>e.id===resultId(latest.id))||latest;
    const sent=activity.find(e=>e.action==='email_sent');
    const accepted=history.find(i=>i.consumed_at&&i.accepted_account_id);
    const reply=replies.some(r=>p.id&&r.person_id===p.id||email&&r.from_email===email);
    const reason=blockedReason(activity,reply);
    const contact_status=latest?({email_attempt:'attempting',email_sent:'sent',email_failed:'failed',email_uncertain:'uncertain'}[latest.action]):'not_contacted';
    return {id:p.id,slug:p.slug,display_name:p.display_name,publication_status:p.publication_status,email,email_source:invitation?'Previously invited account email':contact?.email_source||'',contact_status,last_sent_at:sent?.created_at||null,last_attempted_at:latest?.created_at||null,accepted:Boolean(accepted),accepted_at:accepted?.consumed_at||null,invitation_status:invitation?.status||null,blocked:Boolean(reason),block_reason:reason,operation_id:randomUUID()};
   });
   return {outreachCreators};
  },
  async issueForEmail({personId,email,actor,operationId}){
   email=invitationEmail(email);actor=invitationActor(actor);
   if(!invitationId(personId)||!invitationId(operationId))throw error('input','Choose a creator and refresh the invitation form.',400);
   return tx(async c=>{
    const o=await owner(c);
    if((await c.query('SELECT id FROM creator_invitation_audit WHERE id=? FOR UPDATE',[operationId])).length)throw error('send_already_attempted','This send was already submitted. Refresh the page to review its result.');
    const p=(await c.query("SELECT id,slug,display_name FROM people WHERE id=? AND is_sample=FALSE AND archived_at IS NULL AND publication_status='published' FOR UPDATE",[personId]))[0];
    if(!p)throw error('creator_unavailable','Publish this creator profile before sending an invitation.');
    if((await c.query('SELECT id FROM creator_invitations WHERE person_id=? AND consumed_at IS NOT NULL LIMIT 1 FOR UPDATE',[p.id])).length)throw error('invitation_accepted','This creator has already accepted a complimentary account invitation.');
    const events=await creatorEvents(c,p.id);
    const reason=blockedReason(events,await hasNewReply(c,p.id,email));
    if(reason)throw error('outreach_blocked',reason);
    const id=randomUUID(),raw=token();
    // Pending links remain usable: a manual resend must not invalidate an earlier email.
    await c.query('INSERT INTO creator_invitations(id,token_hash,target_email,person_id,invited_by,actor_label,expires_at) VALUES(?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 14 DAY))',[id,digest(raw),email,p.id,o.id,actor]);
    await audit(c,{invitationId:id,accountId:o.id,actor,action:'issue'});
    await audit(c,{id:operationId,invitationId:id,accountId:o.id,actor,action:'email_attempt'});
    const dates=(await c.query('SELECT expires_at FROM creator_invitations WHERE id=?',[id]))[0];
    return {id,raw,target_email:email,person_id:p.id,display_name:p.display_name,slug:p.slug,expires_at:dates.expires_at};
   });
  },
  async recordMailResult({operationId,status,actor}){
   actor=invitationActor(actor);
   if(!invitationId(operationId)||!['sent','failed','uncertain'].includes(status))throw error('input','Choose a valid send result.',400);
   return tx(async c=>{
    const o=await owner(c);
    const attempt=(await c.query('SELECT id,invitation_id,actor_account_id,action FROM creator_invitation_audit WHERE id=? FOR UPDATE',[operationId]))[0];
    if(!attempt||attempt.action!=='email_attempt'||attempt.actor_account_id!==o.id)throw error('send_unavailable','The send attempt is unavailable for this invitation account.');
    const id=resultId(operationId),action='email_'+status;
    const existing=(await c.query('SELECT invitation_id,actor_account_id,action FROM creator_invitation_audit WHERE id=? FOR UPDATE',[id]))[0];
    if(existing){
     if(existing.invitation_id!==attempt.invitation_id||existing.actor_account_id!==o.id||existing.action!==action)throw error('send_result_conflict','This send already has a recorded result. Review it before continuing.');
     return {recorded:false,status};
    }
    await audit(c,{id,invitationId:attempt.invitation_id,accountId:o.id,actor,action});
    return {recorded:true,status};
   });
  },
  async suppress({personId,email,status,actor}){
   email=invitationEmail(email);actor=invitationActor(actor);
   if(!invitationId(personId)||!['declined','opted_out'].includes(status))throw error('input','Choose a valid creator response.',400);
   return tx(async c=>{
    const o=await owner(c);
    const i=(await c.query('SELECT id FROM creator_invitations WHERE person_id=? AND target_email=? ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',[personId,email]))[0];
    if(!i)throw error('invitation_required','This email has no invitation record to attach the response to.');
    await audit(c,{invitationId:i.id,accountId:o.id,actor,action:'email_'+status});
    return {suppressed:true,status};
   });
  },
  async importSent(records,actor){
   actor=invitationActor(actor);
   if(!Array.isArray(records)||!records.length||records.length>100)throw error('input','Supply between 1 and 100 reviewed sent receipts.',400);
   const ids=new Set(),now=Date.now();
   const checked=records.map(r=>{
    if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['id','invitation_id','email','sent_at'].includes(k))||!invitationId(r.id)||!invitationId(r.invitation_id)||ids.has(r.id)||typeof r.sent_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(r.sent_at))throw error('input','Check the sent receipt identifiers and UTC timestamps.',400);
    ids.add(r.id);
    const timestamp=new Date(r.sent_at),canonical=r.sent_at.includes('.')?r.sent_at:r.sent_at.replace('Z','.000Z');
    if(!Number.isFinite(timestamp.getTime())||timestamp.toISOString()!==canonical||timestamp.getTime()>now||timestamp.getTime()<Date.UTC(2000,0,1))throw error('input','Use valid past UTC sent timestamps.',400);
    return {...r,email:invitationEmail(r.email),sent_at:timestamp.toISOString()};
   });
   return tx(async c=>{
    const o=await owner(c);let imported=0,preserved=0;
    for(const r of checked){
     const i=(await c.query('SELECT id,target_email,invited_by,created_at FROM creator_invitations WHERE id=? FOR UPDATE',[r.invitation_id]))[0];
     if(!i||i.invited_by!==o.id||i.target_email!==r.email||dateValue(i.created_at)>dateValue(r.sent_at))throw error('receipt_mismatch','A receipt does not match this invitation account, email or invitation date.');
     const existing=(await c.query('SELECT invitation_id,actor_account_id,action,created_at FROM creator_invitation_audit WHERE id=? FOR UPDATE',[r.id]))[0];
     if(existing){
      if(existing.invitation_id!==i.id||existing.actor_account_id!==o.id||existing.action!=='email_sent'||dateValue(existing.created_at)!==dateValue(r.sent_at))throw error('receipt_conflict','This receipt identifier already refers to a different record.');
      preserved++;continue;
     }
     await audit(c,{id:r.id,invitationId:i.id,accountId:o.id,actor,action:'email_sent',createdAt:r.sent_at.replace('T',' ').replace('Z','')});imported++;
    }
    return {imported,preserved};
   });
  }
 };
}
