// Opt in only to the separate empty, socket-only local 001/002/004/014/015 fixture.
// RUN_NAMED_CREATOR_DB_TESTS=true NAMED_CREATOR_DB_SOCKET=/private/tmp/goldtrails-billing-db-.../mysql.sock node --test tests/creator-named-invitations-mariadb.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import mariadb from 'mariadb';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {createMemberStore} from '../app/member-store.js';
import {createCreatorInvitationHandler} from '../app/creator-invitations/handler.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {createServer} from '../app/server.js';
import {digest} from '../app/admin-auth.js';

const socket=process.env.NAMED_CREATOR_DB_SOCKET||'';
const enabled=process.env.RUN_NAMED_CREATOR_DB_TESTS==='true'&&/^\/private\/tmp\/goldtrails-(?:billing|invitations)-db-[A-Za-z0-9_-]+\/mysql\.sock$/.test(socket);
test('real MariaDB creator-name privacy, email matching, token compatibility and races',{skip:!enabled},async t=>{
 const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_creator_named_invitation_test',connectionLimit:6,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
 const ids=Object.fromEntries(['owner','creator','second','other','unverified','failure','race','http','httpother','person','lifePerson','racePerson','httpPerson'].map(name=>[name,randomUUID()]));
 let seeded=false;
 t.after(async()=>{try{if(seeded){
  for(const table of ['creator_invitation_audit','member_audit_log','member_sessions','creator_invitations','member_creator_connections','member_memberships','member_subscriptions','admin_login_limits'])await db.query('DELETE FROM '+table);
  await db.query("UPDATE creator_invitation_settings SET owner_account_id=NULL,configured_by='' WHERE id=1");await db.query('DELETE FROM member_accounts');
  await db.query('DELETE FROM people WHERE id IN (?,?,?,?)',[ids.person,ids.lifePerson,ids.racePerson,ids.httpPerson]);
 }}finally{await db.end();}});
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'Only the empty dedicated named-invitation fixture may be used.');
 assert.equal((await db.query("SELECT version FROM schema_migrations WHERE version='016_stripe_billing'")).length,0,'Verify compatibility with the deployed 014/015 schema, without future billing tables.');seeded=true;
 for(const name of ['owner','creator','second','other','unverified','failure','race','http','httpother']){
  await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[ids[name],'named_'+name,name+'@example.invalid','x'.repeat(100)]);
  await db.query('INSERT INTO member_memberships(account_id) VALUES(?)',[ids[name]]);
 }
 await db.query("UPDATE member_accounts SET status='pending_verification',email_verified_at=NULL WHERE id=?",[ids.unverified]);
 for(const [id,slug] of [[ids.person,'named-multiple-emails'],[ids.lifePerson,'named-lifecycle'],[ids.racePerson,'named-race'],[ids.httpPerson,'named-http-flow']])await db.query("INSERT INTO people(id,slug,display_name,publication_status) VALUES(?,?,?,'published')",[id,slug,'Creator '+slug]);
 const store=createCreatorInvitationStore(db);assert.equal(await store.ready(),true);await store.configureOwner('owner@example.invalid','fixture-owner');
 const issue=(personId,email,days=14)=>store.issue({personId,email,days,actor:'fixture-owner'});
 const primary=await issue(ids.person,'creator@example.invalid',14),alternate=await issue(ids.person,'second@example.invalid',20),unverified=await issue(ids.person,'unverified@example.invalid',3);
 const publicOnly=row=>{
  assert.equal(row.named,true);assert.equal(row.matched,false);assert.equal(row.id,null);assert.equal(row.target_email,null);
  assert.deepEqual(Object.keys(row).sort(),['display_name','expires_at','id','matched','named','person_id','slug','target_email'].sort());
  for(const secret of [primary.raw,alternate.raw,unverified.raw,primary.id,alternate.id,unverified.id,'creator@example.invalid','second@example.invalid','unverified@example.invalid'])assert.equal(JSON.stringify(row).includes(secret),false);
 };
 await t.test('anonymous, wrong, unknown and unverified accounts see only public creator fields',async()=>{
  for(const accountId of [null,ids.other,ids.unverified,randomUUID(),'invalid']){
   const row=await store.readNamed('named-multiple-emails',accountId);publicOnly(row);assert.equal(row.expires_at,alternate.expires_at,'Generic expiry uses the latest pending invitation.');
  }
  assert.equal(await store.readNamed('not-invited'),null);assert.equal(await store.readNamed('../admin'),null);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM creator_invitations WHERE consumed_at IS NOT NULL'))[0].n),0);
  assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM member_memberships WHERE grant_source='complimentary'"))[0].n),0);
 });
 await t.test('a verified account resolves its own invitation among multiple target emails',async()=>{
  const a=await store.readNamed('named-multiple-emails',ids.creator),b=await store.readNamed('named-multiple-emails',ids.second);
  assert.equal(a.id,primary.id);assert.equal(a.target_email,'creator@example.invalid');assert.equal(a.expires_at,primary.expires_at);assert.equal(a.matched,true);
  assert.equal(b.id,alternate.id);assert.equal(b.target_email,'second@example.invalid');assert.equal(b.matched,true);
 });
 await t.test('wrong verified and unverified accounts cannot consume a named invitation',async()=>{
  for(const accountId of [ids.other,ids.unverified])await assert.rejects(()=>store.acceptNamed('named-multiple-emails',accountId),error=>error.code==='wrong_account');
  assert.ok(await store.read(primary.raw));assert.ok(await store.read(alternate.raw));
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM creator_invitations WHERE consumed_at IS NOT NULL'))[0].n),0);
 });
 await t.test('named acceptance consumes only the matching email and grants permanent Plus without roles',async()=>{
  await store.acceptNamed('named-multiple-emails',ids.creator);
  assert.equal(await store.read(primary.raw),null);assert.ok(await store.read(alternate.raw));
  const accepted=(await db.query('SELECT id,accepted_account_id FROM creator_invitations WHERE consumed_at IS NOT NULL'));
  assert.equal(accepted.length,1);assert.equal(accepted[0].id,primary.id);assert.equal(accepted[0].accepted_account_id,ids.creator);
  const members=createMemberStore(db),raw=await members.login(ids.creator,0,'a'.repeat(64)),session=await members.session(raw);
  assert.equal(session.effective_level,'subscriber');assert.equal(session.grant_source,'complimentary');assert.equal(session.ends_at,null);
  const connection=(await db.query('SELECT status,permission FROM member_creator_connections WHERE account_id=? AND person_id=?',[ids.creator,ids.person]))[0];assert.equal(connection.status,'approved');assert.equal(connection.permission,'creator');
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_role_grants WHERE account_id=?',[ids.creator]))[0].n),0);
  await store.acceptNamed('named-multiple-emails',ids.second);assert.equal(await store.read(alternate.raw),null);
  publicOnly(await store.readNamed('named-multiple-emails',ids.creator));
 });
 await t.test('concurrent old-token and named acceptance consume exactly one invitation',async()=>{
  const invitation=await issue(ids.racePerson,'race@example.invalid');
  const results=await Promise.allSettled([store.accept(invitation.raw,ids.race),store.acceptNamed('named-race',ids.race)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='invitation_unavailable').length,1);
  assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM creator_invitation_audit WHERE invitation_id=? AND action='accept'",[invitation.id]))[0].n),1);
  assert.equal(await store.readNamed('named-race',ids.race),null);assert.equal(await store.read(invitation.raw),null);
 });
 await t.test('reissue, revocation and expiry govern the same named and token entry points',async()=>{
  const old=await issue(ids.lifePerson,'other@example.invalid'),fresh=await issue(ids.lifePerson,'other@example.invalid',20);
  assert.equal(await store.read(old.raw),null);assert.equal((await store.readNamed('named-lifecycle',ids.other)).id,fresh.id);
  await store.revoke(fresh.id,'fixture-owner');assert.equal(await store.readNamed('named-lifecycle'),null);
  const expired=await issue(ids.lifePerson,'other@example.invalid');await db.query('UPDATE creator_invitations SET created_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY),expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE id=?',[expired.id]);
  assert.equal(await store.readNamed('named-lifecycle',ids.other),null);assert.equal(await store.read(expired.raw),null);
  await assert.rejects(()=>store.acceptNamed('named-lifecycle',ids.other),error=>error.code==='invitation_unavailable');
 });
 await t.test('creator publication and active verified owner remain required',async()=>{
  const invitation=await issue(ids.lifePerson,'other@example.invalid');
  for(const sql of ["UPDATE people SET publication_status='draft' WHERE id=?",'UPDATE people SET archived_at=UTC_TIMESTAMP(6) WHERE id=?','UPDATE people SET is_sample=TRUE WHERE id=?']){
   await db.query(sql,[ids.lifePerson]);assert.equal(await store.readNamed('named-lifecycle',ids.other),null);
   await assert.rejects(()=>store.acceptNamed('named-lifecycle',ids.other),error=>error.code==='invitation_unavailable');
   await db.query("UPDATE people SET publication_status='published',archived_at=NULL,is_sample=FALSE WHERE id=?",[ids.lifePerson]);
  }
  for(const sql of ["UPDATE member_accounts SET status='suspended' WHERE id=?",'UPDATE member_accounts SET email_verified_at=NULL WHERE id=?','UPDATE member_accounts SET archived_at=UTC_TIMESTAMP(6) WHERE id=?']){
   await db.query(sql,[ids.owner]);assert.equal(await store.readNamed('named-lifecycle',ids.other),null);
   await assert.rejects(()=>store.acceptNamed('named-lifecycle',ids.other),error=>error.code==='owner_unavailable');
   await db.query("UPDATE member_accounts SET status='active',email_verified_at=UTC_TIMESTAMP(6),archived_at=NULL WHERE id=?",[ids.owner]);
  }
  assert.equal((await store.readNamed('named-lifecycle',ids.other)).id,invitation.id);
 });
 await t.test('named acceptance retains membership, billing and affiliation protections on 014/015',async()=>{
  const sub=randomUUID();await db.query("INSERT INTO member_subscriptions(id,account_id,provider,provider_subscription_id,status) VALUES(?,?,'stripe_test',?,'pending')",[sub,ids.other,'named_sub_'+sub]);
  await assert.rejects(()=>store.acceptNamed('named-lifecycle',ids.other),error=>error.code==='billing_resolution_required');await db.query('DELETE FROM member_subscriptions WHERE id=?',[sub]);
  await db.query("UPDATE member_memberships SET status='suspended' WHERE account_id=?",[ids.other]);await assert.rejects(()=>store.acceptNamed('named-lifecycle',ids.other),error=>error.code==='membership_suspended');await db.query("UPDATE member_memberships SET status='active' WHERE account_id=?",[ids.other]);
  await db.query("INSERT INTO member_creator_connections(account_id,person_id,status,permission) VALUES(?,?,'revoked','creator')",[ids.other,ids.lifePerson]);
  await assert.rejects(()=>store.acceptNamed('named-lifecycle',ids.other),error=>error.code==='affiliation_blocked');await db.query('DELETE FROM member_creator_connections WHERE account_id=? AND person_id=?',[ids.other,ids.lifePerson]);
  await store.acceptNamed('named-lifecycle',ids.other);assert.equal((await db.query('SELECT grant_source FROM member_memberships WHERE account_id=?',[ids.other]))[0].grant_source,'complimentary');
 });
 await t.test('late named-acceptance audit failure rolls back grants, affiliation and consumption',async()=>{
  const invitation=await issue(ids.lifePerson,'failure@example.invalid');
  const failing={getConnection:async()=>{const c=await db.getConnection();return{beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:(sql,args)=>{if(sql.startsWith('INSERT INTO member_audit_log'))throw Error('simulated named audit failure');return c.query(sql,args);}};}};
  await assert.rejects(()=>createCreatorInvitationStore(failing).acceptNamed('named-lifecycle',ids.failure),/simulated named audit failure/);
  assert.equal((await store.readNamed('named-lifecycle',ids.failure)).id,invitation.id);assert.equal((await db.query('SELECT level FROM member_memberships WHERE account_id=?',[ids.failure]))[0].level,'free');
  assert.equal((await db.query('SELECT account_id FROM member_creator_connections WHERE account_id=?',[ids.failure])).length,0);
  assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM creator_invitation_audit WHERE invitation_id=? AND action='accept'",[invitation.id]))[0].n),0);
 });
 await t.test('real HTTP name entry, homepage, clean form and POST activate the database grant',async httpTest=>{
  const invitation=await issue(ids.httpPerson,'http@example.invalid'),csrf='e'.repeat(64),goodSession='f'.repeat(64),wrongSession='d'.repeat(64),origin='https://gold.example';
  // Only the authenticated-session identity is a fixture. Rate limiting and
  // every invitation read, match, lock, grant, consumption and audit use MariaDB.
  const members={...createMemberStore(db),session:async raw=>raw===goodSession?{id:ids.http,email:'http@example.invalid',username:'named_http',account_number:100,effective_level:'free',csrf_token_hash:digest(csrf)}:raw===wrongSession?{id:ids.httpother,email:'httpother@example.invalid',username:'named_httpother',account_number:101,effective_level:'free',csrf_token_hash:digest(csrf)}:null};
  const config={origin,open:true},logs=[];
  const server=createServer({creatorInvitations:createCreatorInvitationHandler({store,members,config,log:value=>logs.push(value)}),homepage:createHomepageHandler({members,config,guests:null}),memberSessions:members,guests:null,goldPrice:async()=>({}),log:value=>logs.push(value)});
  server.listen(0,'127.0.0.1');await once(server,'listening');httpTest.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port,jar=new Map([['__Host-gold-form',csrf]]);
  const cookies=session=>[...jar].filter(([,value])=>value).map(([name,value])=>name+'='+value).concat(session?'__Host-gold-member='+session:[]).join('; ');
  const request=(path,init={})=>fetch(base+path,{redirect:'manual',...init});
  const capture=response=>{for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],equals=pair.indexOf('=');jar.set(pair.slice(0,equals),pair.slice(equals+1));}};
  const assertPending=async()=>{
   const row=(await db.query('SELECT consumed_at,accepted_account_id FROM creator_invitations WHERE id=?',[invitation.id]))[0];assert.equal(row.consumed_at,null);assert.equal(row.accepted_account_id,null);
   assert.equal((await db.query('SELECT level FROM member_memberships WHERE account_id=?',[ids.http]))[0].level,'free');
  };
  for(const method of ['GET','HEAD']){
   const entry=await request('/invite/named-http-flow/',{method,headers:{Cookie:cookies()}});assert.equal(entry.status,303);assert.equal(entry.headers.get('location'),'/');capture(entry);
   assert.equal(jar.get('__Host-gold-creator-name'),'named-http-flow');assert.equal(jar.get('__Host-gold-creator-invite'),'');
   const home=await request('/',{method,headers:{Cookie:cookies()}});assert.equal(home.status,200);const homeHtml=await home.text();
   if(method==='HEAD')assert.equal(homeHtml,'');else{assert.match(homeHtml,/Your complimentary creator invitation is waiting/);assert.match(homeHtml,/href="\/creator-invitation\/">Continue to your free creator account/);for(const secret of [invitation.id,invitation.raw,'http@example.invalid'])assert.equal(homeHtml.includes(secret),false);}
   const clean=await request('/creator-invitation/',{method,headers:{Cookie:cookies(goodSession)}});assert.equal(clean.status,200);const html=await clean.text();
   if(method==='HEAD')assert.equal(html,'');else{assert.match(html,/Accept complimentary creator access/);assert.match(html,/action="\/creator-invitation\/"/);assert.match(html,new RegExp('name="csrf" value="'+csrf+'"'));assert.match(html,/normally \$5\/month/);}
   await assertPending();
  }
  const submit=(session,from=origin,formCsrf=csrf)=>request('/creator-invitation/',{method:'POST',headers:{Origin:from,'Content-Type':'application/x-www-form-urlencoded',Cookie:cookies(session)},body:new URLSearchParams({csrf:formCsrf})});
  assert.equal((await submit(wrongSession)).status,403);await assertPending();
  assert.equal((await db.query('SELECT level FROM member_memberships WHERE account_id=?',[ids.httpother]))[0].level,'free');
  assert.equal((await submit(goodSession,'https://other.example')).status,403);assert.equal((await submit(goodSession,origin,'0'.repeat(64))).status,403);await assertPending();
  const accepted=await submit(goodSession);assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'/account/?creator=accepted');
  const grant=(await db.query('SELECT level,status,grant_source,granted_by,ends_at,subscription_id FROM member_memberships WHERE account_id=?',[ids.http]))[0];
  assert.equal(grant.level,'subscriber');assert.equal(grant.status,'active');assert.equal(grant.grant_source,'complimentary');assert.equal(grant.granted_by,ids.owner);assert.equal(grant.ends_at,null);assert.equal(grant.subscription_id,null);
  const consumed=(await db.query('SELECT consumed_at,accepted_account_id FROM creator_invitations WHERE id=?',[invitation.id]))[0];assert.ok(consumed.consumed_at);assert.equal(consumed.accepted_account_id,ids.http);
  assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM creator_invitation_audit WHERE invitation_id=? AND action='accept'",[invitation.id]))[0].n),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_role_grants WHERE account_id=?',[ids.http]))[0].n),0);
  assert.equal((await submit(goodSession)).status,410);assert.deepEqual(logs,[]);
 });
});
