// Opt in only to the empty local 001/002/004/014/015 fixture, sequentially with
// creator-named-invitations-mariadb.integration.mjs; never a production database.
// RUN_CODED_CREATOR_DB_TESTS=true NAMED_CREATOR_DB_SOCKET=/private/tmp/goldtrails-billing-db-.../mysql.sock node --test --test-concurrency=1 tests/creator-coded-invitations-mariadb.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mariadb from 'mariadb';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {createMemberStore} from '../app/member-store.js';
import {digest,hashPassword,verifyPassword} from '../app/admin-auth.js';
import {hasPremiumFeature} from '../app/plus/entitlements.js';

const socket=process.env.NAMED_CREATOR_DB_SOCKET||'';
const enabled=process.env.RUN_CODED_CREATOR_DB_TESTS==='true'&&/^\/private\/tmp\/goldtrails-(?:billing|invitations)-db-[A-Za-z0-9_-]+\/mysql\.sock$/.test(socket);
test('real MariaDB coded invitation signup and secure pending account completion',{skip:!enabled},async t=>{
 const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_creator_named_invitation_test',connectionLimit:6,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
 const ownerId=randomUUID(),personId=randomUUID(),csrf='e'.repeat(64);
 const oldPassword='pre-registration attacker password',newPassword='creator selected replacement password';
 const oldHash=await hashPassword(oldPassword,{minLength:8}),newHash=await hashPassword(newPassword,{minLength:8});
 let seeded=false;
 t.after(async()=>{try{if(seeded){
  for(const table of ['creator_invitation_audit','member_audit_log','member_sessions','member_tokens','creator_invitations','member_creator_connections','member_role_grants','member_profiles','member_memberships','member_subscriptions'])await db.query('DELETE FROM '+table);
  await db.query("UPDATE creator_invitation_settings SET owner_account_id=NULL,configured_by='' WHERE id=1");
  await db.query('DELETE FROM member_accounts');await db.query('DELETE FROM people WHERE id=?',[personId]);
 }}finally{await db.end();}});
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'Only the empty dedicated named-invitation database may be used.');
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM creator_invitations'))[0].n),0);
 assert.equal((await db.query("SELECT version FROM schema_migrations WHERE version='016_stripe_billing'")).length,0,'Current production compatibility fixture must not include future billing schema.');
 seeded=true;
 const seedAccount=async(name,status='pending_verification')=>{
  const id=randomUUID(),email=name+'@example.invalid';
  await db.query('INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at,auth_version) VALUES(?,?,?,?,?,?,7)',[id,name,email,oldHash,status,status==='active'?'2026-01-01 00:00:00':null]);
  await db.query('INSERT INTO member_profiles(account_id,display_name) VALUES(?,?)',[id,'Original '+name]);
  await db.query('INSERT INTO member_memberships(account_id) VALUES(?)',[id]);
  await db.query("INSERT INTO member_role_grants(account_id,role_code) VALUES(?,'member')",[id]);
  return{id,email,username:name};
 };
 await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,'coded_owner','owner@example.invalid',?,'active',UTC_TIMESTAMP(6))",[ownerId,oldHash]);
 await db.query('INSERT INTO member_memberships(account_id) VALUES(?)',[ownerId]);
 await db.query("INSERT INTO people(id,slug,display_name,publication_status) VALUES(?,'coded-creator','Coded Creator','published')",[personId]);
 const store=createCreatorInvitationStore(db),members=createMemberStore(db);
 await store.configureOwner('owner@example.invalid','fixture-owner');
 const issue=email=>store.issue({personId,email,actor:'fixture-owner'});
 const data=(name,extra={})=>({username:name,email:name+'@example.invalid',passwordHash:newHash,displayName:'Creator '+name,csrf,...extra});
 const pending=async invitation=>{
  const row=(await db.query('SELECT consumed_at,accepted_account_id FROM creator_invitations WHERE id=?',[invitation.id]))[0];
  assert.equal(row.consumed_at,null);assert.equal(row.accepted_account_id,null);
 };
 const snapshot=async id=>({
  account:(await db.query('SELECT username,email,password_hash,status,email_verified_at,auth_version,password_changed_at,archived_at FROM member_accounts WHERE id=?',[id]))[0],
  membership:(await db.query('SELECT * FROM member_memberships WHERE account_id=?',[id]))[0],
  sessions:await db.query('SELECT * FROM member_sessions WHERE account_id=? ORDER BY token_hash',[id]),
  tokens:await db.query('SELECT * FROM member_tokens WHERE account_id=? ORDER BY token_hash',[id]),
  profile:await db.query('SELECT * FROM member_profiles WHERE account_id=?',[id]),
  roles:await db.query('SELECT * FROM member_role_grants WHERE account_id=? ORDER BY role_code',[id])
 });
 const failingDb=fail=>({getConnection:async()=>{const c=await db.getConnection();return{beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:async(sql,args)=>{if(fail(sql,args))throw Error('simulated coded invitation failure');return c.query(sql,args);}};}});

 await t.test('a secret creates a verified permanent Plus account and only hashed fresh session',async()=>{
  const invitation=await issue('fresh@example.invalid');
  for(let count=0;count<2;count++)assert.ok(await store.read(invitation.raw));
  assert.equal((await db.query("SELECT id FROM member_accounts WHERE email='fresh@example.invalid'")).length,0,'Invitation reads never create accounts.');
  const joined=await store.join(invitation.raw,data('fresh',{email:' FRESH@EXAMPLE.INVALID '}));
  assert.match(joined.session,/^[a-f0-9]{64}$/);assert.deepEqual(joined.profile,{slug:'coded-creator',display_name:'Coded Creator'});
  const account=(await db.query('SELECT status,email_verified_at,password_hash,auth_version FROM member_accounts WHERE id=?',[joined.accountId]))[0];
  assert.equal(account.status,'active');assert.ok(account.email_verified_at);assert.equal(account.password_hash,newHash);assert.equal(account.auth_version,0);
  const sessions=await db.query('SELECT token_hash,csrf_token_hash,auth_version,expires_at>UTC_TIMESTAMP(6) AS current FROM member_sessions WHERE account_id=?',[joined.accountId]);
  assert.equal(sessions.length,1);assert.equal(sessions[0].token_hash,digest(joined.session));assert.notEqual(sessions[0].token_hash,joined.session);assert.equal(sessions[0].csrf_token_hash,digest(csrf));assert.equal(Number(sessions[0].current),1);
  const session=await members.session(joined.session);assert.equal(session.id,joined.accountId);assert.equal(session.effective_level,'subscriber');assert.equal(session.grant_source,'complimentary');assert.equal(session.ends_at,null);
  assert.equal(await hasPremiumFeature({method:'GET',headers:{cookie:'__Host-gold-member='+joined.session}},{members,guests:null},'almanac'),true);
  const membership=(await db.query('SELECT level,status,grant_source,subscription_id,granted_by,ends_at FROM member_memberships WHERE account_id=?',[joined.accountId]))[0];
  assert.deepEqual(membership,{level:'subscriber',status:'active',grant_source:'complimentary',subscription_id:null,granted_by:ownerId,ends_at:null});
  assert.deepEqual(await db.query('SELECT status,permission FROM member_creator_connections WHERE account_id=?',[joined.accountId]),[{status:'approved',permission:'creator'}]);
  assert.deepEqual(await db.query('SELECT role_code FROM member_role_grants WHERE account_id=?',[joined.accountId]),[{role_code:'member'}]);
  assert.equal((await db.query('SELECT token_hash FROM member_tokens WHERE account_id=?',[joined.accountId])).length,0,'No second verification email token is needed.');
  assert.deepEqual(await store.acceptedProfile(joined.accountId),joined.profile);
  const receipt=(await db.query('SELECT consumed_at,accepted_account_id FROM creator_invitations WHERE id=?',[invitation.id]))[0];assert.ok(receipt.consumed_at);assert.equal(receipt.accepted_account_id,joined.accountId);
  await assert.rejects(()=>store.join(invitation.raw,data('fresh')),e=>e.code==='invitation_unavailable');
 });
 await t.test('invalid and wrong-email secrets cannot probe accounts or create access',async()=>{
  const invitation=await issue('bound@example.invalid');
  await assert.rejects(()=>store.join('f'.repeat(64),data('coded_owner',{email:'owner@example.invalid'})),e=>e.code==='invitation_unavailable');
  await assert.rejects(()=>store.join(invitation.raw,data('wrong')),e=>e.code==='wrong_account');
  await assert.rejects(()=>store.join(invitation.raw,data('coded_owner',{email:'owner@example.invalid'})),e=>e.code==='wrong_account');
  await pending(invitation);assert.equal((await db.query("SELECT id FROM member_accounts WHERE email IN ('bound@example.invalid','wrong@example.invalid')")).length,0);
 });
 await t.test('active, suspended, archived and username conflicts are untouched',async()=>{
  for(const status of ['active','suspended','archived']){
   const existing=await seedAccount('existing_'+status,status==='active'?'active':'pending_verification');
   if(status==='suspended')await db.query("UPDATE member_accounts SET status='suspended' WHERE id=?",[existing.id]);
   if(status==='archived')await db.query('UPDATE member_accounts SET archived_at=UTC_TIMESTAMP(6) WHERE id=?',[existing.id]);
   const invitation=await issue(existing.email),before=await snapshot(existing.id);
   await assert.rejects(()=>store.join(invitation.raw,data('replacement_'+status,{email:existing.email})),e=>e.code==='account_exists');
   assert.deepEqual(await snapshot(existing.id),before);await pending(invitation);
  }
  const collision=await seedAccount('taken_username'),invitation=await issue('unique_email@example.invalid');
  await assert.rejects(()=>store.join(invitation.raw,data('TAKEN_USERNAME',{email:'unique_email@example.invalid'})),e=>e.code==='account_exists');
  assert.equal((await db.query("SELECT id FROM member_accounts WHERE email='unique_email@example.invalid'")).length,0);await pending(invitation);assert.ok(await snapshot(collision.id));
 });
 await t.test('pending completion removes pre-registration credentials, sessions and tokens',async()=>{
  const original=await seedAccount('preregistered'),oldSession='a'.repeat(64),oldToken='b'.repeat(64);
  await db.query('INSERT INTO member_sessions(token_hash,account_id,csrf_token_hash,auth_version,expires_at) VALUES(?,?,?,7,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR))',[digest(oldSession),original.id,digest(csrf)]);
  await db.query("INSERT INTO member_tokens(token_hash,purpose,account_id,expires_at) VALUES(?,'verify_email',?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[digest(oldToken),original.id]);
  const invitation=await issue(original.email),joined=await store.join(invitation.raw,data('real_creator',{email:original.email,displayName:'Real Creator'}));
  assert.equal(joined.accountId,original.id);const account=(await db.query('SELECT username,password_hash,status,email_verified_at,auth_version FROM member_accounts WHERE id=?',[original.id]))[0];
  assert.equal(account.username,'real_creator');assert.equal(account.status,'active');assert.ok(account.email_verified_at);assert.equal(account.auth_version,8);
  assert.equal(await verifyPassword(oldPassword,account.password_hash),false);assert.equal(await verifyPassword(newPassword,account.password_hash),true);
  assert.equal(await members.session(oldSession),null);assert.ok((await db.query('SELECT revoked_at FROM member_sessions WHERE token_hash=?',[digest(oldSession)]))[0].revoked_at);
  assert.ok((await db.query('SELECT revoked_at FROM member_tokens WHERE token_hash=?',[digest(oldToken)]))[0].revoked_at);assert.equal(await members.consume(oldToken,'verify_email'),false);
  const fresh=await members.session(joined.session);assert.equal(fresh.id,original.id);assert.equal(fresh.effective_level,'subscriber');
  assert.deepEqual(await db.query('SELECT display_name FROM member_profiles WHERE account_id=?',[original.id]),[{display_name:'Real Creator'}]);
  assert.deepEqual(await db.query('SELECT role_code FROM member_role_grants WHERE account_id=?',[original.id]),[{role_code:'member'}]);
 });
 await t.test('pending accounts with grants, associations, billing or membership restrictions need recovery',async()=>{
  for(const restriction of ['role','affiliation','subscription','membership','future']){
   const existing=await seedAccount('restricted_'+restriction),invitation=await issue(existing.email);
   if(restriction==='role')await db.query("INSERT INTO member_role_grants(account_id,role_code,revoked_at) VALUES(?,'contributor',UTC_TIMESTAMP(6))",[existing.id]);
   if(restriction==='affiliation')await db.query("INSERT INTO member_creator_connections(account_id,person_id,status) VALUES(?,?,'requested')",[existing.id,personId]);
   if(restriction==='subscription')await db.query("INSERT INTO member_subscriptions(id,account_id,provider,provider_subscription_id,status) VALUES(?,?,'fixture',?,'canceled')",[randomUUID(),existing.id,randomUUID()]);
   if(restriction==='membership')await db.query("UPDATE member_memberships SET status='suspended' WHERE account_id=?",[existing.id]);
   if(restriction==='future')await db.query('UPDATE member_memberships SET starts_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE account_id=?',[existing.id]);
   const before=await snapshot(existing.id);await assert.rejects(()=>store.join(invitation.raw,data('new_'+restriction,{email:existing.email})),e=>e.code==='account_exists');assert.deepEqual(await snapshot(existing.id),before);await pending(invitation);
  }
 });
 await t.test('expiry, revocation, publication and owner eligibility block signup',async()=>{
  for(const restriction of ['expired','revoked','reissued','draft','sample','archived','owner']){
   const name='invalid_'+restriction,invitation=await issue(name+'@example.invalid');
   if(restriction==='expired')await db.query('UPDATE creator_invitations SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY),expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE id=?',[invitation.id]);
   if(restriction==='revoked')await store.revoke(invitation.id,'fixture-owner');
   if(restriction==='reissued')await issue(name+'@example.invalid');
   if(restriction==='draft')await db.query("UPDATE people SET publication_status='draft' WHERE id=?",[personId]);
   if(restriction==='sample')await db.query('UPDATE people SET is_sample=TRUE WHERE id=?',[personId]);
   if(restriction==='archived')await db.query('UPDATE people SET archived_at=UTC_TIMESTAMP(6) WHERE id=?',[personId]);
   if(restriction==='owner')await db.query("UPDATE member_accounts SET status='suspended' WHERE id=?",[ownerId]);
   await assert.rejects(()=>store.join(invitation.raw,data(name)),e=>['invitation_unavailable','creator_unavailable','owner_unavailable'].includes(e.code));
   assert.equal((await db.query('SELECT id FROM member_accounts WHERE email=?',[name+'@example.invalid'])).length,0);
   await db.query("UPDATE people SET publication_status='published',is_sample=FALSE,archived_at=NULL WHERE id=?",[personId]);await db.query("UPDATE member_accounts SET status='active' WHERE id=?",[ownerId]);
  }
 });
 await t.test('concurrent secret signups consume once and create only one account/session',async()=>{
  const invitation=await issue('raced@example.invalid');
  const results=await Promise.allSettled([store.join(invitation.raw,data('raced')),store.join(invitation.raw,data('raced'))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='invitation_unavailable').length,1);
  const rows=await db.query("SELECT a.id FROM member_accounts a WHERE email='raced@example.invalid'");assert.equal(rows.length,1);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_sessions WHERE account_id=?',[rows[0].id]))[0].n),1);
 });
 await t.test('ordinary signup racing coded signup cannot retain an attacker password on an accepted account',async()=>{
  const invitation=await issue('ordinary_race@example.invalid');
  const [joined,ordinary]=await Promise.allSettled([
   store.join(invitation.raw,data('ordinary_race')),
   members.signup({username:'ordinary_race',email:'ordinary_race@example.invalid',passwordHash:oldHash,displayName:'Pre-registered name'})
  ]);
  const accounts=await db.query("SELECT id,status,password_hash,email_verified_at FROM member_accounts WHERE email='ordinary_race@example.invalid'");
  assert.equal(accounts.length,1,'The unique email constraint survives a signup outside the invitation lock.');
  if(joined.status==='fulfilled'){
   assert.equal(accounts[0].status,'active');assert.equal(accounts[0].password_hash,newHash);assert.ok(accounts[0].email_verified_at);
   assert.equal((await members.session(joined.value.session)).effective_level,'subscriber');
   if(ordinary.status==='rejected')assert.ok(['ER_DUP_ENTRY','ER_LOCK_DEADLOCK'].includes(ordinary.reason.code));
  }else{
   assert.equal(ordinary.status,'fulfilled');assert.ok(['account_exists','ER_LOCK_DEADLOCK'].includes(joined.reason.code));
   assert.equal(accounts[0].status,'pending_verification');assert.equal(accounts[0].password_hash,oldHash);assert.equal(accounts[0].email_verified_at,null);await pending(invitation);
   assert.equal((await db.query('SELECT level FROM member_memberships WHERE account_id=?',[accounts[0].id]))[0].level,'free');
   assert.equal((await db.query('SELECT token_hash FROM member_sessions WHERE account_id=?',[accounts[0].id])).length,0);
  }
 });
 await t.test('late audit or session failures roll back every fresh-account write',async()=>{
  for(const stage of ['accept_audit','session','login']){
   const name='rollback_'+stage,invitation=await issue(name+'@example.invalid');
   const failing=createCreatorInvitationStore(failingDb(sql=>stage==='accept_audit'?sql.startsWith('INSERT INTO creator_invitation_audit'):stage==='session'?sql.startsWith('INSERT INTO member_sessions'):sql.includes("VALUES(?,?,'login')")));
   await assert.rejects(()=>failing.join(invitation.raw,data(name)),/simulated coded invitation failure/);
   assert.equal((await db.query('SELECT id FROM member_accounts WHERE email=?',[name+'@example.invalid'])).length,0);await pending(invitation);
   assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM creator_invitation_audit WHERE invitation_id=? AND action='accept'",[invitation.id]))[0].n),0);
  }
 });
 await t.test('late pending-completion failure restores original credentials and recovery tokens',async()=>{
  const original=await seedAccount('pending_rollback'),oldToken='c'.repeat(64),oldSession='d'.repeat(64);
  await db.query("INSERT INTO member_tokens(token_hash,purpose,account_id,expires_at) VALUES(?,'verify_email',?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[digest(oldToken),original.id]);
  await db.query('INSERT INTO member_sessions(token_hash,account_id,csrf_token_hash,auth_version,expires_at) VALUES(?,?,?,7,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 HOUR))',[digest(oldSession),original.id,digest(csrf)]);
  const invitation=await issue(original.email),before=await snapshot(original.id),failing=createCreatorInvitationStore(failingDb(sql=>sql.startsWith('INSERT INTO member_sessions')));
  await assert.rejects(()=>failing.join(invitation.raw,data('replacement_pending',{email:original.email})),/simulated coded invitation failure/);
  assert.deepEqual(await snapshot(original.id),before);await pending(invitation);assert.equal((await db.query('SELECT person_id FROM member_creator_connections WHERE account_id=?',[original.id])).length,0);
 });
 await t.test('an invitation expiring immediately before consumption rolls back account and grant',async()=>{
  const invitation=await issue('crossed_expiry@example.invalid');
  const expiring={getConnection:async()=>{const c=await db.getConnection();return{beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:async(sql,args)=>{
   if(sql.startsWith('UPDATE creator_invitations SET consumed_at'))await c.query('UPDATE creator_invitations SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY),expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE id=?',[invitation.id]);
   return c.query(sql,args);
  }};}};
  await assert.rejects(()=>createCreatorInvitationStore(expiring).join(invitation.raw,data('crossed_expiry')),e=>e.code==='invitation_unavailable');
  assert.equal((await db.query("SELECT id FROM member_accounts WHERE email='crossed_expiry@example.invalid'")).length,0);await pending(invitation);assert.ok(await store.read(invitation.raw),'The simulated expiry mutation also rolls back.');
 });
});
