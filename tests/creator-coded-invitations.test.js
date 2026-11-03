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
 const state={joins:[],accepts:0,mail:0,ordinarySignups:0,allowed:[],logs:[],consumed:false,revoked:false,expired:false,recipient:'new',recipientReads:0,acceptedReads:0,...options.state};
 const profile={slug,display_name:'River Teacher <script>unsafe()</script>'};
 const invitation={id:'11111111-1111-4111-8111-111111111111',person_id:'22222222-2222-4222-8222-222222222222',target_email:invitedEmail,
  ...profile,expires_at:new Date(Date.now()+14*86400000).toISOString(),status:'pending'};
 let joined=null;
 const store={
  ready:async()=>true,
  read:async value=>value===code&&!state.consumed&&!state.revoked&&!state.expired?{...invitation}:null,
  recipientState:async value=>{assert.equal(value,code);state.recipientReads++;return state.recipient;},
  accepted:async()=>{state.acceptedReads++;return null;},
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
 return {request,submit,state,store};
}

function assertNoPrivateOutput(response,html){
 assert.ok(!html.includes(code),'Invitation code stays out of HTML');
 assert.ok(!html.includes(password),'Passwords stay out of HTML');
 assert.ok(!(response.headers.get('location')||'').includes(code),'Invitation code stays out of redirect URLs');
 assert.ok(!(response.headers.get('location')||'').includes(password),'Passwords stay out of redirect URLs');
}

function assertOnlySignIn(html,next){
 assert.match(html,/data-creator-access-flow/);assert.match(html,/Welcome back/i);
 assert.doesNotMatch(html,/<nav\b|<aside\b|<form\b|name="username"|create_account|href="\/prospectors\//);
 const links=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].filter(([,href])=>!href.startsWith('#'));
 assert.equal(links.length,1,'Returning creators have one sign-in choice');
 assert.equal(links[0][1],'/login/?next='+encodeURIComponent(next));assert.match(links[0][2],/Sign in/i);
}

