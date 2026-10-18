import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createMemberHandler,memberConfig,memberIdentity} from '../app/members.js';
import {createMemberStore} from '../app/member-store.js';
import {hashPassword,digest,verifyPassword} from '../app/admin-auth.js';
import {memberMail} from '../app/member-mail.js';
import {createCalendarHandler} from '../app/calendar/handler.js';
import {calendarMemoryStore} from './helpers/calendar-memory.js';
const origin='https://gold.example',csrf='a'.repeat(64),session='b'.repeat(64),link='c'.repeat(64);
test('account overview keeps private access, escaped identity, entitlement links and protected sign-out',async t=>{
 for(const effective_level of ['free','subscriber',undefined]){
  let signouts=0;
  const request=await fixture(t,{store:{ready:async()=>true,session:async raw=>raw===session?{display_name:'Alex <script>bad()</script>',username:'TrailReader',email:'alex@example.invalid',account_number:42,level:'subscriber',effective_level,csrf_token_hash:digest(csrf)}:null,logout:async()=>signouts++}});
  const anonymous=await request('/account/');assert.equal(anonymous.status,303);assert.equal(anonymous.headers.get('location'),'/login/');
  const headers={Cookie:`__Host-gold-member=${session}; __Host-gold-form=${csrf}`};
  const response=await request('/account/',null,{headers}),html=await response.text();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.match(html,/Alex &lt;script&gt;bad\(\)&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>bad/);
  assert.match(html,new RegExp(effective_level==='subscriber'?'href="/gold-almanac/">Open Almanac':'href="/plus/">Explore Plus'));
  if(effective_level==='subscriber')assert.match(html,/class="camp-shortcut" href="\/connections\/mine\/"/);
  else assert.doesNotMatch(html,/connections/i);
  assert.match(html,/<form method="post" action="\/logout\/">/);assert.match(html,new RegExp(`name="csrf" value="${csrf}"`));
  assert.equal((await request('/logout/',null,{headers})).status,405);assert.equal(signouts,0);
  assert.equal((await request('/logout/',{csrf:'d'.repeat(64)},headers)).status,403);assert.equal(signouts,0);
  const logout=await request('/logout/',{},headers);assert.equal(logout.status,303);assert.equal(signouts,1);
 }
});
async function fixture(t,options={}){const server=createServer({members:createMemberHandler({config:{origin,open:true},log:()=>{},...options})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return async(path,fields,extra={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',...(fields?{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:`__Host-gold-form=${csrf}`, ...extra},body:new URLSearchParams({csrf,...fields})}:extra)});}
test('signup remains closed without email, even when enabled',async t=>{let writes=0;const request=await fixture(t,{store:{ready:async()=>true,signup:async()=>writes++}});const response=await request('/signup/',{username:'newmember'});assert.equal(response.status,200);assert.match(await response.text(),/fieldset disabled/);assert.equal(writes,0);});
test('mutation requires matching origin and CSRF; email link GET cannot activate account',async t=>{let consumes=0;const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,consume:async()=>{consumes++;return true;}}});assert.equal((await request('/verify-email/',{token:link},{Origin:'https://other.example'})).status,403);assert.equal((await request('/verify-email/',{token:link,csrf:'d'.repeat(64)})).status,403);const response=await request('/verify-email/?token='+link);assert.equal(response.status,200);assert.equal(consumes,0);assert.equal(response.headers.get('referrer-policy'),'strict-origin');assert.equal((await request('/verify-email/',{token:link})).status,200);assert.equal(consumes,1);});
test('verified login rotates session and account does not trust raw subscription level',async t=>{const hash=await hashPassword('an example long password');let loggedIn=false;const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,find:async()=>({id:'account',password_hash:hash,status:'active',email_verified_at:new Date(),auth_version:0}),logout:async()=>{},login:async(id,version,nonce)=>{assert.equal(id,'account');assert.equal(version,0);assert.notEqual(nonce,csrf);loggedIn=true;return session;},session:async()=>({username:'member',email:'me@example.com',account_number:28,level:'subscriber',effective_level:'free'})}});const response=await request('/login/',{email:'me@example.com',password:'an example long password'});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/account/');assert.match(response.headers.get('set-cookie'),/__Host-gold-member=.*Secure; HttpOnly/);assert.ok(loggedIn);const page=await request('/account/',null,{headers:{Cookie:`__Host-gold-member=${session}`}});assert.match(await page.text(),/GT-000028/);});
test('one website sign-in opens the calendar with the same session and rotated CSRF',async t=>{
 const hash=await hashPassword('an example long password'),sessions=new Map(),calendarStore=calendarMemoryStore();
 const memberStore={ready:async()=>true,allow:async()=>true,find:async()=>({id:'member',password_hash:hash,status:'active',email_verified_at:new Date(),auth_version:0}),logout:async raw=>sessions.delete(raw),login:async(id,version,nonce)=>{sessions.set(session,{id,username:'Member',effective_level:'free',csrf_token_hash:digest(nonce)});return session;},session:async raw=>sessions.get(raw)};
 const server=createServer({members:createMemberHandler({store:memberStore,config:{origin},log:()=>{}}),calendar:createCalendarHandler({members:memberStore,store:calendarStore,config:{origin},log:()=>{}})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path,options={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',...options});
 const homepage=await request('/');assert.equal(homepage.status,200);assert.match(await homepage.text(),/href="\/calendar\/">My calendar/);
 const preview=await(await request('/calendar/')).text();assert.match(preview,/href="\/login\/\?next=\/calendar\/">Sign in/);assert.doesNotMatch(preview,/Sign in to your calendar/);
 const loginPage=await(await request('/login/?next=/calendar/')).text();assert.match(loginPage,/Sign in to Gold Trails/);assert.match(loginPage,/name="next" value="\/calendar\/"/);
 const login=await request('/login/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:`__Host-gold-form=${csrf}`},body:new URLSearchParams({csrf,email:'member@example.com',password:'an example long password',next:'/calendar/'})});
 assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/calendar/');
 const cookies=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),freshCsrf=cookies.match(/__Host-gold-form=([a-f0-9]{64})/)[1];assert.notEqual(freshCsrf,csrf);
 const calendar=await request('/calendar/',{headers:{Cookie:cookies}});assert.equal(calendar.status,200);assert.match(await calendar.text(),/data-calendar-app/);
 const created=await request('/calendar/api/calendars',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookies},body:JSON.stringify({csrf:freshCsrf,name:'Website account plans',color:'#785434'})});assert.equal(created.status,201);assert.equal(calendarStore.calendars.size,1);
 assert.equal((await request('/calendar/api/calendars')).status,401);
});
test('website login retains a calendar destination after failed sign-in and rejects arbitrary redirects',async t=>{
 const hash=await hashPassword('an example long password');
 const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,find:async()=>({id:'member',password_hash:hash,status:'active',email_verified_at:new Date(),auth_version:0}),logout:async()=>{},login:async()=>session,session:async()=>({effective_level:'free'})}});
 const failed=await request('/login/',{email:'member@example.com',password:'wrong password',next:'/calendar/'});assert.equal(failed.status,401);assert.match(await failed.text(),/name="next" value="\/calendar\/"/);
 for(const next of ['https://evil.example/','//evil.example/','/\\evil.example/','/calendar/?next=https://evil.example','%2F%2Fevil.example','/calendar/\r\nLocation: https://evil.example']){
  const page=await request('/login/?next='+encodeURIComponent(next));assert.doesNotMatch(await page.text(),/name="next"/);
  const response=await request('/login/',{email:'member@example.com',password:'an example long password',next});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/account/');
 }
});
test('an existing website session continues into the calendar without signing in again or rotating sessions',async t=>{
 let rotations=0,signouts=0;const request=await fixture(t,{store:{ready:async()=>true,session:async raw=>raw===session?{effective_level:'subscriber',csrf_token_hash:digest(csrf)}:null,login:async()=>rotations++,logout:async()=>signouts++}});
 const headers={Cookie:`__Host-gold-member=${session}; __Host-gold-form=${csrf}`};
 for(const method of ['GET','HEAD']){const response=await request('/login/?next=/calendar/',null,{method,headers});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/calendar/');assert.equal(response.headers.get('set-cookie'),null);}
 const fallback=await request('/login/?next=//evil.example/',null,{headers});assert.equal(fallback.headers.get('location'),'/account/');assert.equal(rotations,0);assert.equal(signouts,0);
 const missingForm=await request('/login/?next=/calendar/',null,{headers:{Cookie:`__Host-gold-member=${session}`}});assert.equal(missingForm.status,200);assert.match(await missingForm.text(),/name="password"/);
});
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


test('verification welcomes only after consumption; invalid origins, CSRF and replay cannot activate',async t=>{
 let consumed=false,calls=0;
 const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,consume:async(raw,purpose)=>{calls++;assert.equal(raw,link);assert.equal(purpose,'verify_email');if(consumed)return false;consumed=true;return true;}}});
 for(const path of ['/login/','/verify-email/?token='+link,'/reset-password/?token='+link]){
  const response=await request(path);assert.equal(response.headers.get('referrer-policy'),'strict-origin');assert.equal(response.headers.get('cache-control'),'private, no-store');
 }
 for(const badOrigin of ['null','','https://evil.example'])assert.equal((await request('/verify-email/',{token:link},{Origin:badOrigin})).status,403);
 assert.equal((await request('/verify-email/',{token:link,csrf:'d'.repeat(64)})).status,403);assert.equal(calls,0);
 const success=await request('/verify-email/',{token:link});assert.equal(success.status,200);const html=await success.text();assert.match(html,/Welcome to Gold Trails/);assert.match(html,/Your email is verified/);assert.match(html,/href="\/login\/">Sign in to Gold Trails/);assert.doesNotMatch(html,new RegExp(link));
 const replay=await request('/verify-email/',{token:link});assert.equal(replay.status,400);const retry=await replay.text();assert.match(retry,/Request a new email/);assert.doesNotMatch(retry,/Your email is verified/);
});

