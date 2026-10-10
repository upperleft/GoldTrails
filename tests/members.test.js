import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createMemberHandler,memberConfig,memberIdentity} from '../app/members.js';
import {createMemberStore} from '../app/member-store.js';
import {hashPassword,digest,verifyPassword} from '../app/admin-auth.js';
import {memberMail} from '../app/member-mail.js';
const origin='https://gold.example',csrf='a'.repeat(64),session='b'.repeat(64),link='c'.repeat(64);
async function fixture(t,options={}){const server=createServer({members:createMemberHandler({config:{origin,open:true},log:()=>{},...options})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return async(path,fields,extra={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',...(fields?{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:`__Host-gold-form=${csrf}`, ...extra},body:new URLSearchParams({csrf,...fields})}:extra)});}
test('signup remains closed without email, even when enabled',async t=>{let writes=0;const request=await fixture(t,{store:{ready:async()=>true,signup:async()=>writes++}});const response=await request('/signup/',{username:'newmember'});assert.equal(response.status,200);assert.match(await response.text(),/fieldset disabled/);assert.equal(writes,0);});
test('mutation requires matching origin and CSRF; email link GET cannot activate account',async t=>{let consumes=0;const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,consume:async()=>{consumes++;return true;}}});assert.equal((await request('/verify-email/',{token:link},{Origin:'https://other.example'})).status,403);assert.equal((await request('/verify-email/',{token:link,csrf:'d'.repeat(64)})).status,403);const response=await request('/verify-email/?token='+link);assert.equal(response.status,200);assert.equal(consumes,0);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal((await request('/verify-email/',{token:link})).status,200);assert.equal(consumes,1);});
test('verified login rotates session and account does not trust raw subscription level',async t=>{const hash=await hashPassword('an example long password');let loggedIn=false;const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,find:async()=>({id:'account',password_hash:hash,status:'active',email_verified_at:new Date(),auth_version:0}),logout:async()=>{},login:async(id,version,nonce)=>{assert.equal(id,'account');assert.equal(version,0);assert.notEqual(nonce,csrf);loggedIn=true;return session;},session:async()=>({username:'member',email:'me@example.com',account_number:28,level:'subscriber',effective_level:'free'})}});const response=await request('/login/',{email:'me@example.com',password:'an example long password'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/account/');assert.match(response.headers.get('set-cookie'),/__Host-gold-member=.*Secure; HttpOnly/);assert.ok(loggedIn);const page=await request('/account/',null,{headers:{Cookie:`__Host-gold-member=${session}`}});assert.match(await page.text(),/GT-000028/);});
test('recovery response does not expose account existence when delivery fails',async t=>{const request=await fixture(t,{mail:async()=>{throw Error('private provider message');},store:{ready:async()=>true,allow:async()=>true,find:async()=>({id:'account',email:'me@example.com',status:'active',email_verified_at:new Date()}),issue:async()=>link}});const response=await request('/forgot-password/',{email:'me@example.com'});assert.equal(response.status,200);assert.match(await response.text(),/If an eligible account exists/);});
test('signup normalizes identity and reserves administration names',()=>{const fields=new URLSearchParams({username:'Trail_Paul',email:' Paul@Example.com ',password:'an example long password',confirmPassword:'an example long password'});assert.equal(memberIdentity(fields).email,'paul@example.com');fields.set('username','ADMIN');assert.throws(()=>memberIdentity(fields));assert.equal(memberConfig({MEMBER_ORIGIN:'http://unsafe.example'}),null);});
test('signup writes profile, free membership and member role atomically, rolls back failures',async()=>{let committed=false,rolledBack=false,released=false;const queries=[];const connection={beginTransaction:async()=>{},commit:async()=>committed=true,rollback:async()=>rolledBack=true,release:()=>released=true,query:async(sql,args)=>{queries.push([sql,args]);if(sql.includes('member_role_grants'))throw Error('role insert failed');}};const store=createMemberStore({getConnection:async()=>connection});await assert.rejects(store.signup({username:'paul',email:'me@example.com',passwordHash:'hash',displayName:null}));assert.equal(committed,false);assert.ok(rolledBack&&released);assert.ok(queries.some(([sql])=>sql==='INSERT INTO member_memberships(account_id) VALUES(?)'));});
test('token consumption rechecks expiry under lock and refuses replay',async()=>{const queries=[];let consumed=false;const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql)=>{queries.push(sql);if(sql.startsWith('SELECT account_id'))return [{account_id:'account'}];if(sql.startsWith('SELECT status'))return [{status:'active'}];if(sql.startsWith('SELECT token_hash'))return consumed?[]:[{token_hash:digest(link)}];if(sql.startsWith('UPDATE member_tokens SET consumed'))consumed=true;return [];}};const store=createMemberStore({getConnection:async()=>connection});assert.equal(await store.consume(link,'reset_password','new-hash'),true);assert.equal(await store.consume(link,'reset_password','another-hash'),false);assert.ok(queries.some(sql=>sql.includes('auth_version=auth_version+1')));assert.ok(queries.some(sql=>sql.includes('UPDATE member_sessions SET revoked_at')));assert.ok(queries.find(sql=>sql.startsWith('SELECT token_hash')).includes('expires_at>UTC_TIMESTAMP(6) FOR UPDATE'));});
test('email adapter stays disabled until configured and sends only expected message',async()=>{assert.equal(memberMail({}),null);let payload;await memberMail({RESEND_API_KEY:'example-only',MEMBER_MAIL_FROM:'Gold <mail@example.com>'},async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');payload=JSON.parse(options.body);return {ok:true};})({to:'me@example.com',purpose:'verify_email',url:origin+'/verify-email/?token='+link});assert.deepEqual(payload.to,['me@example.com']);assert.match(payload.text,/24 hours/);});
test('signup with normal multi-cookie headers sends verification and shows a clear confirmation',async t=>{
 let created=0,sent=0;
 const request=await fixture(t,{mail:async message=>{assert.equal(message.purpose,'verify_email');sent++;},store:{ready:async()=>true,allow:async()=>true,signup:async data=>{assert.match(data.passwordHash,/^scrypt:/);created++;return{id:'member',email:data.email};},issue:async()=>link}});
 const page=await request('/signup/');
 assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
 assert.match(await page.text(),/member-forms\.js/);
 const result=await request('/signup/',{username:'newmember',email:'member@example.com',password:'an example long password',confirmPassword:'an example long password'},{Cookie:`other=value; __Host-gold-member=${session}; __Host-gold-form=${csrf}`});
 assert.equal(result.status,200);
 assert.match(await result.text(),/Your signup request was received/);
 assert.equal(created,1);assert.equal(sent,1);
});
test('signup rejects short and mismatched passwords without creating an account',async t=>{
 let writes=0;
 const request=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,allow:async()=>true,signup:async()=>writes++}});
 for(const fields of [{password:'short',confirmPassword:'short'},{password:'an example long password',confirmPassword:'a different long password'}]){
  const result=await request('/signup/',{username:'newmember',email:'member@example.com',...fields});
  assert.equal(result.status,400);assert.match(await result.text(),/role="alert"/);
 }
 assert.equal(writes,0);
});
test('signup email outage gives an actionable recovery page after account creation',async t=>{
 let created=false;
 const request=await fixture(t,{mail:async()=>{throw Error('private mail failure');},store:{ready:async()=>true,allow:async()=>true,signup:async()=>{created=true;return{id:'member',email:'member@example.com'};},issue:async()=>link}});
 const result=await request('/signup/',{username:'newmember',email:'member@example.com',password:'an example long password',confirmPassword:'an example long password'});
 assert.equal(result.status,503);const html=await result.text();assert.match(html,/Request a verification email/);assert.doesNotMatch(html,/private mail failure/);assert.ok(created);
});

test('eight-character member signup and reset work with one password input',async t=>{
 let created=0,reset=0;
 const request=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,allow:async()=>true,signup:async data=>{assert.ok(await verifyPassword('12345678',data.passwordHash));created++;return{id:'member',email:data.email};},issue:async()=>link,consume:async(raw,purpose,hash)=>{assert.equal(purpose,'reset_password');assert.ok(await verifyPassword('abcdefgh',hash));reset++;return true;}}});
 const fields={username:'newmember',email:'member@example.com',password:'12345678'};
 assert.equal((await request('/signup/',fields)).status,200);assert.equal(created,1);
 assert.equal((await request('/signup/',{...fields,password:'1234567'})).status,400);assert.equal(created,1);
 assert.equal((await request('/reset-password/',{token:link,password:'abcdefgh'})).status,200);assert.equal(reset,1);
 assert.equal((await request('/reset-password/',{token:link,password:'abcdefg'})).status,400);assert.equal(reset,1);
 for(const path of ['/signup/','/reset-password/?token='+link]){
  const html=await (await request(path)).text();assert.match(html,/minlength="8"/);assert.match(html,/autocomplete="new-password"/);assert.match(html,/data-password-toggle/);assert.doesNotMatch(html,/name="confirmPassword"/);
 }
 await assert.rejects(hashPassword('12345678'));
});

