// Opt-in acceptance run against an isolated, empty, migrated MariaDB database.
// Never invoked by npm test; never targets the live Hostinger database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../app/database.js';
import {createConnectionsStore} from '../app/connections/store.js';
import {meetingVault,validateEvent} from '../app/connections/model.js';
import {fixtureInput} from '../scripts/fixtures/connections-memory.mjs';
const enabled=process.env.RUN_CONNECTIONS_DB_TESTS==='true'&&process.env.DB_NAME==='gold_connections_test';
test('isolated MariaDB: migration, paid eligibility, last-seat race, promotion, queue deduplication and encrypted persistence',{skip:!enabled},async t=>{
 const db=createDatabase();assert.ok(db,'Configure only the isolated gold_connections_test database.');
 const tables=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN('member_accounts','calendar_events','connection_events')");assert.equal(tables.length,3,'Apply reviewed foundation/member/calendar/Connections migrations to the empty test database first.');
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'This test requires an empty isolated member database.');
 const ids=[randomUUID(),randomUUID(),randomUUID()],events=[];t.after(async()=>{
  try{
   for(const table of ['connection_notifications','connection_reports','connection_photos','connection_comments','connection_calendar_copies','connection_rsvps'])for(const event of events)await db.query(`DELETE FROM ${table} WHERE event_id=?`,[event]);
   for(const event of events)await db.query('DELETE FROM connection_events WHERE id=?',[event]);
   for(const account of ids){for(const table of ['connection_follows','connection_preferences','connection_limits'])await db.query(`DELETE FROM ${table} WHERE account_id=?`,[account]);await db.query('DELETE FROM connection_audit WHERE account_id=?',[account]);await db.query('DELETE FROM member_memberships WHERE account_id=?',[account]);await db.query('DELETE FROM member_subscriptions WHERE account_id=?',[account]);await db.query('DELETE FROM member_profiles WHERE account_id=?',[account]);await db.query('DELETE FROM member_accounts WHERE id=?',[account]);}
  }finally{await db.end();}
 });
 for(let i=0;i<ids.length;i++){
  const id=ids[i],sub=randomUUID();await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[id,'connections_test_'+i,'connections_test_'+i+'@example.invalid','x'.repeat(100)]);
  await db.query("INSERT INTO member_subscriptions(id,account_id,provider,provider_subscription_id,status,current_period_start,current_period_end) VALUES(?,?,'stripe_test',?,'active',DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[sub,id,'sub_local_'+i]);
  await db.query("INSERT INTO member_memberships(account_id,level,status,grant_source,subscription_id,starts_at,ends_at) VALUES(?,'subscriber','active','payment',?,DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[id,sub]);
 }
 const vault=meetingVault('ab'.repeat(32)),store=createConnectionsStore(db,{vault,billingProvider:'stripe_test'});assert.equal(await store.ready(),true);
 for(const id of ids)await store.savePreferences(id,{states:['MA','NH'],new_events:true,updates:true,reminders:true,rsvp:true});
 const input=validateEvent({...fixtureInput(),startLocal:'2030-06-12T10:00',endLocal:'2030-06-12T12:00',capacity:1});const created=await store.create(ids[0],input);events.push(...created);const event=created[0];
 const [a,b]=await Promise.all([store.rsvp(ids[1],event,'yes'),store.rsvp(ids[2],event,'yes')]);assert.deepEqual([a,b].sort(),['waitlisted','yes']);const e=await store.get(event);assert.equal(e.yesCount,1);assert.equal(e.waitlistCount,1);assert.equal(vault.open(e.meetingCipher).passcode,'PRIVATE TEST PASSCODE');
 const raw=(await db.query('SELECT details_json,meeting_cipher FROM connection_events WHERE id=?',[event]))[0];assert.ok(!String(raw.details_json).includes('PRIVATE TEST PASSCODE'));assert.ok(!raw.meeting_cipher.includes('PRIVATE TEST PASSCODE'));
 assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM connection_notifications WHERE event_id=? AND account_id=? AND kind='new_event'",[event,ids[1]]))[0].n),1,'Following overlapping states must still queue one new-event notification.');
 const yes=a==='yes'?ids[1]:ids[2],waiting=a==='waitlisted'?ids[1]:ids[2];await store.rsvp(yes,event,'cancel');assert.equal((await store.participation(waiting,event)).status,'yes');
 await db.query("UPDATE member_subscriptions SET status='past_due' WHERE account_id=?",[yes]);await assert.rejects(()=>store.rsvp(yes,event,'yes'),e=>e.status===403);
 await assert.rejects(()=>store.update(ids[1],event,input,1),e=>e.status===404);
 await store.cancel(ids[0],event,1);await assert.rejects(()=>store.rsvp(ids[2],event,'yes'));
 assert.equal((await store.list({period:'upcoming'},null)).events[0].status,'cancelled');
});