test('signup and member sign-in identify email consistently to password managers',async t=>{
 const request=await fixture(t,{mail:async()=>{},store:{ready:async()=>true}});
 const signup=await(await request('/signup/')).text(),login=await(await request('/login/')).text();
 for(const html of [signup,login])assert.match(html,/<input id="member-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false"/);
 assert.match(signup,/id="member-username" name="username" type="text" autocomplete="nickname"/);
 assert.match(signup,/autocomplete="new-password"/);assert.match(login,/autocomplete="current-password"/);
 assert.ok(signup.indexOf('name="displayName"')<signup.indexOf('id="member-email"'));
 assert.match(login,/Sign in with the email address/);
 const closed=await fixture(t,{store:{ready:async()=>true}});assert.match(await(await closed('/signup/')).text(),/type="email" autocomplete="username"/);
});
test('a valid reset link identifies its own account for autofill; viewing it cannot reset a password',async t=>{
 let consumed=0;const request=await fixture(t,{store:{ready:async()=>true,allow:async()=>true,resetAccount:async raw=>raw===link?{email:'member@example.com'}:null,consume:async(raw,purpose,hash)=>{assert.equal(raw,link);assert.equal(purpose,'reset_password');assert.ok(await verifyPassword('new-password-example',hash));consumed++;return true;}}});
 const page=await request('/reset-password/?token='+link+'&email=other@example.com');assert.equal(page.status,200);const html=await page.text();assert.match(html,/name="email" type="email" autocomplete="username"[^>]*value="member@example.com" readonly/);assert.match(html,/autocomplete="new-password"/);assert.doesNotMatch(html,/other@example.com/);assert.equal(consumed,0);
 const changed=await request('/reset-password/',{token:link,password:'new-password-example',email:'other@example.com'});assert.equal(changed.status,200);assert.equal(consumed,1);
 const expired=await request('/reset-password/?token='+'d'.repeat(64));assert.equal(expired.status,400);assert.doesNotMatch(await expired.text(),/name="password"|member@example.com/);
});
test('reset identity lookup only returns an active verified account for a live password-reset token',async()=>{
 let calls=0;const store=createMemberStore({query:async(sql,args)=>{calls++;assert.match(sql,/t\.purpose='reset_password'/);assert.match(sql,/t\.consumed_at IS NULL AND t\.revoked_at IS NULL AND t\.expires_at>UTC_TIMESTAMP/);assert.match(sql,/a\.status='active' AND a\.email_verified_at IS NOT NULL AND a\.archived_at IS NULL/);assert.deepEqual(args,[digest(link)]);return[{email:'member@example.com'}];}});
 assert.equal(await store.resetAccount('invalid'),null);assert.equal(calls,0);assert.deepEqual(await store.resetAccount(link),{email:'member@example.com'});assert.equal(calls,1);
});

