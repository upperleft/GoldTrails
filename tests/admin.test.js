import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { hashPassword,verifyPassword,adminConfig,sessionCookie } from '../app/admin-auth.js';
import { creatorInput,createAdminHandler,FormError } from '../app/admin.js';
import { createAdminStore,EditConflict } from '../app/admin-store.js';
import { createServer } from '../app/server.js';
const origin='https://gold.example';
const csrf='a'.repeat(64), raw='b'.repeat(64), id='11111111-1111-4111-8111-111111111111';
function form(extra={}) { return new URLSearchParams({name:'Pioneer Pauly',slug:'pioneer-pauly',status:'draft',version:'0',instruction:'',channelCount:'1',...extra}); }
test('password hashes are salted and verify without exposing plaintext',async()=>{
 const hash=await hashPassword('a long test-only passphrase');assert(!hash.includes('passphrase'));
 assert(await verifyPassword('a long test-only passphrase',hash));assert(!await verifyPassword('wrong',hash));
 assert.notEqual(hash,await hashPassword('a long test-only passphrase'));
 assert.equal(adminConfig({ADMIN_USERNAME:'owner',ADMIN_PASSWORD_HASH:hash,ADMIN_ORIGIN:'http://gold.example'}),null);
 assert.match(sessionCookie(raw),/Secure; HttpOnly; SameSite=Strict/);
});
test('validation preserves unknowns, rejects unsafe links and future years',()=>{
 assert.equal(creatorInput(form()).instruction,null);
 assert.equal(creatorInput(form({instruction:'no'})).instruction,0);
 assert.throws(()=>creatorInput(form({since:'2200'})),FormError);
 assert.throws(()=>creatorInput(form({source:'javascript:alert(1)'})),FormError);
 assert.throws(()=>creatorInput(form({status:'published'})),FormError);
 assert.throws(()=>creatorInput(form({channelCount:'1',c0_name:'Channel',c0_url:'https://user:password@example.com',c0_platform:'YouTube',c0_status:'published'})),FormError);
});
test('HTTP workspace rejects anonymous, expired and forged writes; rotates login; saves and logs out',async()=>{
 const hash=await hashPassword('a long test-only passphrase');
 const sessions=new Map([[raw,{csrf_token:csrf,authenticated:0}]]);let saves=0,attempts=0;
 const store={session:async k=>sessions.get(k),newSession:async auth=>{const k='c'.repeat(64);const s={raw:k,csrf_token:csrf,authenticated:auth};sessions.set(k,s);return s;},logout:async k=>sessions.delete(k),allowLogin:async()=>++attempts<=10,list:async()=>[{id,display_name:'<script>bad</script>',slug:'pauly',publication_status:'draft'}],regions:async()=>[],get:async()=>({id,display_name:'Pauly',slug:'pauly',channels:[],sources:[],edit_version:0}),save:async()=>{saves++;return id;}};
 const admin=createAdminHandler({store,config:{username:'owner',passwordHash:hash,origin},log:()=>{}});
 const server=createServer({admin});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 const request=(path,opts={})=>fetch(base+path,{redirect:'manual',...opts});
 const post=(path,body,cookie=raw,from=origin)=>request(path,{method:'POST',headers:{Origin:from,Cookie:'__Host-gold-admin='+cookie,'Content-Type':'application/x-www-form-urlencoded'},body});
 try {
  assert.equal((await request('/admin/creators/')).headers.get('location'),'/admin/login/');
  assert.equal((await post('/admin/creators/new/',form({csrf}))).status,303);assert.equal(saves,0);
  assert.equal((await post('/admin/login/',form({csrf,username:'owner',password:'a long test-only passphrase'}),raw,'https://attacker.example')).status,403);
  assert.equal((await post('/admin/login/',form({csrf:'bad'}))).status,403);
  const login=await post('/admin/login/',form({csrf,username:'owner',password:'a long test-only passphrase'}));assert.equal(login.status,303);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert(!sessions.has(raw));
  const fresh='c'.repeat(64),headers={Cookie:'__Host-gold-admin='+fresh};
  const list=await request('/admin/creators/',{headers});assert.equal(list.status,200);assert.equal(list.headers.get('cache-control'),'no-store');assert((await list.text()).includes('&lt;script&gt;'));
  const edit=await request('/admin/creators/'+id+'/',{headers});assert((await edit.text()).includes('Save profile'));
  assert.equal((await post('/admin/creators/new/',form({csrf}),fresh)).status,303);assert.equal(saves,1);
  assert.equal((await post('/admin/logout/',new URLSearchParams({csrf}),fresh)).status,303);assert(!sessions.has(fresh));
  assert.equal((await request('/%ZZ')).status,400);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
test('store rolls back conflict and prevents writing another creator’s channel',async()=>{
 let committed=false,rolled=false,released=false;
 const conn={beginTransaction:async()=>{},query:async(sql)=>sql.startsWith('SELECT edit_version')?[{edit_version:1,archived_at:null}]:[],commit:async()=>{committed=true},rollback:async()=>{rolled=true},release:()=>{released=true}};
 const store=createAdminStore({getConnection:async()=>conn});
 await assert.rejects(()=>store.save(creatorInput(form(),id),'owner'),EditConflict);assert(rolled&&released&&!committed);
 rolled=false;released=false;
 const input=creatorInput(form({version:'1',c0_id:id,c0_name:'Other',c0_url:'https://example.com',c0_platform:'website',c0_status:'published'}),id);
 await assert.rejects(()=>store.save(input,'owner'),EditConflict);assert(rolled&&released&&!committed);
});
test('archive writes an audit row, and restore returns to draft',async()=>{
 const statements=[];const conn={beginTransaction:async()=>{},query:async(sql,args)=>{statements.push([sql,args]);return sql.startsWith('SELECT')?[{edit_version:3,archived_at:'2026-10-05'}]:[];},commit:async()=>{},rollback:async()=>{},release:()=>{}};
 await createAdminStore({getConnection:async()=>conn}).archive(id,3,true,'owner');
 assert(statements.some(([sql])=>sql.includes("publication_status='draft'")));assert(statements.some(([sql,args])=>sql.includes('creator_change_log')&&args[3]==='restore'));
});