async function acceptedPage(request,entry,{method='GET',headers={}}={}){
 if(!entry.includes('?'))return request(entry,{method,headers});
 const exchange=await request(entry,{method,headers});assert.equal(exchange.status,303);
 assert.equal(exchange.headers.get('location'),path,'Accepted private URLs are cleaned before the Welcome back screen');
 assert.equal(exchange.headers.get('referrer-policy'),'no-referrer');assertNoPrivateOutput(exchange,await exchange.text());
 const proof=exchange.headers.getSetCookie().find(value=>value.startsWith('__Host-gold-creator-invite='+code+';'));
 assert.ok(proof);assert.match(proof,/Secure; HttpOnly; SameSite=Lax/);
 const age=Number(proof.match(/Max-Age=(\d+)/)?.[1]);assert.ok(age>0&&age<=300,'Accepted-code context is short-lived');
 const jar=new Map((headers.Cookie||'').split(/;\s*/).filter(Boolean).map(pair=>{const i=pair.indexOf('=');return [pair.slice(0,i),pair.slice(i+1)];}));
 for(const value of exchange.headers.getSetCookie()){
  const pair=value.split(';')[0],i=pair.indexOf('=');
  if(/Max-Age=0(?:;|$)/.test(value))jar.delete(pair.slice(0,i));else jar.set(pair.slice(0,i),pair.slice(i+1));
 }
 return request(path,{method,headers:{...headers,Cookie:[...jar].map(([key,value])=>key+'='+value).join('; ')}});
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

test('an existing-account conflict becomes Welcome back with one sign-in choice without replacing that account or sending mail',async t=>{
 let attempts=0;
 const {submit,state}=await fixture(t,{store:{join:async()=>{attempts++;throw new CreatorInvitationError('account_exists','An account already exists. Sign in or reset your password.',409);}}});
 const response=await submit();assert.equal(response.status,409);const html=await response.text();
 assertOnlySignIn(html,path);assertNoPrivateOutput(response,html);
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

test('an active invited recipient sees only Welcome back and Sign in on clean GET and HEAD',async t=>{
 const {request,state}=await fixture(t,{state:{recipient:'active'}});
 for(const method of ['GET','HEAD','GET']){
  const response=await request(path,{method,headers:{Cookie:privateCookies()}});assert.equal(response.status,200);
  const html=await response.text();assertNoPrivateOutput(response,html);
  if(method==='HEAD'){assert.equal(html,'');continue;}
  assertOnlySignIn(html,path);
  assert.doesNotMatch(html,/<script>unsafe|choose another username|reset your password/i);
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
 assert.equal(state.consumed,false);
});

test('new and unfinished invited recipients keep the direct setup form',async t=>{
 for(const recipient of ['new','pending']){
  const {request,state}=await fixture(t,{state:{recipient}});
  const response=await request(path,{headers:{Cookie:privateCookies()}});assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/name="action" value="create_account"/);assert.match(html,/name="username"/);
  assert.match(html,/name="password"/);assertNoPrivateOutput(response,html);
  assert.equal(state.joins.length,0);assert.equal(state.mail,0);
 }
});

test('a blocked invited recipient receives personal help without signup or sign-in choices',async t=>{
 const {request,state}=await fixture(t,{state:{recipient:'blocked'}});
 const response=await request(path,{headers:{Cookie:privateCookies()}});assert.ok([200,409].includes(response.status));const html=await response.text();
 assert.match(html,/data-creator-access-flow/);assert.match(html,/Paul|reply|contact/i);
 assert.doesNotMatch(html,/create_account|name="username"|name="password"|href="\/(?:login|signup|forgot-password|creator-invitation|prospectors)\//);
 assertNoPrivateOutput(response,html);assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('a username collision keeps the same setup form with escaped input and an inline retry',async t=>{
 const {submit,state,store}=await fixture(t);let attempts=0;
 const join=store.join;
 store.join=async(raw,data)=>{
  if(++attempts===1)throw new CreatorInvitationError('username_unavailable','That username is already used. Choose another username.',400);
  return join(raw,data);
 };
 const response=await submit({username:'TakenCreator',displayName:'River <script>unsafe()</script>'});assert.equal(response.status,400);
 const html=await response.text();assert.match(html,/role="alert"/);assert.match(html,/username[^<]*(?:available|taken|used|choose|another)/i);
 assert.match(html,/name="action" value="create_account"/);
 const username=html.match(/<input\b[^>]*name="username"[^>]*>/)?.[0]||'';
 const displayName=html.match(/<input\b[^>]*name="displayName"[^>]*>/)?.[0]||'';
 assert.match(username,/value="TakenCreator"/);assert.match(displayName,/value="River &lt;script&gt;unsafe\(\)&lt;\/script&gt;"/);
 assert.doesNotMatch(html,/<script>unsafe|href="\/(?:login|forgot-password|signup)\//);
 assertNoPrivateOutput(response,html);assert.equal(state.consumed,false);assert.equal(state.mail,0);
 const retry=await submit();assert.equal(retry.status,303);assert.equal(retry.headers.get('location'),'/?creator=accepted');
 assert.equal(attempts,2);assert.equal(state.joins.length,1);assert.equal(state.mail,0);
});

test('a protected-account join conflict offers personal help without account-changing choices',async t=>{
 const {submit,state}=await fixture(t,{store:{join:async()=>{throw new CreatorInvitationError('account_unavailable','Reply to Paul for help finishing this account.',409);}}});
 const response=await submit();assert.equal(response.status,409);const html=await response.text();
 assert.match(html,/Paul|reply|contact/i);assert.doesNotMatch(html,/create_account|href="\/(?:login|signup|forgot-password|creator-invitation)\//);
 assertNoPrivateOutput(response,html);assert.equal(state.consumed,false);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('private invitation sign-in prefills its invited email read-only without offering new account or administration paths',async t=>{
 for(const recipient of ['new','pending','active']){
  const {request,state}=await fixture(t,{state:{recipient}});
  const response=await request('/login/?next=%2Fcreator-invitation%2F',{headers:{Cookie:privateCookies()}});assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/data-creator-access-flow/);
  const email=html.match(/<input\b[^>]*name="email"[^>]*>/)?.[0]||'';
  assert.match(email,/\breadonly\b/);assert.ok(email.includes('value="'+invitedEmail+'"'));
  assert.match(html,/name="next" value="\/creator-invitation\/"/);assert.match(html,/autocomplete="current-password"/);
  assert.match(html,/href="\/forgot-password\//);assert.doesNotMatch(html,/href="\/(?:signup|admin)\/|<nav\b|<aside\b/);
  assertNoPrivateOutput(response,html);assert.equal(state.mail,0);assert.equal(state.joins.length,0);
 }
});

test('reopening a recognized accepted code returns the matching session to the active homepage without granting again',async t=>{
 const {request,state}=await fixture(t,{state:{consumed:true},store:{accepted:async raw=>{assert.equal(raw,code);state.acceptedReads++;return {accountId,slug};}},members:{
  session:async raw=>raw===freshSession?{id:accountId,email:invitedEmail,effective_level:'subscriber',grant_source:'complimentary',csrf_token_hash:digest(csrf)}:null
 }});
 for(const entry of ['/invite/'+slug+'/?code='+code,path+'?token='+code,path])for(const method of ['GET','HEAD']){
  const response=await acceptedPage(request,entry,{method,headers:{Cookie:cookies({member:freshSession,form:csrf,'creator-invite':code})}});
  assert.equal(response.status,303,entry);assert.equal(response.headers.get('location'),'/?creator=accepted');
  for(const name of ['creator-invite','creator-name'])assert.ok(response.headers.getSetCookie().some(value=>value.startsWith('__Host-gold-'+name+'=;')&&/Max-Age=0/.test(value)));
  assert.ok(['strict-origin','no-referrer'].includes(response.headers.get('referrer-policy')));assertNoPrivateOutput(response,await response.text());
 }
 assert.ok(state.acceptedReads>0);assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('reopening a recognized accepted invitation anonymously gives one homepage sign-in choice',async t=>{
 const {request,state}=await fixture(t,{state:{consumed:true},store:{accepted:async raw=>raw===code?{accountId,slug}:null}});
 for(const entry of ['/invite/'+slug+'/?code='+code,path+'?token='+code,path])for(const method of ['GET','HEAD']){
  const response=await acceptedPage(request,entry,{method,headers:{Cookie:privateCookies()}});assert.equal(response.status,200,entry);
  const html=await response.text();assertNoPrivateOutput(response,html);
  if(method==='HEAD'){assert.equal(html,'');continue;}
  assertOnlySignIn(html,'/');assert.ok(!html.includes(invitedEmail));
  assert.ok(response.headers.getSetCookie().some(value=>value.startsWith('__Host-gold-creator-invite=;')&&/Max-Age=0/.test(value)));
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('an accepted code in another account offers only protected sign-out and cannot reconnect either account',async t=>{
 let signouts=0;const otherAccount='44444444-4444-4444-8444-444444444444';
 const {request,state}=await fixture(t,{state:{consumed:true},store:{accepted:async raw=>raw===code?{accountId,slug}:null},members:{
  session:async raw=>raw===freshSession?{id:otherAccount,email:'other@example.invalid',effective_level:'subscriber',csrf_token_hash:digest(csrf)}:null,
  logout:async raw=>{assert.equal(raw,freshSession);signouts++;}
 }});
 const headers={Cookie:cookies({member:freshSession,form:csrf,'creator-invite':code})};
 for(const method of ['GET','HEAD']){
  const response=await acceptedPage(request,'/invite/'+slug+'/?code='+code,{method,headers});assert.equal(response.status,200);
  const html=await response.text();assertNoPrivateOutput(response,html);if(method==='HEAD'){assert.equal(html,'');continue;}
  assert.match(html,/data-creator-access-flow/);assert.doesNotMatch(html,/href="\/(?:login|signup|forgot-password|creator-invitation|prospectors)\//);
  const forms=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)];assert.equal(forms.length,1);
  assert.match(forms[0][0],/method="post"/);assert.match(forms[0][0],/action="\/logout\/"/);
  assert.match(forms[0][0],new RegExp('name="csrf" value="'+csrf+'"'));
  assert.match(forms[0][0],/name="next" value="\/"/);
 }
 assert.equal(signouts,0);
 const logout=(Origin,nonce=csrf)=>request('/logout/',{method:'POST',headers:{...headers,Origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:nonce,next:'/'})});
 assert.equal((await logout('https://other.example')).status,403);assert.equal((await logout(origin,'f'.repeat(64))).status,403);assert.equal(signouts,0);
 const signedOut=await logout(origin);assert.equal(signedOut.status,303);assert.equal(signedOut.headers.get('location'),'/login/?next=%2F');assert.equal(signouts,1);
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});

test('public creator names cannot inspect accepted invitations and accepted codes remain bound to their creator slug',async t=>{
 let acceptedReads=0;
 const {request,state}=await fixture(t,{state:{consumed:true},store:{accepted:async raw=>{acceptedReads++;return raw===code?{accountId,slug}:null;}}});
 for(const entry of ['/invite/'+slug+'/',path]){
  const response=await request(entry,{headers:{Cookie:cookies({'creator-name':slug})}});assert.equal(response.status,410);
 }
 assert.equal(acceptedReads,0);
 for(const entry of ['/invite/another-creator/?code='+code,'/invite/'+slug+'/?code='+'f'.repeat(64)]){
  const response=await request(entry);assert.equal(response.status,410);assertNoPrivateOutput(response,await response.text());
 }
 assert.equal(state.joins.length,0);assert.equal(state.accepts,0);assert.equal(state.mail,0);
});