test('new and duplicate signup responses offer account recovery without revealing which account exists',async t=>{
 const fields={username:'trailmember',email:'member@example.com',password:'an example long password'};let sent=0;
 const fresh=await fixture(t,{mail:async()=>sent++,store:{ready:async()=>true,allow:async()=>true,signup:async()=>({id:'new',email:fields.email}),issue:async()=>link}});
 const duplicate=await fixture(t,{mail:async()=>{throw Error('Duplicate must not send');},store:{ready:async()=>true,allow:async()=>true,signup:async()=>{throw Object.assign(new Error('Duplicate'),{code:'ER_DUP_ENTRY'});}}});
 const responses=await Promise.all([fresh('/signup/',fields,{Accept:'application/json'}),duplicate('/signup/',fields,{Accept:'application/json'})]);
 assert.ok(responses.every(r=>r.status===200));const [a,b]=await Promise.all(responses.map(r=>r.json()));assert.deepEqual(a,b);assert.match(a.message,/reset your existing password/);assert.match(a.message,/does not change an existing password/);assert.equal(sent,1);
 const html=await(await duplicate('/signup/',fields)).text();assert.match(html,/href="\/forgot-password\/"/);
});
test('resend explains that verified accounts need sign-in or recovery without exposing account status',async t=>{
 let sent=0;const results=[];
 for(const account of [null,{id:'existing',status:'active',email:'member@example.com',email_verified_at:new Date()}]){
  const request=await fixture(t,{mail:async()=>sent++,store:{ready:async()=>true,allow:async()=>true,find:async()=>account}});
  results.push(await(await request('/resend-verification/',{email:'member@example.com'})).text());
 }
 assert.equal(sent,0);assert.equal(results[0],results[1]);assert.match(results[0],/already verified will not receive another verification email/);assert.match(results[0],/href="\/forgot-password\/"/);
});
