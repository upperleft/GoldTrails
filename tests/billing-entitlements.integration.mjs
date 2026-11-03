// Explicit opt-in against an empty local socket fixture; never a production DB.
// Apply migrations 001,004,009,013,014,016 to gold_billing_entitlements_test first.
// RUN_BILLING_ENTITLEMENT_DB_TESTS=true BILLING_DB_SOCKET=/private/tmp/goldtrails-billing-db-.../mysql.sock node --test tests/billing-entitlements.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mariadb from 'mariadb';
import {createMemberStore} from '../app/member-store.js';
import {createConnectionsStore} from '../app/connections/store.js';
import {meetingVault,validateEvent} from '../app/connections/model.js';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {createBillingStore} from '../app/billing/store.js';
import {billingScope,stripeConfig} from '../app/billing/config.js';
import {hasPremiumFeature} from '../app/plus/entitlements.js';

const socket=process.env.BILLING_DB_SOCKET||'';
const enabled=process.env.RUN_BILLING_ENTITLEMENT_DB_TESTS==='true'&&/^\/private\/tmp\/goldtrails-billing-db-[A-Za-z0-9_-]+\/mysql\.sock$/.test(socket);
test('real MariaDB paid and complimentary eligibility across sessions and Connections',{skip:!enabled},async t=>{
 const db=mariadb.createPool({socketPath:socket,user:'root',database:'gold_billing_entitlements_test',connectionLimit:6,dateStrings:true,timezone:'+00:00',initSql:["SET time_zone='+00:00'"]});
 const scope={stripeAccountId:'acct_entitlement_fixture',priceId:'price_entitlement_plus',livemode:true,allowTestEntitlements:false};
 const ids=Object.fromEntries(['owner','paid','free','creator','other','race','person'].map(name=>[name,randomUUID()]));
 const subscriptionId=randomUUID(),otherSubscriptionId=randomUUID(),sessions=new Map();
 let seeded=false,eventId;
 t.after(async()=>{try{if(seeded){
  for(const table of ['connection_notifications','connection_rsvps','connection_follows','connection_preferences','connection_audit','connection_events','creator_invitation_audit','creator_invitations','member_creator_connections','billing_events','billing_checkout_attempts','billing_customers','member_audit_log','member_sessions','member_memberships','member_subscriptions'])await db.query('DELETE FROM '+table);
  await db.query("UPDATE creator_invitation_settings SET owner_account_id=NULL,configured_by='' WHERE id=1");
  await db.query('DELETE FROM member_accounts');await db.query('DELETE FROM people WHERE id=?',[ids.person]);
 }}finally{await db.end();}});
 assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM member_accounts'))[0].n),0,'This test is restricted to an empty dedicated fixture.');
 for(const marker of ['004_member_accounts','013_gold_connections','014_creator_invitations','016_stripe_billing'])assert.equal((await db.query('SELECT version FROM schema_migrations WHERE version=?',[marker])).length,1,'Missing fixture migration '+marker);
 seeded=true;
 for(const name of ['owner','paid','free','creator','other','race']){
  await db.query("INSERT INTO member_accounts(id,username,email,password_hash,status,email_verified_at) VALUES(?,?,?,?,'active',UTC_TIMESTAMP(6))",[ids[name],'entitlement_'+name,name+'@example.invalid','x'.repeat(100)]);
  await db.query('INSERT INTO member_memberships(account_id) VALUES(?)',[ids[name]]);
 }
 for(const name of ['owner','creator'])await db.query("UPDATE member_memberships SET level='subscriber',status='active',grant_source='complimentary',granted_by=?,starts_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY),ends_at=NULL WHERE account_id=?",[ids.owner,ids[name]]);
 for(const [id,accountId] of [[subscriptionId,ids.paid],[otherSubscriptionId,ids.other]])await db.query("INSERT INTO member_subscriptions(id,account_id,provider,provider_customer_id,provider_subscription_id,status,current_period_start,current_period_end,stripe_account_id,livemode,price_id,price_valid,paid_through,latest_invoice_paid) VALUES(?,?,'stripe',?,?,'active',DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY),?,1,?,1,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 3 DAY),1)",[id,accountId,'cus_'+id.replaceAll('-',''),'sub_'+id.replaceAll('-',''),scope.stripeAccountId,scope.priceId]);
 const reset=async()=>{
  await db.query("UPDATE member_accounts SET status='active',email_verified_at=UTC_TIMESTAMP(6),archived_at=NULL WHERE id=?",[ids.paid]);
  await db.query("UPDATE member_subscriptions SET account_id=?,provider='stripe',stripe_account_id=?,livemode=1,price_id=?,price_valid=1,status='active',current_period_start=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY),current_period_end=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY),paid_through=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 3 DAY),latest_invoice_paid=1 WHERE id=?",[ids.paid,scope.stripeAccountId,scope.priceId,subscriptionId]);
  await db.query("UPDATE member_memberships SET level='subscriber',status='active',grant_source='payment',subscription_id=?,granted_by=NULL,starts_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY),ends_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 3 DAY) WHERE account_id=?",[subscriptionId,ids.paid]);
 };
 await reset();
 const vault=meetingVault('ab'.repeat(32));
 const readers=(billing=scope)=>({members:createMemberStore(db,{billing}),connections:createConnectionsStore(db,{vault,billing})});
 const live=readers();
 for(const name of ['owner','paid','free','creator','other','race'])sessions.set(ids[name],await live.members.login(ids[name],0,'f'.repeat(64)));
 const starts=new Date(Date.now()+10*86400000),ends=new Date(starts.getTime()+3600000);
 const event=validateEvent({title:'Isolated entitlement fixture',description:'Local test data only.',state:'MA',category:'Panning lesson',level:'All levels',mode:'in-person',visibility:'public',addressVisibility:'public',notificationRange:'0',timeZone:'UTC',startLocal:starts.toISOString().slice(0,16),endLocal:ends.toISOString().slice(0,16),status:'published',recurrence:'none',capacity:'',waitlist:false});
 [eventId]=await live.connections.create(ids.owner,event);
 for(const name of ['owner','paid','free','creator'])await live.connections.savePreferences(ids[name],{states:['MA'],new_events:true,updates:true,reminders:true,rsvp:true});
 const eligible=async(readers,accountId,expected)=>{
  const member=await readers.members.session(sessions.get(accountId));
  assert.equal(member?.effective_level==='subscriber',expected,'Member-session eligibility');
  const premium=await hasPremiumFeature({method:'GET',headers:{cookie:'__Host-gold-member='+sessions.get(accountId)}},{members:readers.members,guests:null},'almanac');
  assert.equal(premium,expected,'Actual Almanac entitlement');
  if(expected)assert.equal(await readers.connections.rsvp(accountId,eventId,'yes'),'yes','Connections RSVP');
  else await assert.rejects(()=>readers.connections.rsvp(accountId,eventId,'yes'),error=>error.status===403,'Connections RSVP must reject');
  const recipient=await readers.connections.notificationRecipient({account_id:accountId,event_id:eventId,kind:'rsvp',event_revision:1});
  assert.equal(Boolean(recipient),expected,'Connections delivery eligibility');
 };
 await t.test('a confirmed live payment grants actual sessions, premium reads and participation',async()=>{
  await eligible(live,ids.paid,true);await eligible(live,ids.free,false);
  const otherDevice=await live.members.login(ids.paid,0,'e'.repeat(64));assert.notEqual(otherDevice,sessions.get(ids.paid));assert.equal((await live.members.session(otherDevice)).effective_level,'subscriber');
 });
 const deniedCases=[
  ['another Stripe account',"UPDATE member_subscriptions SET stripe_account_id='acct_unrelated' WHERE id=?",subscriptionId],
  ['another price',"UPDATE member_subscriptions SET price_id='price_unrelated' WHERE id=?",subscriptionId],
  ['unvalidated price','UPDATE member_subscriptions SET price_valid=0 WHERE id=?',subscriptionId],
  ['another provider',"UPDATE member_subscriptions SET provider='legacy_provider' WHERE id=?",subscriptionId],
  ['test provider in a live scope',"UPDATE member_subscriptions SET provider='stripe_test' WHERE id=?",subscriptionId],
  ['test livemode bit','UPDATE member_subscriptions SET livemode=0 WHERE id=?',subscriptionId],
  ['missing confirmed payment','UPDATE member_subscriptions SET paid_through=NULL WHERE id=?',subscriptionId],
  ['expired paid-through despite future period','UPDATE member_subscriptions SET paid_through=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE id=?',subscriptionId],
  ['future service period','UPDATE member_subscriptions SET current_period_start=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE id=?',subscriptionId],
  ['expired service period','UPDATE member_subscriptions SET current_period_start=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 3 DAY),current_period_end=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY) WHERE id=?',subscriptionId],
  ['missing service period','UPDATE member_subscriptions SET current_period_start=NULL WHERE id=?',subscriptionId],
  ['wrong subscription owner','UPDATE member_memberships SET subscription_id=? WHERE account_id=?',[otherSubscriptionId,ids.paid]],
  ['unbounded payment membership','UPDATE member_memberships SET ends_at=NULL WHERE account_id=?',ids.paid],
  ['expired membership','UPDATE member_memberships SET ends_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE account_id=?',ids.paid],
  ['future membership','UPDATE member_memberships SET starts_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 1 DAY) WHERE account_id=?',ids.paid],
  ['suspended membership',"UPDATE member_memberships SET status='suspended' WHERE account_id=?",ids.paid],
  ['suspended account',"UPDATE member_accounts SET status='suspended' WHERE id=?",ids.paid],
  ['unverified account','UPDATE member_accounts SET email_verified_at=NULL WHERE id=?',ids.paid],
  ['archived account','UPDATE member_accounts SET archived_at=UTC_TIMESTAMP(6) WHERE id=?',ids.paid]
 ];
 for(const [label,sql,value] of deniedCases)await t.test(label+' fails closed in every reader',async()=>{
  await reset();await db.query(sql,Array.isArray(value)?value:[value]);await eligible(live,ids.paid,false);
 });
 for(const status of ['pending','trialing','past_due','canceled','expired','incomplete','incomplete_expired','unpaid','paused','unknown'])await t.test(status+' is not a confirmed active paid subscription',async()=>{
  await reset();await db.query('UPDATE member_subscriptions SET status=? WHERE id=?',[status,subscriptionId]);await eligible(live,ids.paid,false);
 });
 await t.test('a future unpaid invoice does not erase previously confirmed paid-through',async()=>{
  await reset();await db.query('UPDATE member_subscriptions SET latest_invoice_paid=0 WHERE id=?',[subscriptionId]);await eligible(live,ids.paid,true);
 });
 await t.test('purchase shutdown and absent API keys do not erase confirmed live access',async()=>{
  await reset();const env={BILLING_ENABLED:'false',STRIPE_MODE:'live',STRIPE_ACCOUNT_ID:scope.stripeAccountId,STRIPE_PRICE_ID:scope.priceId};
  assert.equal(stripeConfig(env),null,'No purchase adapter without enabled billing or API credentials.');
  const maintenance=readers(billingScope(env));await eligible(maintenance,ids.paid,true);
 });
 await t.test('test entitlements are denied by default and require an explicit isolated opt-in',async()=>{
  await reset();await db.query("UPDATE member_subscriptions SET provider='stripe_test',livemode=0 WHERE id=?",[subscriptionId]);
  await eligible(readers({...scope,livemode:false}),ids.paid,false);
  await eligible(readers({...scope,livemode:false,allowTestEntitlements:true}),ids.paid,true);
  await eligible(live,ids.paid,false);
 });
 await t.test('missing scope rejects paid access while complimentary creators remain entitled',async()=>{
  await reset();const noScope=readers(null);await eligible(noScope,ids.paid,false);await eligible(noScope,ids.creator,true);
  const session=await noScope.members.session(sessions.get(ids.creator));assert.equal(session.grant_source,'complimentary');assert.equal(session.ends_at,null);
 });
 await t.test('unresolved checkout prevents creator conversion even after local expiry',async()=>{
  await db.query("INSERT INTO people(id,slug,display_name,publication_status) VALUES(?,'entitlement-invitation-profile','Entitlement creator','published')",[ids.person]);
  const invitations=createCreatorInvitationStore(db);await invitations.configureOwner('owner@example.invalid','fixture-owner');
  const invitation=await invitations.issue({personId:ids.person,email:'free@example.invalid',actor:'fixture-owner'}),checkoutId=randomUUID();
  await db.query("INSERT INTO billing_checkout_attempts(id,account_id,stripe_account_id,livemode,provider_customer_id,status,created_at,expires_at) VALUES(?,?,?,1,'cus_invitation_fixture','creating',DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 2 DAY),DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 DAY))",[checkoutId,ids.free,scope.stripeAccountId]);
  for(const status of ['creating','open']){
   await db.query('UPDATE billing_checkout_attempts SET status=? WHERE id=?',[status,checkoutId]);
   await assert.rejects(()=>invitations.accept(invitation.raw,ids.free),error=>error.code==='billing_resolution_required');assert.ok(await invitations.read(invitation.raw));
  }
  await db.query("UPDATE billing_checkout_attempts SET status='expired' WHERE id=?",[checkoutId]);await invitations.accept(invitation.raw,ids.free);
  assert.equal((await live.members.session(sessions.get(ids.free))).grant_source,'complimentary');
 });
 await t.test('simultaneous creator conversion and checkout reservation cannot both succeed',async()=>{
  const invitations=createCreatorInvitationStore(db),billing=createBillingStore(db,scope);
  await billing.bindCustomer(ids.race,'cus_creator_checkout_race');
  const invitation=await invitations.issue({personId:ids.person,email:'race@example.invalid',actor:'fixture-owner'});
  const outcomes=await Promise.allSettled([invitations.accept(invitation.raw,ids.race),billing.reserveCheckout(ids.race)]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.ok(outcomes.filter(x=>x.status==='rejected').every(x=>['billing_resolution_required','billing_unavailable'].includes(x.reason.code)));
  const membership=(await db.query('SELECT grant_source FROM member_memberships WHERE account_id=?',[ids.race]))[0];
  const checkouts=await db.query("SELECT id FROM billing_checkout_attempts WHERE account_id=? AND status IN ('creating','open')",[ids.race]);
  assert.equal(membership.grant_source==='complimentary'&&checkouts.length>0,false,'An open checkout must not coexist with a newly accepted complimentary grant.');
 });
});
