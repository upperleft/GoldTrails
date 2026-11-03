import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {CreatorInvitationError,invitationEmail,invitationId} from '../app/creator-invitations/model.js';
import {digest} from '../app/admin-auth.js';

const ownerId='11111111-1111-4111-8111-111111111111',accountId='22222222-2222-4222-8222-222222222222',personId='33333333-3333-4333-8333-333333333333',inviteId='44444444-4444-4444-8444-444444444444';
const raw='a'.repeat(64);
function fixture(overrides={}){
 const queries=[];let committed=0,rolledBack=0,released=0;
 const rows={owner:{id:ownerId,email:'owner@example.invalid',username:'owner'},account:{id:accountId,email:'creator@example.invalid',username:'creator'},invitation:{id:inviteId,target_email:'creator@example.invalid',person_id:personId,invited_by:ownerId},membership:{level:'free',status:'active',grant_source:'free'},subscriptions:[],affiliation:null,...overrides};
 const query=async(sql,args=[])=>{
  queries.push([sql,args]);
  if(sql.includes("version='016_stripe_billing'"))return overrides.billingReady?[{version:'016_stripe_billing'}]:[];
  if(sql.startsWith('SELECT id FROM billing_checkout_attempts'))return overrides.checkouts||[];
  if(sql.includes('FROM creator_invitation_settings WHERE id=1 FOR UPDATE'))return[{owner_account_id:ownerId}];
  if(sql.startsWith('SELECT id,email,username FROM member_accounts WHERE id='))return[args[0]===ownerId?rows.owner:rows.account].filter(Boolean);
  if(sql.startsWith('SELECT id,email,username FROM member_accounts WHERE email='))return rows.owner?[rows.owner]:[];
  if(sql.startsWith('SELECT id,display_name,slug FROM people'))return[{id:personId,display_name:'Test creator',slug:'test-creator'}];
  if(sql.startsWith('SELECT id,target_email,person_id,invited_by FROM creator_invitations'))return rows.invitation?[rows.invitation]:[];
  if(sql.startsWith('SELECT expires_at'))return[{expires_at:'2030-01-14 00:00:00.000000'}];
  if(sql.startsWith('SELECT level,status,grant_source'))return rows.membership?[rows.membership]:[];
  if(sql.startsWith('SELECT id FROM member_subscriptions'))return rows.subscriptions.filter(row=>!row.status||sql.includes("'"+row.status+"'"));
  if(sql.startsWith('SELECT status,permission FROM member_creator_connections'))return rows.affiliation?[rows.affiliation]:[];
  if(overrides.failAudit&&sql.startsWith('INSERT INTO member_audit_log'))throw new Error('simulated database failure');
  return{affectedRows:1};
 };
 const connection={query,beginTransaction:async()=>{},commit:async()=>{committed++;},rollback:async()=>{rolledBack++;},release:()=>{released++;}};
 return{store:createCreatorInvitationStore({getConnection:async()=>connection,query}),queries,state:()=>({committed,rolledBack,released})};
}
const failure=code=>error=>error instanceof CreatorInvitationError&&error.code===code;

