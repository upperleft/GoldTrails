import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createCreatorInvitationHandler} from '../app/creator-invitations/handler.js';
import {CreatorInvitationError} from '../app/creator-invitations/model.js';
import {createMemberHandler} from '../app/members.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {digest,verifyPassword} from '../app/admin-auth.js';

const origin='https://gold.example',path='/creator-invitation/';
const code='c'.repeat(64),csrf='a'.repeat(64),freshSession='e'.repeat(64);
const invitedEmail='creator@example.invalid',slug='river-teacher';
const accountId='33333333-3333-4333-8333-333333333333';
const password='a creator test password';
const cookies=values=>Object.entries(values).map(([key,value])=>`__Host-gold-${key}=${value}`).join('; ');
const privateCookies=()=>cookies({form:csrf,'creator-invite':code});

async function fixture(t,options={}){
 const state={joins:[],accepts:0,mail:0,ordinarySignups:0,allowed:[],logs:[],consumed:false,revoked:false,expired:false};
 const profile={slug,display_name:'River Teacher <script>unsafe()</script>'};
 const invitation={id:'11111111-1111-4111-8111-111111111111',person_id:'22222222-2222-4222-8222-222222222222',target_email:invitedEmail,
  ...profile,expires_at:new Date(Date.now()+14*86400000).toISOString(),status:'pending'};
 let joined=null;
 const store={
  ready:async()=>true,
  read:async value=>value===code&&!state.consumed&&!state.revoked&&!state.expired?{...invitation}:null,
  readNamed:async name=>name===slug&&!state.consumed&&!state.revoked&&!state.expired?{...invitation,named:true,matched:false,id:null,target_email:null}:null,
  accept:async()=>{state.accepts++;assert.fail('Direct account creation must use the atomic join operation');},
  join:async(raw,data)=>{
   state.joins.push({raw,...data});assert.equal(raw,code);assert.equal(data.email,invitedEmail);
   assert.equal(data.username,'NewCreator');assert.ok(await verifyPassword(password,data.passwordHash));
   assert.match(data.csrf,/^[a-f0-9]{64}$/);assert.notEqual(data.csrf,csrf);
   state.consumed=true;
   joined={id:accountId,username:data.username,display_name:data.displayName||data.username,email:invitedEmail,
    account_number:42,effective_level:'subscriber',grant_source:'complimentary',ends_at:null,csrf_token_hash:digest(data.csrf)};
   return {session:freshSession,profile,accountId};
  },
  acceptedProfile:async id=>id===accountId&&state.consumed?profile:null,
  ...options.store
 };
 const members={
  ready:async()=>true,
  allow:async scope=>{state.allowed.push(scope);return true;},
  session:async raw=>raw===freshSession?joined:null,
  signup:async()=>{state.ordinarySignups++;assert.fail('Private invitation cannot use ordinary signup');},
  ...options.members
 };
 const config={origin,open:true},log=message=>state.logs.push(String(message));
 const server=createServer({
  creatorInvitations:createCreatorInvitationHandler({store,members,config,log}),memberSessions:members,
  members:createMemberHandler({store:members,invitations:store,config,mail:async()=>state.mail++,log}),
  homepage:createHomepageHandler({members,invitations:store,config,guests:null}),goldPrice:async()=>({}),log
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(url,init={})=>fetch(`http://127.0.0.1:${server.address().port}${url}`,{redirect:'manual',...init});
 const submit=(fields={},headers={})=>request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:privateCookies(),...headers},
  body:new URLSearchParams({csrf,action:'create_account',username:'NewCreator',email:invitedEmail,password,displayName:'River Friend',...fields})});
 return {request,submit,state};
}

function assertNoPrivateOutput(response,html){
 assert.ok(!html.includes(code),'Invitation code stays out of HTML');
 assert.ok(!html.includes(password),'Passwords stay out of HTML');
 assert.ok(!(response.headers.get('location')||'').includes(code),'Invitation code stays out of redirect URLs');
 assert.ok(!(response.headers.get('location')||'').includes(password),'Passwords stay out of redirect URLs');
}

test('private creator-name code links exchange into a secure cookie on GET and HEAD without creating access',async t=>{
 const {request,state}=await fixture(t);
 for(const method of ['GET','HEAD','GET'])for(const suffix of ['','/']){
  const response=await request('/invite/'+slug+suffix+'?code='+code,{method,headers:{Cookie:cookies({'creator-name':'someone-else'})}});
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('cache-control'),/private.*no-store|no-store.*private/);
  assert.match(response.headers.get('x-robots-tag'),/noindex/);
  const invitation=response.headers.getSetCookie().find(value=>value.startsWith('__Host-gold-creator-invite='+code+';'));
  assert.ok(invitation);assert.match(invitation,/Path=\/; Secure; HttpOnly; SameSite=Lax/);
  const age=Number(invitation.match(/Max-Age=(\d+)/)?.[1]);assert.ok(age>0&&age<=14*86400);
  assert.ok(response.headers.getSetCookie().some(value=>/^__Host-gold-creator-name=;/.test(value)&&/Max-Age=0/.test(value)));
  const html=await response.text();assertNoPrivateOutput(response,html);if(method==='HEAD')assert.equal(html,'');
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);assert.equal(state.consumed,false);
});

