import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { hashPassword,verifyPassword,adminConfig,sessionCookie } from '../app/admin-auth.js';
import { creatorInput,createAdminHandler,FormError } from '../app/admin.js';
import { createAdminStore,EditConflict } from '../app/admin-store.js';
import { createServer } from '../app/server.js';
const origin='https://gold.example';
const csrf='a'.repeat(64), raw='b'.repeat(64), id='11111111-1111-4111-8111-111111111111';
function form(extra={}) { return new URLSearchParams({name:'Pioneer Pauly',slug:'pioneer-pauly',status:'draft',version:'0',instruction:'',channelCount:'1',taxonomy:'1',...extra}); }
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
 const store={session:async k=>sessions.get(k),newSession:async auth=>{const k='c'.repeat(64);const s={raw:k,csrf_token:csrf,authenticated:auth};sessions.set(k,s);return s;},logout:async k=>sessions.delete(k),allowLogin:async()=>++attempts<=10,list:async()=>[{id,display_name:'<script>bad</script>',slug:'pauly',publication_status:'draft'}],regions:async()=>[],taxonomy:async()=>({roles:[],topics:[],associatesEnabled:true}),get:async()=>({id,display_name:'Pauly',slug:'pauly',channels:[],sources:[],edit_version:0}),save:async()=>{saves++;return id;}};
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
  const edit=await request('/admin/creators/'+id+'/',{headers});const markup=await edit.text();assert(markup.includes('Save profile'));assert(markup.includes('People &amp; associates'));assert(markup.includes('name="associateCount"'));assert(markup.includes('Draft — private'));
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

test('classification validates IDs and requires a current form to prevent accidental clearing',()=>{
 assert.throws(()=>creatorInput(form({role_admin:'1'})),FormError);
 const old=form();old.delete('taxonomy');assert.throws(()=>creatorInput(old),FormError);
 const input=creatorInput(form({['role_'+id]:'1',['topic_'+id]:'1'}));assert.deepEqual(input.roles,[id]);assert.deepEqual(input.topics,[id]);
});
test('classification save archives deselections, restores selected links and preserves specialized topics',async()=>{
 const chosen='22222222-2222-4222-8222-222222222222',removed='33333333-3333-4333-8333-333333333333';
 const statements=[];let committed=false;
 const conn={beginTransaction:async()=>{},query:async(sql,args)=>{
  statements.push([sql,args]);
  if(sql.startsWith('SELECT edit_version'))return[{edit_version:0,archived_at:null}];
  if(sql.startsWith('SELECT id FROM public_roles')||sql.startsWith('SELECT id FROM topics'))return[{id:chosen}];
  if(sql.startsWith('SELECT role_id'))return[{role_id:removed}];
  if(sql.startsWith('SELECT topic_id'))return[{topic_id:removed}];
  return[];
 },commit:async()=>{committed=true},rollback:async()=>{},release:()=>{}};
 const input=creatorInput(form({['role_'+chosen]:'1',['topic_'+chosen]:'1'}),id);
 await createAdminStore({getConnection:async()=>conn}).save(input,'owner');assert(committed);
 assert(statements.some(([sql,args])=>sql.startsWith('UPDATE person_public_roles')&&args[1]===removed));
 assert(statements.some(([sql])=>sql.startsWith('UPDATE person_topics')&&sql.includes("relationship_type='content_topic'")));
 assert(statements.some(([sql])=>sql.startsWith('INSERT INTO person_public_roles')&&sql.endsWith('archived_at=NULL')));
 assert(!statements.some(([sql])=>sql.startsWith('DELETE')||sql.includes('UPDATE source_references')));
});
test('unknown vocabulary rolls back before profile or associations change',async()=>{
 let rolled=false,writes=0;
 const conn={beginTransaction:async()=>{},query:async(sql)=>{if(sql.startsWith('SELECT edit_version'))return[{edit_version:0,archived_at:null}];if(sql.startsWith('UPDATE')||sql.startsWith('INSERT'))writes++;return[];},commit:async()=>{},rollback:async()=>{rolled=true},release:()=>{}};
 await assert.rejects(()=>createAdminStore({getConnection:async()=>conn}).save(creatorInput(form({['role_'+id]:'1'}),id),'owner'),EditConflict);
 assert(rolled);assert.equal(writes,0);
});

test('associates validate public names, relationships, ownership and safe URLs',async()=>{
 const fields={associates:'1',associateCount:'1',a0_name:'A collaborator',a0_relationship:'co_creator',a0_status:'draft'};
 assert.equal(creatorInput(form(fields)).associates[0].name,'A collaborator');
 assert.equal(creatorInput(form()).associates,null);
 assert.throws(()=>creatorInput(form({...fields,a0_url:'javascript:alert(1)'})),FormError);
 assert.throws(()=>creatorInput(form({...fields,a0_relationship:'admin'})),FormError);
 let rolled=false;const statements=[];
 const conn={beginTransaction:async()=>{},query:async(sql,args)=>{statements.push([sql,args]);if(sql.startsWith('SELECT edit_version'))return[{edit_version:0,archived_at:null}];if(sql.includes('schema_migrations'))return[{version:'003_creator_associates'}];return[];},commit:async()=>{throw new Error('Must not commit');},rollback:async()=>{rolled=true},release:()=>{}};
 await assert.rejects(()=>createAdminStore({getConnection:async()=>conn}).save(creatorInput(form({...fields,a0_id:id}),id),'owner'),EditConflict);
 assert(rolled);assert(!statements.some(([sql])=>sql.startsWith('UPDATE creator_associates')));
});

test('channel publishing years distinguish unknown, known and stale forms',()=>{
 const ch={c0_name:'Videos',c0_url:'https://www.youtube.com/@example',c0_platform:'YouTube',c0_status:'published'};
 assert.equal(creatorInput(form(ch)).channels[0].publishingSince,undefined);
 assert.equal(creatorInput(form({...ch,c0_since:''})).channels[0].publishingSince,null);
 assert.equal(creatorInput(form({...ch,c0_since:'2023'})).channels[0].publishingSince,2023);
 assert.throws(()=>creatorInput(form({...ch,c0_since:'1985'})),FormError);
 assert.throws(()=>creatorInput(form({...ch,c0_since:'2200'})),FormError);
});
