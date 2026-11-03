import {randomUUID} from 'node:crypto';
import {digest,token} from '../admin-auth.js';
import {CreatorInvitationError,invitationActor,invitationEmail,invitationId,invitationSlug,invitationToken,invitationJoinInput} from './model.js';

const unavailable=()=>new CreatorInvitationError('invitation_unavailable','This invitation has ended or is no longer available. Ask Paul for a new invitation.',410);
const wrongAccount=()=>new CreatorInvitationError('wrong_account','Sign in with the verified account that received this invitation.',403);
const ownerUnavailable=()=>new CreatorInvitationError('owner_unavailable','The invitation owner account needs attention before invitations can be used.',409);
const accountExists=()=>new CreatorInvitationError('account_exists','You already have a verified Gold Trails account at this email. Sign in to accept your invitation. This invitation has not been used.',409);
const accountUnavailable=()=>new CreatorInvitationError('account_unavailable','This account needs help from Paul before the invitation can be accepted. This invitation has not been used.',409);
const existingAccountError=account=>account.status==='active'&&account.email_verified_at&&!account.archived_at?accountExists():accountUnavailable();
const usernameUnavailable=()=>new CreatorInvitationError('username_unavailable','That username is already in use. Choose another username to set up your account. This invitation has not been used.',400);
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
 const secretInvitation=async(c,raw)=>(await c.query('SELECT id,target_email,person_id,invited_by FROM creator_invitations WHERE token_hash=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE',[digest(raw)]))[0];
 // Every acceptance path shares these checks and writes on its caller's locked
 // connection; account creation and session issuance never open nested transactions.
 const grantInvitation=async(c,o,a,i,profile=null)=>{
  if(!i||i.invited_by!==o.id)throw unavailable();
  if(a.email!==i.target_email)throw wrongAccount();
  const p=profile||await creator(c,i.person_id);
  const m=(await c.query('SELECT level,status,grant_source,granted_by,starts_at,ends_at FROM member_memberships WHERE account_id=? FOR UPDATE',[a.id]))[0];
  if(!m||m.status==='suspended')throw new CreatorInvitationError('membership_suspended','Your membership needs owner review before this invitation can be accepted.',409);
  const subscriptions=await c.query("SELECT id FROM member_subscriptions WHERE account_id=? AND status IN ('pending','active','trialing','past_due','incomplete','unpaid','paused','unknown') FOR UPDATE",[a.id]);
  if(subscriptions.length)throw new CreatorInvitationError('billing_resolution_required','Ask Paul to resolve your existing subscription before accepting complimentary creator access. This invitation has not been used.',409);
  // Production 014/015 has no billing tables. Keep that schema working, while
  // a later billing installation must also resolve provider checkouts first.
  const billingReady=await c.query("SELECT version FROM schema_migrations WHERE version='016_stripe_billing'");
  if(billingReady.length){
   const checkouts=await c.query("SELECT id FROM billing_checkout_attempts WHERE account_id=? AND status IN ('creating','open') FOR UPDATE",[a.id]);
   if(checkouts.length)throw new CreatorInvitationError('billing_resolution_required','Finish or cancel your existing checkout with Paul before accepting complimentary creator access. This invitation has not been used.',409);
  }
  const affiliation=(await c.query('SELECT status,permission FROM member_creator_connections WHERE account_id=? AND person_id=? FOR UPDATE',[a.id,p.id]))[0];
  if(affiliation&&['revoked','rejected'].includes(affiliation.status))throw new CreatorInvitationError('affiliation_blocked','This creator association needs owner review before an invitation can be accepted.',409);
  if(!affiliation)await c.query("INSERT INTO member_creator_connections(account_id,person_id,status,permission,reviewed_by,reviewed_at,review_note) VALUES(?,?,'approved','creator',?,UTC_TIMESTAMP(6),'Accepted owner-issued creator invitation')",[a.id,p.id,o.id]);
  else if(affiliation.status!=='approved')await c.query("UPDATE member_creator_connections SET status='approved',permission='creator',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(6),review_note='Accepted owner-issued creator invitation' WHERE account_id=? AND person_id=?",[o.id,a.id,p.id]);
  if(m.level==='subscriber'&&m.status==='active'&&m.grant_source==='complimentary'&&m.granted_by){
   await c.query('UPDATE member_memberships SET starts_at=LEAST(starts_at,UTC_TIMESTAMP(6)),ends_at=NULL WHERE account_id=?',[a.id]);
  }else await c.query("UPDATE member_memberships SET level='subscriber',status='active',grant_source='complimentary',subscription_id=NULL,granted_by=?,starts_at=UTC_TIMESTAMP(6),ends_at=NULL WHERE account_id=?",[o.id,a.id]);
  const consumed=await c.query('UPDATE creator_invitations SET consumed_at=UTC_TIMESTAMP(6),accepted_account_id=? WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6)',[a.id,i.id]);
  if(Number(consumed.affectedRows)!==1)throw unavailable();
  await audit(c,i.id,a.id,'member:'+a.username,'accept');
  await c.query("INSERT INTO member_audit_log(id,account_id,actor_account_id,action) VALUES(?,?,?,'creator_invitation_accepted')",[randomUUID(),a.id,o.id]);
  return{person_id:p.id,display_name:p.display_name,slug:p.slug};
 };
 // Both existing-account entry points retain the settings -> owner -> recipient
 // account lock order and require an already active, verified signed-in account.
 const acceptInvitation=async(accountId,resolve)=>tx(async c=>{
  const s=await settings(c),o=await owner(c,s),a=await activeAccount(c,accountId);
  if(!a)throw wrongAccount();
  return grantInvitation(c,o,a,await resolve(c,o,a));
 });
 return {
  async ready(){return(await db.query("SELECT version FROM schema_migrations WHERE version='014_creator_invitations'")).length===1;},
  async acceptedProfile(accountId){
   if(!invitationId(accountId))return null;
   // Accepted grants belong to the recipient account permanently; the original
   // invitation's expiry and the owner's later account status do not govern them.
   return(await db.query("SELECT p.slug,p.display_name FROM member_accounts a JOIN member_memberships m ON m.account_id=a.id JOIN creator_invitations i ON i.accepted_account_id=a.id AND i.consumed_at IS NOT NULL JOIN member_creator_connections c ON c.account_id=a.id AND c.person_id=i.person_id AND c.status='approved' JOIN people p ON p.id=i.person_id WHERE a.id=? AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.archived_at IS NULL AND m.level='subscriber' AND m.status='active' AND m.grant_source='complimentary' AND m.granted_by IS NOT NULL AND m.starts_at<=UTC_TIMESTAMP(6) AND (m.ends_at IS NULL OR m.ends_at>UTC_TIMESTAMP(6)) AND p.publication_status='published' AND p.is_sample=FALSE AND p.archived_at IS NULL ORDER BY i.consumed_at DESC,i.id DESC LIMIT 1",[accountId]))[0]||null;
  },
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
   // Only a valid private token can return recipient fields. Reading never
   // consumes or changes the invitation or authenticates an account.
   return(await db.query(`SELECT i.id,i.target_email,i.person_id,p.display_name,p.slug,i.expires_at FROM creator_invitations i JOIN people p ON p.id=i.person_id JOIN creator_invitation_settings s ON s.id=1 AND s.owner_account_id=i.invited_by JOIN member_accounts o ON o.id=i.invited_by WHERE i.token_hash=? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>UTC_TIMESTAMP(6) AND p.is_sample=FALSE AND p.archived_at IS NULL AND p.publication_status='published' AND o.status='active' AND o.email_verified_at IS NOT NULL AND o.archived_at IS NULL`,[digest(raw)]))[0]||null;
  },
  async recipientState(raw){
   if(!invitationToken(raw))return null;
   // Only a valid private invitation can distinguish account setup from sign-in.
   // This is presentation context, never authentication or a membership grant.
   const row=(await db.query("SELECT CASE WHEN a.id IS NULL THEN 'new' WHEN a.status='active' AND a.email_verified_at IS NOT NULL AND a.archived_at IS NULL THEN 'active' WHEN a.status='pending_verification' AND a.email_verified_at IS NULL AND a.archived_at IS NULL THEN 'pending' ELSE 'blocked' END AS state FROM creator_invitations i JOIN people p ON p.id=i.person_id JOIN creator_invitation_settings s ON s.id=1 AND s.owner_account_id=i.invited_by JOIN member_accounts o ON o.id=i.invited_by LEFT JOIN member_accounts a ON a.email=i.target_email WHERE i.token_hash=? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>UTC_TIMESTAMP(6) AND p.is_sample=FALSE AND p.archived_at IS NULL AND p.publication_status='published' AND o.status='active' AND o.email_verified_at IS NOT NULL AND o.archived_at IS NULL",[digest(raw)]))[0];
   return row?.state||null;
  },
  async accepted(raw){
   if(!invitationToken(raw))return null;
   // A consumed receipt helps route a returning visitor to ordinary sign-in.
   // It supplies no session or grant and remains a receipt after link expiry.
   return(await db.query('SELECT i.accepted_account_id AS accountId,p.slug FROM creator_invitations i JOIN people p ON p.id=i.person_id WHERE i.token_hash=? AND i.consumed_at IS NOT NULL AND i.accepted_account_id IS NOT NULL LIMIT 1',[digest(raw)]))[0]||null;
  },
  async readNamed(slug,accountId=null){
   if(!invitationSlug(slug))return null;
   // Conditional projection prevents anonymous/wrong-account reads from ever
   // returning recipient email addresses, invitation IDs or token material.
   // Matching the verified recipient sorts ahead of all other pending emails.
   const row=(await db.query(`SELECT CASE WHEN a.id IS NOT NULL AND a.email=i.target_email THEN i.id ELSE NULL END AS id,CASE WHEN a.id IS NOT NULL AND a.email=i.target_email THEN i.target_email ELSE NULL END AS target_email,i.person_id,p.display_name,p.slug,i.expires_at,CASE WHEN a.id IS NOT NULL AND a.email=i.target_email THEN 1 ELSE 0 END AS matched FROM creator_invitations i JOIN people p ON p.id=i.person_id JOIN creator_invitation_settings s ON s.id=1 AND s.owner_account_id=i.invited_by JOIN member_accounts o ON o.id=i.invited_by LEFT JOIN member_accounts a ON a.id=? AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.archived_at IS NULL WHERE p.slug=? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>UTC_TIMESTAMP(6) AND p.is_sample=FALSE AND p.archived_at IS NULL AND p.publication_status='published' AND o.status='active' AND o.email_verified_at IS NOT NULL AND o.archived_at IS NULL ORDER BY matched DESC,i.expires_at DESC,i.created_at DESC,i.id DESC LIMIT 1`,[invitationId(accountId)?accountId:null,slug]))[0];
   return row?{...row,named:true,matched:Boolean(Number(row.matched))}:null;
  },
  async accept(raw,accountId){
   if(!invitationToken(raw)||!invitationId(accountId))throw unavailable();
   return acceptInvitation(accountId,c=>secretInvitation(c,raw));
  },
  async join(raw,input){
   if(!invitationToken(raw))throw unavailable();
   const data=invitationJoinInput(input);
   return tx(async c=>{
    const s=await settings(c),o=await owner(c,s);
    // Include archived and unverified accounts. A duplicate must never silently
    // adopt an existing password or reveal account existence to an invalid link.
    const previous=(await c.query('SELECT id,email,username,status,email_verified_at,auth_version,archived_at FROM member_accounts WHERE email=? FOR UPDATE',[data.email]))[0];
    const username=(await c.query('SELECT id FROM member_accounts WHERE username=? FOR UPDATE',[data.username]))[0];
    const i=await secretInvitation(c,raw);
    if(!i||i.invited_by!==o.id)throw unavailable();
    if(data.email!==i.target_email)throw wrongAccount();
    const p=await creator(c,i.person_id);
    if(previous&&(previous.status!=='pending_verification'||previous.email_verified_at||previous.archived_at))throw existingAccountError(previous);
    let id=previous?.id||randomUUID(),version=0;
    if(previous){
     // A mailbox-delivered secret can finish an untouched pending account only
     // after replacing every attacker-known credential and revoking old access.
     const m=(await c.query('SELECT level,status,grant_source,subscription_id,granted_by,ends_at,starts_at>UTC_TIMESTAMP(6) AS future_start FROM member_memberships WHERE account_id=? FOR UPDATE',[id]))[0];
     if(!m||m.level!=='free'||m.status!=='active'||m.grant_source!=='free'||m.subscription_id||m.granted_by||m.ends_at||Number(m.future_start))throw accountUnavailable();
     const roles=await c.query("SELECT role_code FROM member_role_grants WHERE account_id=? AND role_code<>'member' FOR UPDATE",[id]);
     const affiliations=await c.query('SELECT person_id FROM member_creator_connections WHERE account_id=? FOR UPDATE',[id]);
     const subscriptions=await c.query('SELECT id FROM member_subscriptions WHERE account_id=? FOR UPDATE',[id]);
     const billingReady=await c.query("SELECT version FROM schema_migrations WHERE version='016_stripe_billing'");
     const checkouts=billingReady.length?await c.query('SELECT id FROM billing_checkout_attempts WHERE account_id=? FOR UPDATE',[id]):[];
     if(roles.length||affiliations.length||subscriptions.length||checkouts.length)throw accountUnavailable();
     if(username&&username.id!==previous.id)throw usernameUnavailable();
     version=Number(previous.auth_version)+1;
     try{await c.query("UPDATE member_accounts SET username=?,password_hash=?,password_changed_at=UTC_TIMESTAMP(6),auth_version=?,status='active',email_verified_at=UTC_TIMESTAMP(6) WHERE id=?",[data.username,data.passwordHash,version,id]);}catch(error){if(error.code==='ER_DUP_ENTRY')throw usernameUnavailable();throw error;}
     await c.query('UPDATE member_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE account_id=? AND revoked_at IS NULL',[id]);
     await c.query('UPDATE member_tokens SET revoked_at=UTC_TIMESTAMP(6) WHERE account_id=? AND revoked_at IS NULL',[id]);
    }else{
     if(username)throw usernameUnavailable();
     try{await c.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[id,data.username,data.email,data.passwordHash]);}catch(error){
      if(error.code==='ER_DUP_ENTRY'){
       // An ordinary signup may race these locks. Classify only the actual
       // unique constraint conflict, with the invited email taking priority.
       const existing=(await c.query('SELECT status,email_verified_at,archived_at FROM member_accounts WHERE email=? FOR UPDATE',[data.email]))[0];
       if(existing)throw existingAccountError(existing);
       if((await c.query('SELECT id FROM member_accounts WHERE username=? FOR UPDATE',[data.username])).length)throw usernameUnavailable();
      }
      throw error;
     }
     await c.query('INSERT INTO member_memberships(account_id) VALUES(?)',[id]);
    }
    await c.query('INSERT INTO member_profiles(account_id,display_name) VALUES(?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)',[id,data.displayName]);
    await c.query("INSERT INTO member_role_grants(account_id,role_code) VALUES(?,'member') ON DUPLICATE KEY UPDATE revoked_at=NULL",[id]);
    await c.query("INSERT INTO member_audit_log(id,account_id,action) VALUES(?,?,?)",[randomUUID(),id,previous?'creator_invitation_account_completed':'signup']);
    await c.query("INSERT INTO member_audit_log(id,account_id,action) VALUES(?,?,'verify_email_by_invitation')",[randomUUID(),id]);
    const profile=await grantInvitation(c,o,{id,email:data.email,username:data.username},i,p),session=token();
    await c.query('INSERT INTO member_sessions(token_hash,account_id,csrf_token_hash,auth_version,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 8 HOUR))',[digest(session),id,digest(data.csrf),version]);
    await c.query('UPDATE member_accounts SET last_login_at=UTC_TIMESTAMP(6) WHERE id=?',[id]);
    await c.query("INSERT INTO member_audit_log(id,account_id,action) VALUES(?,?,'login')",[randomUUID(),id]);
    return{session,profile:{slug:profile.slug,display_name:profile.display_name},accountId:id};
   });
  },
  async acceptNamed(slug,accountId){
   if(!invitationSlug(slug)||!invitationId(accountId))throw unavailable();
   return acceptInvitation(accountId,async(c,o,a)=>{
    const p=(await c.query(`SELECT id,display_name,slug FROM people WHERE slug=? AND ${visibleCreator} FOR UPDATE`,[slug]))[0];
    if(!p)throw unavailable();
    const i=(await c.query('SELECT id,target_email,person_id,invited_by FROM creator_invitations WHERE person_id=? AND target_email=? AND invited_by=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6) ORDER BY expires_at DESC,created_at DESC,id DESC LIMIT 1 FOR UPDATE',[p.id,a.email,o.id]))[0];
    if(!i&&(await c.query('SELECT id FROM creator_invitations WHERE person_id=? AND invited_by=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6) LIMIT 1 FOR UPDATE',[p.id,o.id])).length)throw wrongAccount();
    return i;
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
