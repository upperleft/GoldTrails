// Explicit opt-in only. Requires migrated isolated /private/tmp MariaDB, never Hostinger.
// RUN_CREATOR_INVITATIONS_DB_TESTS=true CREATOR_INVITATIONS_DB_SOCKET=/private/tmp/goldtrails-invitations-db-.../mysql.sock node --test tests/creator-invitations-mariadb.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mariadb from 'mariadb';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {createMemberStore} from '../app/member-store.js';
import {hasPremiumFeature} from '../app/plus/entitlements.js';
import {digest} from '../app/admin-auth.js';

const socket=process.env.CREATOR_INVITATIONS_DB_SOCKET||'';
const enabled=process.env.RUN_CREATOR_INVITATIONS_DB_TESTS==='true'&&/^\/private\/tmp\/goldtrails-invitations-db-[A-Za-z0-9]+\/mysql\.sock$/.test(socket);
test('isolated MariaDB invitation acceptance, expiry, reissue, permission isolation and concurrency',{skip:!enabled},async t=>{
 const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_creator_invitation_test',connectionLimit:5,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
 let seeded=false;
 const ids={owner:randomUUID(),other:randomUUID(),creator:randomUUID(),second:randomUUID(),person:randomUUID(),person2:randomUUID()};
 t.after(async()=>{
  try{if(!seeded)return;
  await db.query('DELETE FROM creator_invitation_audit');await db.query('DELETE FROM member_audit_log');await db.query('DELETE FROM member_sessions');await db.query('DELETE FROM creator_invitations');
  await db.query('DELETE FROM member_creator_connections');await db.query('DELETE FROM member_memberships');await db.query('DELETE FROM member_subscriptions');
  await db.query('UPDATE creator_invitation_settings SET owner_account_id=NULL,configured_by=\'\' WHERE id=1');await db.query('DELETE FROM member_accounts');
  await db.query('DELETE FROM people WHERE id IN (?,?)',[ids.person,ids.person2]);
  }finally{await db.end();}
 });
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'Only an empty isolated test database may be used.');seeded=true;
 for(const name of ['owner','other','creator','second']){
  await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[ids[name],'invitation_test_'+name,name+'@example.invalid','x'.repeat(100)]);
  await db.query('INSERT INTO member_memberships(account_id) VALUES(?)',[ids[name]]);
 }
 for(const [id,name] of [[ids.person,'one'],[ids.person2,'two']])await db.query("INSERT INTO people(id,slug,display_name,publication_status) VALUES(?,?,?,'published')",[id,'creator-invitation-'+name,'Creator '+name]);
 const store=createCreatorInvitationStore(db);assert.equal(await store.ready(),true);
 await assert.rejects(()=>store.issue({personId:ids.person,email:'creator@example.invalid',actor:'owner'}),e=>e.code==='owner_required');
 await store.configureOwner(' OWNER@EXAMPLE.INVALID ','owner');
 const issue=(personId=ids.person,email='creator@example.invalid')=>store.issue({personId,email,actor:'owner'});
 await t.test('read does not consume; reissue replaces old link and stores only digest',async()=>{
  const old=await issue(),fresh=await issue();assert.equal(await store.read(old.raw),null);
  assert.ok(await store.read(fresh.raw));assert.ok(await store.read(fresh.raw));
  const persisted=(await db.query('SELECT token_hash,consumed_at FROM creator_invitations WHERE id=?',[fresh.id]))[0];assert.equal(persisted.token_hash,digest(fresh.raw));assert.equal(persisted.consumed_at,null);
  await store.revoke(fresh.id,'owner');assert.equal(await store.read(fresh.raw),null);
 });
 await t.test('forwarded/wrong email and suspended membership cannot consume',async()=>{
  const i=await issue();await assert.rejects(()=>store.accept(i.raw,ids.other),e=>e.code==='wrong_account');
  await db.query("UPDATE member_memberships SET status='suspended' WHERE account_id=?",[ids.creator]);
  await assert.rejects(()=>store.accept(i.raw,ids.creator),e=>e.code==='membership_suspended');assert.ok(await store.read(i.raw));
  await db.query("UPDATE member_memberships SET status='active' WHERE account_id=?",[ids.creator]);
 });
 await t.test('a late audit failure rolls back grant, affiliation and token consumption',async()=>{
  const i=await issue(ids.person,'second@example.invalid');
  const failingDb={getConnection:async()=>{
   const c=await db.getConnection();return{beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:(sql,args)=>{
    if(sql.startsWith('INSERT INTO member_audit_log'))throw new Error('simulated late audit failure');return c.query(sql,args);
   }};
  }};
  await assert.rejects(()=>createCreatorInvitationStore(failingDb).accept(i.raw,ids.second),/simulated late audit failure/);
  assert.ok(await store.read(i.raw));assert.equal((await db.query('SELECT level FROM member_memberships WHERE account_id=?',[ids.second]))[0].level,'free');
  assert.equal((await db.query('SELECT account_id FROM member_creator_connections WHERE account_id=?',[ids.second])).length,0);
  assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM creator_invitation_audit WHERE invitation_id=? AND action='accept'",[i.id]))[0].n),0);
 });
 await t.test('two concurrent accepts result in exactly one grant and receipt',async()=>{
  const i=await issue();const result=await Promise.allSettled([store.accept(i.raw,ids.creator),store.accept(i.raw,ids.creator)]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.filter(x=>x.status==='rejected'&&x.reason.code==='invitation_unavailable').length,1);
  const m=(await db.query('SELECT level,status,grant_source,granted_by,ends_at,subscription_id FROM member_memberships WHERE account_id=?',[ids.creator]))[0];
  assert.equal(m.level,'subscriber');assert.equal(m.grant_source,'complimentary');assert.equal(m.granted_by,ids.owner);assert.equal(m.ends_at,null);assert.equal(m.subscription_id,null);
  const c=(await db.query('SELECT status,permission FROM member_creator_connections WHERE account_id=? AND person_id=?',[ids.creator,ids.person]))[0];assert.equal(c.status,'approved');assert.equal(c.permission,'creator');
  assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM creator_invitation_audit WHERE invitation_id=? AND action='accept'",[i.id]))[0].n),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_role_grants WHERE account_id=?',[ids.creator]))[0].n),0);
  await assert.rejects(()=>store.revoke(i.id,'owner'),e=>e.code==='invitation_accepted');
 });
 await t.test('accepted access persists across actual sessions and unlocks premium reads',async()=>{
  const members=createMemberStore(db),csrf='c'.repeat(64),first=await members.login(ids.creator,0,csrf),second=await members.login(ids.creator,0,csrf);
  assert.ok(first&&second);assert.notEqual(first,second);
  for(const rawSession of [first,second]){
   const session=await members.session(rawSession);assert.equal(session.id,ids.creator);assert.equal(session.effective_level,'subscriber');assert.equal(session.grant_source,'complimentary');assert.equal(session.ends_at,null);
   assert.equal(await hasPremiumFeature({method:'GET',headers:{cookie:'__Host-gold-member='+rawSession}},{members,guests:null},'almanac'),true);
  }
  const free=await members.login(ids.other,0,csrf);assert.equal((await members.session(free)).effective_level,'free');
  assert.equal(await hasPremiumFeature({method:'GET',headers:{cookie:'__Host-gold-member='+free}},{members,guests:null},'almanac'),false);
  await members.logout(first);assert.equal(await members.session(first),null);assert.equal((await members.session(second)).effective_level,'subscriber');
 });
 await t.test('existing approved editor permissions and grant reviewer are retained',async()=>{
  await db.query("INSERT INTO member_creator_connections(account_id,person_id,status,permission,reviewed_by,reviewed_at) VALUES(?,?,'approved','edit_profile',?,UTC_TIMESTAMP(6))",[ids.creator,ids.person2,ids.owner]);
  const i=await issue(ids.person2);await store.accept(i.raw,ids.creator);
  assert.equal((await db.query('SELECT permission FROM member_creator_connections WHERE account_id=? AND person_id=?',[ids.creator,ids.person2]))[0].permission,'edit_profile');
  assert.equal((await db.query('SELECT granted_by FROM member_memberships WHERE account_id=?',[ids.creator]))[0].granted_by,ids.owner);
 });
 await t.test('unresolved subscription blocks conversion without using link',async()=>{
  const sub=randomUUID();await db.query("INSERT INTO member_subscriptions(id,account_id,provider,provider_subscription_id,status) VALUES(?,?,'stripe_test',?,'pending')",[sub,ids.second,'test_'+sub]);
  const i=await issue(ids.person,'second@example.invalid');await assert.rejects(()=>store.accept(i.raw,ids.second),e=>e.code==='billing_resolution_required');assert.ok(await store.read(i.raw));
  assert.equal((await db.query('SELECT level FROM member_memberships WHERE account_id=?',[ids.second]))[0].level,'free');await db.query('DELETE FROM member_subscriptions WHERE id=?',[sub]);
 });
 await t.test('expiry and account suspension are enforced at acceptance',async()=>{
  const i=await issue(ids.person,'second@example.invalid');await db.query('UPDATE creator_invitations SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY),expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE id=?',[i.id]);
  assert.equal(await store.read(i.raw),null);await assert.rejects(()=>store.accept(i.raw,ids.second),e=>e.code==='invitation_unavailable');
  const fresh=await issue(ids.person,'second@example.invalid');await db.query("UPDATE member_accounts SET status='suspended' WHERE id=?",[ids.second]);
  await assert.rejects(()=>store.accept(fresh.raw,ids.second),e=>e.code==='wrong_account');await db.query("UPDATE member_accounts SET status='active' WHERE id=?",[ids.second]);
 });
 await t.test('owner rebinding invalidates pending links but leaves accepted grants',async()=>{
  const i=await issue(ids.person,'second@example.invalid');await store.configureOwner('other@example.invalid','owner');assert.equal(await store.read(i.raw),null);
  assert.equal((await db.query('SELECT grant_source FROM member_memberships WHERE account_id=?',[ids.creator]))[0].grant_source,'complimentary');
  const overview=await store.overview();assert.equal(overview.owner.id,ids.other);assert.equal(overview.creators.length,2);assert.ok(overview.invitations.every(x=>!Object.hasOwn(x,'token_hash')&&!Object.hasOwn(x,'raw')));
 });
});