test('private code links reject unknown, malformed, duplicate or mismatched capabilities without setting a usable invitation',async t=>{
 const {request,state}=await fixture(t);
 for(const url of [
  '/invite/'+slug+'/?code=short',
  '/invite/'+slug+'/?code='+'f'.repeat(64),
  '/invite/'+slug+'/?code='+code+'&code='+code,
  '/invite/'+slug+'/?code='+code+'&next=https://other.example/',
  '/invite/'+slug+'/?code='+code+'&token='+code,
  '/invite/another-creator/?code='+code
 ]){
  for(const method of ['GET','HEAD']){
   const response=await request(url,{method});assert.equal(response.status,410,url);
   assert.ok(!response.headers.getSetCookie().some(value=>value.startsWith('__Host-gold-creator-invite='+code+';')));
   assertNoPrivateOutput(response,await response.text());
  }
 }
 for(const flag of ['expired','revoked','consumed']){
  state[flag]=true;const response=await request('/invite/'+slug+'/?code='+code);assert.equal(response.status,410);state[flag]=false;
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('a clean private invitation supplies a direct, readonly-email account form with password visibility and no verification detour',async t=>{
 const {request,state}=await fixture(t);
 for(const entry of ['/invite/'+slug+'/?code='+code,path+'?token='+code]){
  const exchanged=await request(entry);assert.equal(exchanged.status,303);assert.equal(exchanged.headers.get('location'),'/');
  const headers={Cookie:privateCookies()};
  const home=await request('/',{headers});assert.equal(home.status,200);const homeHtml=await home.text();
  assert.ok(!homeHtml.includes(invitedEmail));assertNoPrivateOutput(home,homeHtml);
  const response=await request(path,{headers});assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/data-creator-access-flow/);assert.doesNotMatch(html,/<nav\b|<aside\b|href="\/prospectors\//);
  const form=html.match(/<form\b[^>]*action="\/creator-invitation\/"[\s\S]*?<\/form>/)?.[0];assert.ok(form);
  assert.match(form,/method="post"/);assert.match(form,/name="action" value="create_account"/);assert.match(form,/name="csrf"/);
  assert.match(form,/name="username"/);assert.match(form,/name="password"[^>]*autocomplete="new-password"/);
  const email=form.match(/<input\b[^>]*name="email"[^>]*>/)?.[0];assert.ok(email);
  assert.match(email,/\breadonly\b/);assert.ok(email.includes('value="'+invitedEmail+'"'));
  assert.match(form,/data-password-toggle/);assert.match(html,/src="\/member-forms\.js\?v=/);
  assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  assert.doesNotMatch(html,/href="\/(?:signup|verify-email|resend-verification)\/|verify your email|verification email is on its way/i);
  assertNoPrivateOutput(response,html);
  const head=await request(path,{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('direct private-invitation signup joins once, rotates session and CSRF, and returns to the active homepage without mail',async t=>{
 const {request,submit,state}=await fixture(t);
 const response=await submit();assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/?creator=accepted');
 assertNoPrivateOutput(response,await response.text());
 assert.equal(state.joins.length,1);assert.equal(state.accepts,0);assert.equal(state.ordinarySignups,0);assert.equal(state.mail,0);
 assert.deepEqual(new Set(state.allowed),new Set(['signup','token']));assert.equal(state.consumed,true);
 const fresh=state.joins[0].csrf,setCookies=response.headers.getSetCookie();
 assert.ok(setCookies.some(value=>value.startsWith('__Host-gold-member='+freshSession+';')&&/Secure; HttpOnly; SameSite=Lax/.test(value)));
 assert.ok(setCookies.some(value=>value.startsWith('__Host-gold-form='+fresh+';')&&/Secure; HttpOnly; SameSite=Lax/.test(value)));
 for(const name of ['creator-invite','creator-name'])assert.ok(setCookies.some(value=>value.startsWith('__Host-gold-'+name+'=;')&&/Max-Age=0/.test(value)));
 const home=await request('/?creator=accepted',{headers:{Cookie:cookies({member:freshSession,form:fresh})}});assert.equal(home.status,200);
 const homeHtml=await home.text();assert.match(homeHtml,/data-creator-membership-ready/);assert.match(homeHtml,/href="\/prospectors\/river-teacher\/"/);
 assert.doesNotMatch(homeHtml,/data-creator-access-flow|<script>unsafe/);assertNoPrivateOutput(home,homeHtml);
 const replay=await submit();assert.equal(replay.status,410);assert.equal(state.joins.length,1);assert.equal(state.mail,0);
});

test('direct private-invitation signup requires the bound capability, correct Origin and matching form CSRF',async t=>{
 const {submit,state}=await fixture(t);
 for(const headers of [
  {Origin:'https://other.example'}, {Origin:'null'}, {Origin:''},
  {Cookie:cookies({'creator-invite':code})},
  {Cookie:cookies({form:csrf})},
  {Cookie:cookies({form:csrf,'creator-invite':'f'.repeat(64)})},
  {Cookie:cookies({form:csrf,'creator-name':slug})}
 ]){
  const response=await submit({},headers);assert.ok([400,403,410].includes(response.status));assertNoPrivateOutput(response,await response.text());
 }
 for(const bad of ['','short','f'.repeat(64)]){
  const response=await submit({csrf:bad});assert.equal(response.status,403);assertNoPrivateOutput(response,await response.text());
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('readonly email and credential validation cannot be bypassed by a modified create-account submission',async t=>{
 const {submit,state}=await fixture(t);
 for(const fields of [
  {email:'another@example.invalid'}, {email:''},
  {username:'admin'}, {username:'bad!'}, {username:'ab'},
  {password:'weak!'}, {password:'x'.repeat(129)}, {displayName:'x'.repeat(181)},
  {token:code}
 ]){
  const response=await submit(fields);assert.ok([400,403].includes(response.status));const html=await response.text();assertNoPrivateOutput(response,html);
  if(fields.password)assert.ok(!html.includes(fields.password),'Rejected password is never reflected into the account form');
 }
 assert.equal(state.joins.length,0);assert.equal(state.ordinarySignups,0);assert.equal(state.mail,0);assert.equal(state.consumed,false);
});

test('client-supplied invitation codes or action names cannot turn a public-name invitation into direct signup',async t=>{
 const {submit,state}=await fixture(t);
 for(const fields of [{token:code},{code},{action:'join'},{action:'accept'},{action:'create_account_extra'}]){
  const response=await submit(fields,{Cookie:cookies({form:csrf,'creator-name':slug})});
  assert.notEqual(response.status,200);assert.notEqual(response.headers.get('location'),'/?creator=accepted');
  assertNoPrivateOutput(response,await response.text());
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('direct signup respects both signup and invitation rate limits before joining',async t=>{
 for(const denied of ['signup','token']){
  const {submit,state}=await fixture(t,{members:{allow:async scope=>{state.allowed.push(scope);return scope!==denied;}}});
  const response=await submit();assert.equal(response.status,429);
  assertNoPrivateOutput(response,await response.text());assert.equal(state.joins.length,0);assert.equal(state.mail,0);assert.equal(state.consumed,false);
 }
});

test('an existing-account conflict offers sign-in and personal help without replacing that account or sending mail',async t=>{
 let attempts=0;
 const {submit,state}=await fixture(t,{store:{join:async()=>{attempts++;throw new CreatorInvitationError('account_exists','An account already exists. Sign in or reset your password.',409);}}});
 const response=await submit();assert.equal(response.status,409);const html=await response.text();
 assert.match(html,/href="\/login\//);assert.match(html,/href="\/creator-invitation\//);
 assert.match(html,/reply to Paul(?:'|&#39;|’|&#x27;)s invitation/i);assertNoPrivateOutput(response,html);
 assert.equal(attempts,1);assert.equal(state.mail,0);assert.equal(state.ordinarySignups,0);assert.equal(state.consumed,false);
});

test('join failures never expose the code, submitted password or backend details and cannot report success',async t=>{
 const {submit,state}=await fixture(t,{store:{join:async()=>{throw Error('PRIVATE_DATABASE '+code+' '+password);}}});
 const response=await submit();assert.equal(response.status,503);const html=await response.text();
 assertNoPrivateOutput(response,html);assert.doesNotMatch(html,/PRIVATE_DATABASE|creator-membership-ready/);
 assert.ok(state.logs.every(value=>!value.includes(code)&&!value.includes(password)&&!value.includes('PRIVATE_DATABASE')));
 assert.ok(!response.headers.getSetCookie().some(value=>value.startsWith('__Host-gold-member='+freshSession)));
 assert.equal(state.mail,0);assert.equal(state.consumed,false);
});