test('JSON signup retains origin and CSRF enforcement and reports confirmed server outcomes',async t=>{
 let writes=0,sends=0;const request=await fixture(t,{mail:async()=>sends++,store:{ready:async()=>true,allow:async()=>true,signup:async data=>{writes++;return{id:'member',email:data.email};},issue:async()=>link}});
 const fields={username:'newmember',email:'member@example.com',password:'12345678'},headers={Accept:'application/json'};
 const invalid=await request('/signup/',{...fields,password:'short'},headers);assert.equal(invalid.status,400);assert.equal((await invalid.json()).outcome,'error');assert.equal(writes,0);
 const forged=await request('/signup/',fields,{...headers,Origin:'https://other.example'});assert.equal(forged.status,403);assert.equal((await forged.json()).outcome,'error');
 const stale=await request('/signup/',{...fields,csrf:'b'.repeat(64)},headers);assert.equal(stale.status,403);assert.equal((await stale.json()).outcome,'error');
 const result=await request('/signup/',fields,headers);assert.equal(result.status,200);assert.match(result.headers.get('content-type'),/application\/json/);const data=await result.json();assert.equal(data.outcome,'email_requested');assert.equal(data.title,'Check your email');assert.doesNotMatch(JSON.stringify(data),/12345678|member@example.com|scrypt:/);assert.equal(writes,1);assert.equal(sends,1);
});
