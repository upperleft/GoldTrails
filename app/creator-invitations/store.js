import {randomUUID} from 'node:crypto';
import {digest,token} from '../admin-auth.js';
import {CreatorInvitationError,invitationActor,invitationEmail,invitationId,invitationToken} from './model.js';

const unavailable=()=>new CreatorInvitationError('invitation_unavailable','This invitation has ended or is no longer available. Ask Paul for a new invitation.',410);
const ownerUnavailable=()=>new CreatorInvitationError('owner_unavailable','The invitation owner account needs attention before invitations can be used.',409);
const visibleCreator="is_sample=FALSE AND archived_at IS NULL AND publication_status='published'";

export function createCreatorInvitationStore(db){
 const tx=async fn=>{const c=await db.getConnection();try{await c.beginTransaction();const result=await fn(c);await c.commit();return result;}catch(error){await c.rollback();throw error;}finally{c.release();}};
 const audit=(c,invitationId,accountId,actor,action)=>c.query('INSERT INTO creator_invitation_audit(id,invitation_id,actor_account_id,actor_label,action) VALUES(?,?,?,?,?)',[randomUUID(),invitationId,accountId,actor,action]);
 // This singleton lock gives issue/reissue/revoke/accept one consistent lock order.
 // The database row is seeded by the migration, never by a public request.
 const settings=async c=>{const row=(await c.query('SELECT owner_account_id FROM creator_invitation_settings WHERE id=1 FOR UPDATE'))[0];if(!row)throw new CreatorInvitationError('owner_required','Configure your verified owner account before creating invitations.',409);return row;};
 const activeAccount=async(c,id)=>{if(!invitationId(id))return null;return(await c.query("SELECT id,email,username FROM member_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL AND archived_at IS NULL FOR UPDATE",[id]))[0]||null;};
 const owner=async(c,s)=>{if(!s.owner_account_id)throw new CreatorInvitationError('owner_required','Configure your verified owner account before creating invitations.',409);const account=await activeAccount(c,s.owner_account_id);if(!account)throw ownerUnavailable();return account;};
 const creator=async(c,id)=>{if(!invitationId(id))throw new CreatorInvitationError('input','Choose an available creator profile.');const row=(await c.query(`SELECT id,display_name,slug FROM people WHERE id=? AND ${visibleCreator} FOR UPDATE`,[id]))[0];if(!row)throw new CreatorInvitationError('creator_unavailable','This creator must have a published profile before an invitation can be used.',409);return row;};
 return {
  async ready(){return(await db.query("SELECT version FROM schema_migrations WHERE version='014_creator_invitations'")).length===1;},
  async overview(){
   const owner=(await db.query("SELECT a.id,a.email,a.username FROM creator_invitation_settings s JOIN member_accounts a ON a.id=s.owner_account_id WHERE s.id=1 AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.archived_at IS NULL"))[0]||null;
   const creators=await db.query(`SELECT id,slug,display_name FROM people WHERE ${visibleCreator} ORDER BY display_name LIMIT 1000`);
   const invitations=await db.query("SELECT i.id,i.target_email,i.person_id,p.display_name,p.slug,i.created_at,i.expires_at,i.consumed_at,i.revoked_at,i.accepted_account_id,CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.consumed_at IS NOT NULL THEN 'accepted' WHEN i.expires_at<=UTC_TIMESTAMP(6) THEN 'expired' ELSE 'pending' END AS status FROM creator_invitations i JOIN people p ON p.id=i.person_id ORDER BY i.created_at DESC,i.id DESC LIMIT 250");
   return{owner,creators,invitations};
  },
  async configureOwner(email,actor){
   email=invitationEmail(email);actor=invitationActor(actor);
   return tx(async c=>{
    const s=await settings(c);
    const account=(await c.query("SELECT id,email,username FROM member_accounts WHERE email=? AND status='active' AND email_verified_at IS NOT NULL AND archived_at IS NULL FOR UPDATE",[email]))[0];
    if(!account)throw new CreatorInvitationError('owner_unavailable','Create and verify your Gold Trails member account first, then enter its email here.',409);
    if(s.owner_account_id!==account.id)await c.query('UPDATE creator_invitations SET revoked_at=UTC_TIMESTAMP(6) WHERE invited_by<>? AND consumed_at IS NULL AND revoked_at IS NULL',[account.id]);
    await c.query('UPDATE creator_invitation_settings SET owner_account_id=?,configured_by=? WHERE id=1',[account.id,actor]);
    await audit(c,null,account.id,actor,'configure_owner');
    return account;
   });
  },
  async issue({personId,email,actor,days=14}){
   email=invitationEmail(email);actor=invitationActor(actor);
   if(!Number.isInteger(days)||days<1||days>30)throw new CreatorInvitationError('input','Use an invitation lifetime of 1–30 days.');
   return tx(async c=>{
    const s=await settings(c),o=await owner(c,s),p=await creator(c,personId);
    // Locking the settings row also serializes invitations to a new email address.
    await c.query('UPDATE creator_invitations SET revoked_at=UTC_TIMESTAMP(6) WHERE person_id=? AND target_email=? AND consumed_at IS NULL AND revoked_at IS NULL',[p.id,email]);
    const id=randomUUID(),raw=token();
    await c.query('INSERT INTO creator_invitations(id,token_hash,target_email,person_id,invited_by,actor_label,expires_at) VALUES(?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? DAY))',[id,digest(raw),email,p.id,o.id,actor,days]);
    await audit(c,id,o.id,actor,'issue');
    const dates=(await c.query('SELECT expires_at FROM creator_invitations WHERE id=?',[id]))[0];
    return{id,raw,target_email:email,person_id:p.id,display_name:p.display_name,slug:p.slug,expires_at:dates.expires_at};
   });
  },
  async read(raw){
   if(!invitationToken(raw))return null;
   // This read never consumes or changes an invitation. Its email stays server-side.
   return(await db.query(`SELECT i.id,i.target_email,i.person_id,p.display_name,p.slug,i.expires_at FROM creator_invitations i JOIN people p ON p.id=i.person_id JOIN creator_invitation_settings s ON s.id=1 AND s.owner_account_id=i.invited_by JOIN member_accounts o ON o.id=i.invited_by WHERE i.token_hash=? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>UTC_TIMESTAMP(6) AND p.is_sample=FALSE AND p.archived_at IS NULL AND p.publication_status='published' AND o.status='active' AND o.email_verified_at IS NOT NULL AND o.archived_at IS NULL`,[digest(raw)]))[0]||null;
  },
  async accept(raw,accountId){
   if(!invitationToken(raw)||!invitationId(accountId))throw unavailable();
   return tx(async c=>{
    const s=await settings(c),o=await owner(c,s);
    const a=await activeAccount(c,accountId);
    if(!a)throw new CreatorInvitationError('wrong_account','Sign in with the verified account that received this invitation.',403);
    const i=(await c.query('SELECT id,target_email,person_id,invited_by FROM creator_invitations WHERE token_hash=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',[digest(raw)]))[0];
    if(!i||i.invited_by!==o.id)throw unavailable();
    if(a.email!==i.target_email)throw new CreatorInvitationError('wrong_account','Sign in with the verified account that received this invitation.',403);
    const p=await creator(c,i.person_id);
    const m=(await c.query('SELECT level,status,grant_source,granted_by,starts_at,ends_at FROM member_memberships WHERE account_id=? FOR UPDATE',[a.id]))[0];
    if(!m||m.status==='suspended')throw new CreatorInvitationError('membership_suspended','Your membership needs owner review before this invitation can be accepted.',409);
    const subscriptions=await c.query("SELECT id FROM member_subscriptions WHERE account_id=? AND status IN ('pending','active','trialing','past_due') FOR UPDATE",[a.id]);
    if(subscriptions.length)throw new CreatorInvitationError('billing_resolution_required','Ask Paul to resolve your existing subscription before accepting complimentary creator access. This invitation has not been used.',409);
    const affiliation=(await c.query('SELECT status,permission FROM member_creator_connections WHERE account_id=? AND person_id=? FOR UPDATE',[a.id,p.id]))[0];
    if(affiliation&&['revoked','rejected'].includes(affiliation.status))throw new CreatorInvitationError('affiliation_blocked','This creator association needs owner review before an invitation can be accepted.',409);
    if(!affiliation)await c.query("INSERT INTO member_creator_connections(account_id,person_id,status,permission,reviewed_by,reviewed_at,review_note) VALUES(?,?,'approved','creator',?,UTC_TIMESTAMP(6),'Accepted owner-issued creator invitation')",[a.id,p.id,o.id]);
    else if(affiliation.status!=='approved')await c.query("UPDATE member_creator_connections SET status='approved',permission='creator',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(6),review_note='Accepted owner-issued creator invitation' WHERE account_id=? AND person_id=?",[o.id,a.id,p.id]);
    // Keep an existing complimentary grant's reviewer and start date when extending it.
    // Otherwise the audited invitation owner is the grantor. No role grants are added.
    if(m.level==='subscriber'&&m.status==='active'&&m.grant_source==='complimentary'&&m.granted_by){
     await c.query('UPDATE member_memberships SET starts_at=LEAST(starts_at,UTC_TIMESTAMP(6)),ends_at=NULL WHERE account_id=?',[a.id]);
    }else await c.query("UPDATE member_memberships SET level='subscriber',status='active',grant_source='complimentary',subscription_id=NULL,granted_by=?,starts_at=UTC_TIMESTAMP(6),ends_at=NULL WHERE account_id=?",[o.id,a.id]);
    await c.query('UPDATE creator_invitations SET consumed_at=UTC_TIMESTAMP(6),accepted_account_id=? WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL',[a.id,i.id]);
    await audit(c,i.id,a.id,'member:'+a.username,'accept');
    await c.query("INSERT INTO member_audit_log(id,account_id,actor_account_id,action) VALUES(?,?,?,'creator_invitation_accepted')",[randomUUID(),a.id,o.id]);
    return{person_id:p.id,display_name:p.display_name,slug:p.slug};
   });
  },
  // Revoking a link is deliberately separate from removing already accepted access.
  async revoke(id,actor){
   if(!invitationId(id))throw new CreatorInvitationError('input','Choose a valid invitation.');actor=invitationActor(actor);
   return tx(async c=>{
    const s=await settings(c),o=await owner(c,s);
    const i=(await c.query('SELECT id,consumed_at,revoked_at FROM creator_invitations WHERE id=? FOR UPDATE',[id]))[0];
    if(!i)throw unavailable();
    if(i.consumed_at)throw new CreatorInvitationError('invitation_accepted','This invitation was already accepted. Revoking a link does not remove account access.',409);
    if(!i.revoked_at){await c.query('UPDATE creator_invitations SET revoked_at=UTC_TIMESTAMP(6) WHERE id=?',[id]);await audit(c,id,o.id,actor,'revoke');}
    return{revoked:true};
   });
  }
 };
}
