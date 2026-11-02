// Explicit isolated fixture only; apply migrations 001, 004, 014 and 015 first.
// RUN_CREATOR_REPLIES_DB_TESTS=true CREATOR_REPLIES_DB_SOCKET=/private/tmp/goldtrails-invitations-db-.../mysql.sock node --test tests/creator-replies-mariadb.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import mariadb from 'mariadb';
import {createCreatorRepliesStore} from '../app/creator-replies/store.js';
import {replyDestination} from '../app/creator-replies/model.js';

const mailbox='owner@example.invalid';
const socket=process.env.CREATOR_REPLIES_DB_SOCKET||'';
const enabled=process.env.RUN_CREATOR_REPLIES_DB_TESTS==='true'&&/^\/private\/tmp\/goldtrails-invitations-db-[A-Za-z0-9]+\/mysql\.sock$/.test(socket);
test('isolated MariaDB reply metadata persistence, concurrency and rollback',{skip:!enabled},async t=>{
 const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_creator_invitation_test',connectionLimit:5,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
 const ids={owner:randomUUID(),person:randomUUID(),invitation:randomUUID()},suffix=randomBytes(4).toString('hex'),messages=[];
 const store=createCreatorRepliesStore(db,{mailbox});let oldState=null,seeded=false;
 t.after(async()=>{try{
  if(messages.length)await db.query('DELETE FROM creator_reply_references WHERE message_id IN ('+messages.map(()=>'?').join(',')+')',messages);
  if(seeded){await db.query('DELETE FROM creator_invitations WHERE id=?',[ids.invitation]);await db.query('DELETE FROM people WHERE id=?',[ids.person]);await db.query('DELETE FROM member_accounts WHERE id=?',[ids.owner]);}
  if(oldState)await db.query('UPDATE creator_reply_sync_state SET last_success_at=?,imported_count=?,duplicate_count=?,unmatched_count=?,ambiguous_count=? WHERE id=1',[oldState.last_success_at,oldState.imported_count,oldState.duplicate_count,oldState.unmatched_count,oldState.ambiguous_count]);
 }finally{await db.end();}});
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'Use an empty isolated fixture, never a live database.');
 assert.equal(await store.ready(),true,'Explicitly apply migration 015 to the isolated fixture first.');
 oldState=(await store.overview()).state;
 await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[ids.owner,'reply_test_'+suffix,'reply_owner_'+suffix+'@example.invalid','x'.repeat(100)]);seeded=true;
 await db.query("INSERT INTO people(id,slug,display_name,publication_status) VALUES(?,?,?,'published')",[ids.person,'reply-test-'+suffix,'Reply Test Creator']);
 await db.query('INSERT INTO creator_invitations(id,token_hash,target_email,person_id,invited_by,actor_label,expires_at) VALUES(?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 14 DAY))',[ids.invitation,randomBytes(32).toString('hex'),'creator_'+suffix+'@example.invalid',ids.person,ids.owner,'Isolated reply fixture']);
 const row=(extra={})=>{const message_id=randomBytes(8).toString('hex');messages.push(message_id);return {message_id,thread_id:message_id,from_email:'creator_'+suffix+'@example.invalid',from_name:'Creator',to_email:replyDestination,subject:'A Gold Trails reply',received_at:new Date().toISOString(),...extra};};
 let matched;
 await t.test('real nullable foreign keys retain general inbox references without inventing a creator',async()=>{
  const general=row({from_email:'general_'+suffix+'@example.invalid'});
  assert.deepEqual(await store.importBatch([general]),{imported:1,duplicates:0,unmatched:1,ambiguous:0});
  const saved=(await store.overview()).replies.find(r=>r.message_id===general.message_id);assert.equal(saved.person_id,null);
 });
 await t.test('real invitation matching stores only redacted header metadata',async()=>{
  const raw='d'.repeat(64);matched=row({subject:'Re: https://goldtrails.org/creator-invitation/?token='+raw});
  assert.deepEqual(await store.importBatch([matched]),{imported:1,duplicates:0,unmatched:0,ambiguous:0});
  const saved=(await store.overview()).replies.find(r=>r.message_id===matched.message_id);assert.equal(saved.person_id,ids.person);assert.ok(!saved.subject.includes(raw));
  assert.equal((await db.query('SELECT consumed_at FROM creator_invitations WHERE id=?',[ids.invitation]))[0].consumed_at,null);
 });
 await t.test('review state survives retries and concurrent imports create exactly one reference',async()=>{
  const saved=(await store.overview()).replies.find(r=>r.message_id===matched.message_id);await store.review(saved.id,'reviewed','fixture-owner');
  assert.equal((await store.importBatch([matched])).duplicates,1);assert.equal((await store.overview()).replies.find(r=>r.id===saved.id).status,'reviewed');
  const concurrent=row();const results=await Promise.all([store.importBatch([concurrent]),store.importBatch([concurrent])]);
  assert.equal(results.reduce((n,r)=>n+r.imported,0),1);assert.equal(results.reduce((n,r)=>n+r.duplicates,0),1);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM creator_reply_references WHERE message_id=?',[concurrent.message_id]))[0].n),1);
 });
 await t.test('a late state failure rolls back inserted references and preserves prior success',async()=>{
  const before=(await store.overview()).state,bad=row();
  const failing={getConnection:async()=>{const c=await db.getConnection();return {beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:(sql,args)=>{if(sql.startsWith('UPDATE creator_reply_sync_state'))throw Error('isolated late failure');return c.query(sql,args);}};}};
  await assert.rejects(()=>createCreatorRepliesStore(failing,{mailbox}).importBatch([bad]),/isolated late failure/);
  assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM creator_reply_references WHERE message_id=?',[bad.message_id]))[0].n),0);
  assert.deepEqual((await store.overview()).state,before);
 });
 await t.test('empty checks record a successful heartbeat without creating metadata',async()=>{
  const before=Number((await db.query('SELECT COUNT(*) AS n FROM creator_reply_references'))[0].n);
  assert.deepEqual(await store.importBatch([]),{imported:0,duplicates:0,unmatched:0,ambiguous:0});
  assert.ok((await store.overview()).state.last_success_at);assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM creator_reply_references'))[0].n),before);
 });
});
