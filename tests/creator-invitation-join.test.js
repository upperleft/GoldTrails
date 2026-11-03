import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorInvitationStore} from '../app/creator-invitations/store.js';
import {CreatorInvitationError} from '../app/creator-invitations/model.js';

const raw='a'.repeat(64);
const valid={username:'River_Creator-1',email:'creator@example.invalid',passwordHash:'scrypt:'+'b'.repeat(32)+':'+'c'.repeat(128),displayName:'River Creator',csrf:'d'.repeat(64)};
const coerced={toString(){throw Error('Account input must not be coerced.');}};

function unavailableDatabase(){
 let accesses=0;
 const unavailable=()=>{accesses++;throw Error('Boundary validation must finish before database access.');};
 return{store:createCreatorInvitationStore({query:unavailable,getConnection:unavailable}),accesses:()=>accesses};
}
const failure=(code,status)=>error=>error instanceof CreatorInvitationError&&error.code===code&&error.status===status;

test('coded invitation join rejects malformed secrets before opening a transaction',async()=>{
 const {store,accesses}=unavailableDatabase();
 for(const value of [undefined,null,'','river-creator','a'.repeat(63),'a'.repeat(65),'A'.repeat(64),'g'.repeat(64),raw+'\n',coerced]){
  await assert.rejects(()=>store.join(value,{...valid}),failure('invitation_unavailable',410));
 }
 assert.equal(accesses(),0);
});

test('coded invitation join rejects malformed account objects and usernames without database access',async()=>{
 const {store,accesses}=unavailableDatabase();
 for(const value of [null,undefined,[],coerced])await assert.rejects(()=>store.join(raw,value),failure('input',400));
 for(const username of [undefined,null,42,coerced,'','ab','a'.repeat(41),'river creator','river@example.invalid','créateur','river\ncreator','admin','Administrator','SUPPORT','goldtrails','Root']){
  await assert.rejects(()=>store.join(raw,{...valid,username}),failure('input',400));
 }
 assert.equal(accesses(),0);
});

test('coded invitation join requires a valid primitive email, stored password hash and CSRF token',async()=>{
 const {store,accesses}=unavailableDatabase();
 for(const email of [undefined,null,42,coerced,'','creator','creator@','a'.repeat(255)+'@example.invalid','creator@example.invalid\r\nBcc:other@example.invalid','creator\0@example.invalid']){
  await assert.rejects(()=>store.join(raw,{...valid,email}),failure('input',400));
 }
 for(const passwordHash of [undefined,null,42,coerced,'password','scrypt:'+'b'.repeat(31)+':'+'c'.repeat(128),'scrypt:'+'b'.repeat(32)+':'+'c'.repeat(127),'scrypt:'+'B'.repeat(32)+':'+'c'.repeat(128),valid.passwordHash+'\n']){
  await assert.rejects(()=>store.join(raw,{...valid,passwordHash}),failure('input',400));
 }
 for(const csrf of [undefined,null,42,coerced,'','d'.repeat(63),'d'.repeat(65),'D'.repeat(64),'g'.repeat(64),valid.csrf+'\n']){
  await assert.rejects(()=>store.join(raw,{...valid,csrf}),failure('input',400));
 }
 assert.equal(accesses(),0);
});

test('coded invitation join rejects oversized, control-bearing and non-string display names before database access',async()=>{
 const {store,accesses}=unavailableDatabase();
 for(const displayName of [42,coerced,[],{},'a'.repeat(181),'River\0Creator','River\rCreator','River\nCreator','River\tCreator','River\x7fCreator','River Creator\n','\tRiver Creator']){
  await assert.rejects(()=>store.join(raw,{...valid,displayName}),failure('input',400));
 }
 assert.equal(accesses(),0);
});
