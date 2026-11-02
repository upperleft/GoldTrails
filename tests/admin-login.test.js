import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createServer} from '../app/server.js';
import {createAdminHandler} from '../app/admin.js';
import {hashPassword,ADMIN_LOGIN_FORM_TTL_SECONDS,ADMIN_SESSION_TTL_SECONDS} from '../app/admin-auth.js';
import {createAdminStore} from '../app/admin-store.js';

const origin='https://gold.example',raw='a'.repeat(64),csrf='b'.repeat(64);
const owner='private-owner-fixture',password='fictional private administrator password';
const hash=hashPassword(password);
async function fixture(t,{allowed=true,authenticated=false}={}){
 const sessions=new Map([[raw,{raw,csrf_token:csrf,authenticated}]]),created=[];
 const store={session:async value=>sessions.get(value),newSession:async auth=>{created.push(auth);const value={raw:'c'.repeat(64),csrf_token:'d'.repeat(64),authenticated:auth};sessions.set(value.raw,value);return value;},allowLogin:async()=>allowed,logout:async value=>sessions.delete(value),list:async()=>[]};
 const server=createServer({admin:createAdminHandler({store,config:{origin,username:owner,passwordHash:await hash},log:()=>{}}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path='/admin/login/',init={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',...init});
 const post=(fields={},headers={})=>request('/admin/login/',{method:'POST',headers:{Cookie:'__Host-gold-admin='+raw,Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({csrf,username:owner,password,...fields})});
 return{request,post,created};
}

test('admin sign-in distinguishes credentials and allows only its pinned local visibility script',async t=>{
 const {request}=await fixture(t);
 const response=await request(),html=await response.text();
 assert.equal(response.status,200);
 assert.match(html,/Administrator username<input name="username"/);
 assert.match(html,/Administrator password<input id="admin-login-password" type="password"/);
 assert.match(html,/separate from your Gold Trails member email and password/);
 assert.match(html,/href="\/login\/">Member sign-in/);
 assert.match(html,/name="username"[^>]*value=""/);
 assert.doesNotMatch(html,new RegExp(owner));assert.ok(!html.includes(password));
 assert.match(html,/type="button"[^>]*data-admin-password-toggle aria-controls="admin-login-password" aria-pressed="false" hidden>Show password/);
 const script=html.match(/src="(\/admin-login\.js\?v=[a-f0-9]{12})"/)?.[1];assert.ok(script);
 assert.match(response.headers.get('content-security-policy'),/script-src https:\/\/gold\.example\/admin-login\.js;/);
 assert.doesNotMatch(response.headers.get('content-security-policy'),/script-src 'self'|unsafe-inline|unsafe-eval/);
 assert.equal(response.headers.get('cache-control'),'no-store');
 const asset=await request(script);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);
});

test('invalid admin credentials preserve only the escaped username and a visible helpful error',async t=>{
 const {post}=await fixture(t),username='reader@example.invalid"><script>private()</script>';
 const response=await post({username}),html=await response.text();
 assert.equal(response.status,401);
 assert.match(html,/class="admin-login-error" role="alert"/);
 assert.match(html,/Administrator sign-in details were not recognized/);
 assert.match(html,/value="reader@example.invalid&quot;&gt;&lt;script&gt;private\(\)&lt;\/script&gt;"/);
 assert.ok(!html.includes(username));assert.ok(!html.includes(password));
 const passwordField=html.match(/<input id="admin-login-password"[^>]*>/)?.[0];assert.ok(passwordField);assert.doesNotMatch(passwordField,/\bvalue=/);
 assert.match(html,/Show password/);assert.match(html,/href="\/login\/">Member sign-in/);
});

test('expired admin forms preserve the username with a usable fresh form but never authenticate',async t=>{
 const {post,created}=await fixture(t);
 const response=await post({csrf:'e'.repeat(64),username:'reader@example.invalid'}, {Cookie:'__Host-gold-admin='+'f'.repeat(64)});
 const html=await response.text();assert.equal(response.status,403);
 assert.match(html,/Your sign-in form expired/);assert.match(html,/value="reader@example.invalid"/);
 assert.match(html,/name="csrf" value="d{64}"/);assert.match(response.headers.get('set-cookie'),/__Host-gold-admin=c{64};.*HttpOnly/);
 assert.deepEqual(created,[false]);assert.ok(!html.includes(password));
 assert.match(response.headers.get('set-cookie'),/Max-Age=3600/);
 const mismatched=await post({csrf:'e'.repeat(64),username:'kept-username'});
 assert.equal(mismatched.status,403);assert.match(mismatched.headers.get('set-cookie'),/Max-Age=3600/);
 assert.match(await mismatched.text(),/value="kept-username"/);assert.deepEqual(created,[false,false]);
 const forged=await post({username:'must-not-echo'}, {Origin:'https://attacker.example'});
 assert.equal(forged.status,403);assert.doesNotMatch(await forged.text(),/must-not-echo|data-admin-password-toggle/);
 assert.deepEqual(created,[false,false]);
});

test('database expiry and cookie lifetime stay aligned, and expired login POSTs refresh before checking credentials',async t=>{
 let now=0,attempts=0;
 const rows=new Map(),inserted=[];
 const db={query:async(sql,args=[])=>{
  if(sql.startsWith('INSERT INTO admin_sessions')){
   const row={csrf_token:args[1],authenticated:args[2],expires:now+args[3]*1000};rows.set(args[0],row);inserted.push({...row,ttl:args[3]});return{};
  }
  if(sql.startsWith('SELECT csrf_token,authenticated FROM admin_sessions')){
   assert.match(sql,/expires_at>UTC_TIMESTAMP\(6\)/);
   const row=rows.get(args[0]);return row&&row.expires>now?[row]:[];
  }
  if(sql.startsWith('DELETE FROM admin_sessions WHERE expires_at')){for(const [key,row] of rows)if(row.expires<now)rows.delete(key);return{};}
  if(sql.startsWith('DELETE FROM admin_sessions WHERE token_hash')){rows.delete(args[0]);return{};}
  if(sql.startsWith('INSERT INTO admin_login_limits')){attempts++;return{};}
  if(sql.startsWith('SELECT attempts FROM admin_login_limits'))return[{attempts}];
  throw Error('Unexpected fixture SQL');
 }};
 const store=createAdminStore(db,'fictional-credential-version');
 const server=createServer({admin:createAdminHandler({store,config:{origin,username:owner,passwordHash:await hash},log:()=>{}}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(init={})=>fetch(`http://127.0.0.1:${server.address().port}/admin/login/`,{redirect:'manual',...init});
 const getCookie=response=>response.headers.get('set-cookie').split(';')[0];
 const getCsrf=html=>html.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
 const first=await request(),firstCookie=getCookie(first),firstCsrf=getCsrf(await first.text());
 assert.equal(ADMIN_LOGIN_FORM_TTL_SECONDS,3600);assert.equal(ADMIN_SESSION_TTL_SECONDS,28800);
 assert.match(first.headers.get('set-cookie'),/Max-Age=3600/);assert.equal(inserted.at(-1).ttl,3600);assert.equal(inserted.at(-1).authenticated,0);
 now=3599*1000;
 const reopened=await request({headers:{Cookie:firstCookie}}),reopenedCookie=getCookie(reopened),reopenedCsrf=getCsrf(await reopened.text());
 assert.equal(reopened.status,200);assert.notEqual(reopenedCookie,firstCookie);assert.notEqual(reopenedCsrf,firstCsrf);
 assert.equal(inserted.at(-1).expires-now,3600*1000);assert.match(reopened.headers.get('set-cookie'),/Max-Age=3600/);
 now+=3601*1000;
 const expired=await request({method:'POST',headers:{Cookie:reopenedCookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:reopenedCsrf,username:owner,password})});
 const expiredHtml=await expired.text();assert.equal(expired.status,403);assert.equal(attempts,0,'Expired forms never reach password-attempt checks');
 assert.equal(inserted.at(-1).authenticated,0);assert.equal(inserted.at(-1).ttl,3600);
 assert.match(expiredHtml,/refreshed for one hour/);assert.ok(!expiredHtml.includes(password));assert.match(expiredHtml,new RegExp('value="'+owner+'"'));
 const freshCookie=getCookie(expired),freshCsrf=getCsrf(expiredHtml);assert.notEqual(freshCookie,reopenedCookie);assert.notEqual(freshCsrf,reopenedCsrf);
 const accepted=await request({method:'POST',headers:{Cookie:freshCookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:freshCsrf,username:owner,password})});
 assert.equal(accepted.status,303);assert.equal(attempts,1);assert.equal(inserted.at(-1).authenticated,1);
 assert.equal(inserted.at(-1).ttl,28800);assert.match(accepted.headers.get('set-cookie'),/Max-Age=28800/);
});

test('rate limits and malformed admin forms retain explicit feedback without returning passwords',async t=>{
 const {post,request}=await fixture(t,{allowed:false});
 const limited=await post({username:'reader@example.invalid'}),html=await limited.text();
 assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');
 assert.match(html,/value="reader@example.invalid"/);assert.match(html,/role="alert"/);assert.ok(!html.includes(password));
 const malformed=await request('/admin/login/',{method:'POST',headers:{Origin:origin,Cookie:'__Host-gold-admin='+raw,'Content-Type':'application/x-www-form-urlencoded'},body:'username=first&username=second&password=do-not-return'});
 const malformedHtml=await malformed.text();assert.equal(malformed.status,400);
 assert.match(malformedHtml,/The sign-in form could not be read/);assert.match(malformedHtml,/data-admin-password-toggle/);assert.doesNotMatch(malformedHtml,/do-not-return/);
});

test('successful admin login still rotates the session and other workspace pages keep scripts disabled',async t=>{
 const {post,request,created}=await fixture(t);
 const login=await post();assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/admin/creators/');assert.deepEqual(created,[true]);
 const list=await request('/admin/creators/',{headers:{Cookie:'__Host-gold-admin='+'c'.repeat(64)}});
 assert.equal(list.status,200);assert.match(list.headers.get('content-security-policy'),/script-src 'none'/);assert.doesNotMatch(await list.text(),/admin-login\.js/);
});

test('admin password visibility preserves the value and hides it again on submit or browser restore',async()=>{
 const script=await readFile(new URL('../dist/admin-login.js',import.meta.url),'utf8');
 const value='fictional visibility-test password',field={type:'password',value},events={},windowEvents={};
 const form={elements:{namedItem:name=>name==='password'?field:null},addEventListener:(name,handler)=>events[name]=handler};
 const toggle={hidden:true,textContent:'Show password',attrs:{},closest:()=>form,setAttribute(name,value){this.attrs[name]=value;},addEventListener:(name,handler)=>events[name]=handler};
 runInNewContext(script,{document:{querySelectorAll:()=>[toggle]},window:{addEventListener:(name,handler)=>windowEvents[name]=handler}});
 assert.equal(toggle.hidden,false);
 events.click();assert.equal(field.type,'text');assert.equal(field.value,value);assert.equal(toggle.textContent,'Hide password');assert.equal(toggle.attrs['aria-pressed'],'true');
 events.click();assert.equal(field.type,'password');assert.equal(field.value,value);assert.equal(toggle.textContent,'Show password');assert.equal(toggle.attrs['aria-pressed'],'false');
 events.click();events.submit();assert.equal(field.type,'password');assert.equal(field.value,value);
 events.click();windowEvents.pageshow();assert.equal(field.type,'password');assert.equal(toggle.attrs['aria-pressed'],'false');assert.equal(field.value,value);
});
