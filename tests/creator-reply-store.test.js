import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorRepliesStore} from '../app/creator-replies/store.js';
import {replyDestination,CreatorReplyInputError} from '../app/creator-replies/model.js';

const mailbox='owner@example.invalid';
const personId='11111111-1111-4111-8111-111111111111',invitationId='22222222-2222-4222-8222-222222222222';
const row=(extra={})=>({message_id:'1a16063e26c25562',thread_id:'1a16063e26c25562',from_email:'creator@example.invalid',from_name:'Creator',to_email:replyDestination,subject:'An invitation reply',received_at:'2026-11-01T16:20:00.000Z',...extra});
function fixture({matches=[{person_id:personId,invitation_id:invitationId}],failUpdate=false}={}){
 const records=new Map(),queries=[];let committed=0,rolledBack=0,released=0,working=null;
 const query=async(sql,args=[])=>{
  queries.push([sql,args]);
  if(sql.startsWith('SELECT id FROM creator_reply_sync_state'))return [{id:1}];
  if(sql.startsWith('SELECT id,thread_id,from_email'))return working.has(args[1])?[working.get(args[1])]:[];
  if(sql.includes('FROM creator_invitations'))return typeof matches==='function'?matches(args[0]):matches;
  if(sql.startsWith('INSERT INTO creator_reply_references')){working.set(args[2],{id:args[0],thread_id:args[3],from_email:args[4],args});return {affectedRows:1};}
  if(sql.startsWith('UPDATE creator_reply_sync_state')&&failUpdate)throw Error('database unavailable');
  return {affectedRows:1};
 };
 const connection={query,beginTransaction:async()=>{working=new Map(records);},commit:async()=>{records.clear();for(const [k,v] of working)records.set(k,v);committed++;},rollback:async()=>{rolledBack++;},release:()=>{released++;}};
 const store=createCreatorRepliesStore({getConnection:async()=>connection,query},{mailbox});
 return {store,records,queries,state:()=>({committed,rolledBack,released})};
}

test('reply import is idempotent by mailbox/message ID and never changes invitations, memberships or roles',async()=>{
 const {store,records,queries}=fixture();
 assert.deepEqual(await store.importBatch([row()]),{imported:1,duplicates:0,unmatched:0,ambiguous:0});
 assert.deepEqual(await store.importBatch([row()]),{imported:0,duplicates:1,unmatched:0,ambiguous:0});
 assert.equal(records.size,1);
 const saved=[...records.values()][0].args;assert.equal(saved[8],personId);assert.equal(saved[9],invitationId);
 assert.equal(queries.some(([sql])=>/^(INSERT|UPDATE|DELETE).*\b(?:creator_invitations|member_|role)/.test(sql)),false);
 assert.ok(queries.filter(([sql])=>sql.includes('FROM creator_invitations')).every(([,args])=>args[0]==='creator@example.invalid'));
});

test('general incoming Gold Trails email is retained without inventing a creator match',async()=>{
 const {store,records}=fixture({matches:[]});
 assert.deepEqual(await store.importBatch([row()]),{imported:1,duplicates:0,unmatched:1,ambiguous:0});
 const saved=[...records.values()][0].args;assert.equal(saved[8],null);assert.equal(saved[9],null);
});

test('an email shared by multiple creators remains an unassigned reference',async()=>{
 const {store,records}=fixture({matches:[{person_id:personId,invitation_id:invitationId},{person_id:'33333333-3333-4333-8333-333333333333',invitation_id:invitationId}]});
 assert.deepEqual(await store.importBatch([row()]),{imported:1,duplicates:0,unmatched:0,ambiguous:1});
 assert.equal([...records.values()][0].args[8],null);
});

test('failed batch commits neither references nor sync success; retry can use the same IDs',async()=>{
 const {store,records,state}=fixture({failUpdate:true});await assert.rejects(()=>store.importBatch([row()]),/database unavailable/);
 assert.equal(records.size,0);assert.deepEqual(state(),{committed:0,rolledBack:1,released:1});
});

test('empty metadata checks persist only sync state and conflicts preserve prior references',async()=>{
 const {store,records,state}=fixture();
 assert.deepEqual(await store.importBatch([]),{imported:0,duplicates:0,unmatched:0,ambiguous:0});assert.equal(records.size,0);
 await store.importBatch([row()]);
 await assert.rejects(()=>store.importBatch([row({thread_id:'1a16063e26c25563'})]),CreatorReplyInputError);
 assert.equal(records.size,1);assert.equal([...records.values()][0].thread_id,row().thread_id);assert.equal(state().rolledBack,1);
});

test('only supported private review states and administrator labels reach the database',async()=>{
 const {store,queries}=fixture();
 for(const args of [['not-an-id','reviewed','owner'],[personId,'deleted','owner'],[personId,'reviewed','owner\nforged']])await assert.rejects(()=>store.review(...args),CreatorReplyInputError);
 assert.equal(queries.length,0);
 await store.review(personId,'reviewed','owner');assert.equal(queries.length,1);assert.deepEqual(queries[0][1],['reviewed','owner',personId,mailbox]);
});

test('unconfigured mailbox cannot read references or import and configured queries stay mailbox scoped',async()=>{
 let queries=0;
 const unavailable=createCreatorRepliesStore({query:()=>{queries++;throw Error('must not query');},getConnection:()=>{queries++;throw Error('must not connect');}},{mailbox:''});
 assert.deepEqual(await unavailable.overview(),{state:null,replies:[],mailbox:null});
 await assert.rejects(()=>unavailable.importBatch([]),CreatorReplyInputError);assert.equal(queries,0);
 const {store,queries:sql}=fixture();await store.overview();
 const query=sql.find(([statement])=>statement.includes('FROM creator_reply_references r LEFT JOIN'));
 assert.match(query[0],/WHERE r\.mailbox=\?/);assert.deepEqual(query[1],[mailbox]);
});
