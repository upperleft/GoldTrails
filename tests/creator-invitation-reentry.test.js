import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {digest} from '../app/admin-auth.js';

const raw='e'.repeat(64);
const receipt={accountId:'22222222-2222-4222-8222-222222222222',slug:'river-creator'};

function readonlyStore(rows=[]){
 const queries=[];
 const store=createCreatorInvitationStore({
  query:async(sql,args)=>{queries.push({sql,args});return rows;},
  getConnection:()=>{throw Error('A read-only invitation lookup must not open a transaction.');}
 });
 return{store,queries};
}
function assertHashedRead(queries){
 assert.equal(queries.length,1);
 assert.match(queries[0].sql,/^\s*SELECT\b/i);
 assert.doesNotMatch(queries[0].sql,/\b(?:INSERT|UPDATE|DELETE|REPLACE|FOR\s+UPDATE)\b/i);
 assert.doesNotMatch(queries[0].sql,/password/i);
 assert.deepEqual(queries[0].args,[digest(raw)]);
 assert.equal(JSON.stringify(queries).includes(raw),false);
}

test('invitation re-entry helpers reject malformed secrets without database access',async()=>{
 const {store,queries}=readonlyStore();
 const object={toString(){throw Error('Tokens must not be coerced.');}};
 for(const value of [undefined,null,'','river-creator','e'.repeat(63),'e'.repeat(65),'E'.repeat(64),'g'.repeat(64),raw+'\n',object]){
  assert.equal(await store.recipientState(value),null);
  assert.equal(await store.accepted(value),null);
 }
 assert.deepEqual(queries,[]);
});

test('recipient state exposes only its account-setup category through one hashed read',async()=>{
 for(const state of ['new','pending','active','blocked']){
  const {store,queries}=readonlyStore([{state}]);
  assert.equal(await store.recipientState(raw),state);
  assertHashedRead(queries);
 }
});

test('missing pending invitations or consumed receipts return no re-entry identity',async()=>{
 for(const method of ['recipientState','accepted']){
  const {store,queries}=readonlyStore();
  assert.equal(await store[method](raw),null);
  assertHashedRead(queries);
 }
});

test('accepted invitation lookup returns only the account and creator slug through one hashed read',async()=>{
 const {store,queries}=readonlyStore([receipt]);
 const result=await store.accepted(raw);
 assert.deepEqual(result,receipt);
 assert.deepEqual(Object.keys(result).sort(),['accountId','slug']);
 assertHashedRead(queries);
 const projection=queries[0].sql.slice(0,queries[0].sql.search(/\bFROM\b/i));
 assert.doesNotMatch(projection,/email|token|password/i);
 assert.equal(JSON.stringify(result).includes(raw),false);
});