test('invitation email canonicalization rejects headers and identifiers are UUIDs',()=>{
 assert.equal(invitationEmail(' Creator@Example.Invalid '),'creator@example.invalid');
 for(const value of ['name@example.invalid\r\nBcc:x@y.invalid','not-an-email','a'.repeat(255)+'@example.invalid'])assert.throws(()=>invitationEmail(value),failure('input'));
 assert.equal(invitationId(personId),true);assert.equal(invitationId('catalog:creator'),false);
});
test('malformed links and issue inputs fail before database access',async()=>{
 const store=createCreatorInvitationStore({getConnection:()=>{throw Error('must not access DB');},query:()=>{throw Error('must not access DB');}});
 assert.equal(await store.read('not-a-token'),null);
 await assert.rejects(()=>store.accept('bad',accountId),failure('invitation_unavailable'));
 await assert.rejects(()=>store.issue({personId,email:'creator@example.invalid',actor:'owner',days:0}),failure('input'));
 await assert.rejects(()=>store.issue({personId,email:'creator@example.invalid',actor:'owner\r\nforged'}),failure('input'));
});
test('issue returns the random link once while persisting only its digest and audit',async()=>{
 const {store,queries,state}=fixture();const invitation=await store.issue({personId,email:' Creator@Example.Invalid ',actor:'owner'});
 assert.match(invitation.raw,/^[a-f0-9]{64}$/);assert.equal(invitation.target_email,'creator@example.invalid');
 const insert=queries.find(([sql])=>sql.startsWith('INSERT INTO creator_invitations('));
 assert.equal(insert[1][1],digest(invitation.raw));assert.equal(JSON.stringify(queries).includes(invitation.raw),false);
 assert.ok(queries[0][0].includes('creator_invitation_settings'));assert.ok(queries.some(([sql])=>sql.startsWith('INSERT INTO creator_invitation_audit')));
 assert.deepEqual(state(),{committed:1,rolledBack:0,released:1});
});
test('wrong-email acceptance rolls back without granting access or consuming invitation',async()=>{
 const {store,queries,state}=fixture({account:{id:accountId,email:'someone-else@example.invalid',username:'other'}});
 await assert.rejects(()=>store.accept(raw,accountId),failure('wrong_account'));
 assert.equal(queries.some(([sql])=>/^(UPDATE|INSERT)/.test(sql)),false);assert.deepEqual(state(),{committed:0,rolledBack:1,released:1});
});
test('ongoing subscription prevents free conversion before any write',async()=>{
 const {store,queries}=fixture({subscriptions:[{id:'existing-subscription'}]});
 await assert.rejects(()=>store.accept(raw,accountId),failure('billing_resolution_required'));
 assert.equal(queries.some(([sql])=>/^(UPDATE|INSERT)/.test(sql)),false);
});
test('resumable, unpaid, incomplete and unknown billing states cannot become free creator access',async()=>{
 for(const status of ['pending','active','trialing','past_due','incomplete','unpaid','paused','unknown']){
  const {store,queries,state}=fixture({subscriptions:[{id:'existing-subscription',status}]});
  await assert.rejects(()=>store.accept(raw,accountId),failure('billing_resolution_required'),status);
  assert.equal(queries.some(([sql])=>/^(UPDATE|INSERT)/.test(sql)),false,status);
  assert.deepEqual(state(),{committed:0,rolledBack:1,released:1},status);
 }
});
test('terminal subscription records do not prevent accepting a creator invitation',async()=>{
 for(const status of ['canceled','expired','incomplete_expired']){
  const {store,state}=fixture({subscriptions:[{id:'ended-subscription',status}]});
  await store.accept(raw,accountId);assert.equal(state().committed,1,status);
 }
});
test('unresolved provider checkout blocks creator conversion under the same account lock',async()=>{
 for(const status of ['creating','open']){
  const {store,queries,state}=fixture({billingReady:true,checkouts:[{id:'unresolved',status}]});
  await assert.rejects(()=>store.accept(raw,accountId),failure('billing_resolution_required'));
  const accountLock=queries.findIndex(([sql,args])=>sql.startsWith('SELECT id,email,username FROM member_accounts WHERE id=')&&args[0]===accountId);
  const checkoutLock=queries.findIndex(([sql])=>sql.startsWith('SELECT id FROM billing_checkout_attempts'));
  assert.ok(accountLock>=0&&checkoutLock>accountLock);
  assert.match(queries[checkoutLock][0],/FOR UPDATE/);
  assert.equal(queries.some(([sql])=>/^(UPDATE|INSERT)/.test(sql)),false);
  assert.equal(state().rolledBack,1);
 }
 const prior=fixture();await prior.store.accept(raw,accountId);
 assert.equal(prior.queries.some(([sql])=>sql.includes('FROM billing_checkout_attempts')),false);
});
test('suspended membership and revoked creator affiliations require owner review',async()=>{
 for(const [overrides,code] of [[{membership:{status:'suspended'}},'membership_suspended'],[{affiliation:{status:'revoked',permission:'creator'}},'affiliation_blocked']]){
  const {store,queries}=fixture(overrides);await assert.rejects(()=>store.accept(raw,accountId),failure(code));
  assert.equal(queries.some(([sql])=>sql.startsWith('UPDATE member_memberships')||sql.startsWith('UPDATE creator_invitations')),false);
 }
});
test('accept creates affiliation and permanent complimentary access without granting roles',async()=>{
 const {store,queries,state}=fixture();assert.deepEqual(await store.accept(raw,accountId),{person_id:personId,display_name:'Test creator',slug:'test-creator'});
 const membership=queries.find(([sql])=>sql.startsWith('UPDATE member_memberships'));
 assert.match(membership[0],/grant_source='complimentary'/);assert.match(membership[0],/ends_at=NULL/);assert.deepEqual(membership[1],[ownerId,accountId]);
 assert.ok(queries.some(([sql])=>sql.includes("'approved','creator'")));assert.equal(queries.some(([sql])=>sql.includes('member_role_grants')),false);
 assert.ok(queries.some(([sql])=>sql.includes('accepted_account_id=?')));assert.equal(state().committed,1);
});
test('existing editor permissions and complimentary reviewer remain unchanged',async()=>{
 const {store,queries}=fixture({membership:{level:'subscriber',status:'active',grant_source:'complimentary',granted_by:ownerId},affiliation:{status:'approved',permission:'edit_profile'}});
 await store.accept(raw,accountId);
 assert.equal(queries.some(([sql])=>/^(UPDATE|INSERT INTO) member_creator_connections/.test(sql)),false);
 const update=queries.find(([sql])=>sql.startsWith('UPDATE member_memberships'));
 assert.match(update[0],/ends_at=NULL/);assert.doesNotMatch(update[0],/granted_by=/);
});
test('late database failure rolls back grant, affiliation, consumption and audit together',async()=>{
 const {store,state}=fixture({failAudit:true});await assert.rejects(()=>store.accept(raw,accountId),/simulated database failure/);
 assert.deepEqual(state(),{committed:0,rolledBack:1,released:1});
});
