import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createCreatorInvitationHandler} from '../app/creator-invitations/handler.js';
import {CreatorInvitationError} from '../app/creator-invitations/model.js';
import {createMemberHandler} from '../app/members.js';
import {digest,hashPassword} from '../app/admin-auth.js';
import {publicPath} from '../app/analytics/model.js';
import {analyticsMarkup} from '../app/analytics/handler.js';
import {createHomepageHandler} from '../app/homepage/handler.js';

const origin='https://gold.example';
const path='/creator-invitation/';
const csrf='a'.repeat(64),session='b'.repeat(64),raw='c'.repeat(64),verification='d'.repeat(64);
const targetEmail='creator@example.invalid';
const invitationId='11111111-1111-4111-8111-111111111111';
const creatorId='22222222-2222-4222-8222-222222222222';
const accountId='33333333-3333-4333-8333-333333333333';
const cookie=(values={})=>Object.entries(values).map(([key,value])=>`__Host-gold-${key}=${value}`).join('; ');
const memberCookies=(extra={})=>cookie({form:csrf,member:session,'creator-invite':raw,...extra});
const pendingInvitation=()=>({
 id:invitationId,person_id:creatorId,target_email:targetEmail,
 display_name:'River Teacher <script>unsafe()</script>',slug:'river-teacher',
 expires_at:new Date(Date.now()+14*86400000).toISOString(),status:'pending'
});

async function fixture(t,options={}){
 const state={reads:0,acceptAttempts:0,accepts:0,consumed:false,revoked:false,expired:false,logs:[],...options.state};
 const account={id:accountId,username:'RiverTeacher',display_name:'River Teacher',email:targetEmail,
  account_number:42,effective_level:'free',csrf_token_hash:digest(csrf),...options.account};
 const invitation=pendingInvitation();
 const invitations={
  ready:async()=>true,
  read:async value=>{state.reads++;return value===raw&&!state.consumed&&!state.revoked&&!state.expired?{...invitation}:null;},
  readNamed:async(slug,id=null)=>{
   if(slug!==invitation.slug||state.consumed||state.revoked||state.expired)return null;
   const matched=id===accountId&&account.email===targetEmail;
   return {...invitation,named:true,matched,id:matched?invitationId:null,target_email:matched?targetEmail:null};
  },
  accept:async(value,id)=>{
   state.acceptAttempts++;
   assert.equal(value,raw);assert.equal(id,accountId);
   assert.equal(state.consumed||state.revoked||state.expired,false);
   if(account.email!==targetEmail)throw new CreatorInvitationError('wrong_account','Sign in with the invited email.',403);
   state.accepts++;
   state.consumed=true;account.effective_level='subscriber';account.grant_source='complimentary';account.ends_at=null;
   return {person_id:creatorId,display_name:invitation.display_name,slug:invitation.slug};
  },
  acceptNamed:async(slug,id)=>{assert.equal(slug,invitation.slug);state.namedAccepts=(state.namedAccepts||0)+1;return invitations.accept(raw,id);},
  ...options.invitations
 };
 const members={ready:async()=>true,allow:async()=>true,session:async value=>value===session?{...account}:null,...options.members};
 const config={origin,open:true};
 const log=value=>state.logs.push(String(value));
 const handler=createCreatorInvitationHandler({store:invitations,members,config,log});
 const server=createServer({creatorInvitations:handler,memberSessions:members,homepage:createHomepageHandler({members,config,guests:null}),analytics:options.analytics,
  members:createMemberHandler({store:members,invitations,config,mail:options.mail||(async()=>{}),log}),
  goldPrice:async()=>({}),log});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(url,init={})=>fetch(`http://127.0.0.1:${server.address().port}${url}`,{redirect:'manual',...init});
 const post=(fields={},headers={})=>request(path,{method:'POST',headers:{
  Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:memberCookies(),...headers
 },body:new URLSearchParams({csrf,...fields})});
 return {request,post,state,account,invitations,members};
}

test('invitation GET exchanges a bearer for a secure cookie and removes it from the URL',async t=>{
 const {request,state}=await fixture(t);
 const response=await request(path+'?token='+raw);
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),'/');
 const setCookie=response.headers.getSetCookie().find(value=>value.startsWith('__Host-gold-creator-invite='));
 assert.ok(setCookie);
 assert.match(setCookie,new RegExp('^__Host-gold-creator-invite='+raw+';'));
 assert.match(setCookie,/Path=\//);assert.match(setCookie,/Secure/);assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);
 const maxAge=Number(setCookie.match(/Max-Age=(\d+)/)?.[1]);
 assert.ok(maxAge>0&&maxAge<=14*86400);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.match(response.headers.get('referrer-policy'),/^(no-referrer|strict-origin)$/);
 assert.match(response.headers.get('x-robots-tag'),/noindex/);
 assert.doesNotMatch(await response.text(),new RegExp(raw));
 assert.equal(state.accepts,0);assert.equal(state.consumed,false);
});

test('a valid invitation opens the homepage first without revealing or consuming its capability',async t=>{
 let analyticsRequests=0;
 const analytics=Object.assign(async()=>{analyticsRequests++;return false;},{enabled:async()=>true});
 const {request,state,account}=await fixture(t,{analytics});
 const exchange=await request(path+'?token='+raw);
 assert.equal(exchange.status,303);assert.equal(exchange.headers.get('location'),'/');
 assert.equal(exchange.headers.get('referrer-policy'),'no-referrer');
 const browserCookies=exchange.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 for(const method of ['GET','HEAD','GET']){
  const response=await request('/',{method,headers:{Cookie:browserCookies}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('vary'),'Cookie');
  assert.equal(response.headers.get('referrer-policy'),'strict-origin');
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  const html=await response.text();
  if(method==='HEAD'){assert.equal(html,'');continue;}
  assert.equal((html.match(/class="home-invitation-welcome"/g)||[]).length,1,'One welcome is shared by illustrated and text layouts');
  assert.match(html,/Your complimentary creator invitation is waiting/);
  assert.match(html,/href="\/creator-invitation\/">Continue to your free creator account<\/a>/);
  assert.match(html,/home-graphical/);assert.match(html,/class="hero"/,'The normal homepage remains available to explore');
  assert.match(html,/data-home-id="nav-almanac"[^>]*href="\/creator-invitation\/"/);
  assert.match(html,/data-home-id="nav-connections"[^>]*href="\/creator-invitation\/"/);
  assert.match(html,/<strong>Free<\/strong><span>for creators<\/span>/);
  assert.doesNotMatch(html,/site-analytics\.(?:js|css)|data-plus-support|\$5|\/ month|href="\/plus\/"/);
  for(const privateValue of [raw,targetEmail,invitationId,creatorId,accountId,'River Teacher'])assert.ok(!html.includes(privateValue));
 }
 assert.equal(analyticsRequests,0);
 assert.equal(state.acceptAttempts,0);assert.equal(state.accepts,0);assert.equal(state.consumed,false);
 assert.equal(account.effective_level,'free');
 const continueInvitation=await request(path,{headers:{Cookie:browserCookies}});
 assert.equal(continueInvitation.status,200);assert.match(await continueInvitation.text(),/Create your free account/);
 assert.equal(state.accepts,0);
});

test('ordinary, malformed and no-longer-pending invitation cookies keep the public homepage ordinary',async t=>{
 let analyticsRequests=0;
 const analytics=Object.assign(async()=>{analyticsRequests++;return false;},{enabled:async()=>true});
 const {request,state}=await fixture(t,{analytics});
 const ordinary=async value=>{
  const response=await request('/',{headers:value?{Cookie:cookie({'creator-invite':value})}:{}});
  assert.equal(response.status,200);const html=await response.text();
  assert.doesNotMatch(html,/home-invitation-welcome|data-complimentary-invitation/);
  assert.match(html,/<strong>\$5<\/strong><span>\/ month<\/span>/);
  assert.match(html,/site-analytics\.js/);
  assert.notEqual(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.ok(!html.includes(raw));
 };
 await ordinary();await ordinary('short');assert.equal(state.reads,0);
 await ordinary('f'.repeat(64));
 for(const field of ['expired','revoked','consumed']){state[field]=true;await ordinary(raw);state[field]=false;}
 assert.equal(analyticsRequests,6);assert.equal(state.acceptAttempts,0);assert.equal(state.accepts,0);
});

test('optional invitation checks fail gracefully on the homepage without logging private data',async t=>{
 for(const failingMethod of ['ready','read']){
  const {request,state}=await fixture(t,{invitations:{[failingMethod]:async()=>{throw Error('private failure '+raw+' '+targetEmail);}}});
  const response=await request('/',{headers:{Cookie:cookie({'creator-invite':raw})}});
  assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/class="hero"/);assert.match(html,/<strong>\$5<\/strong>/);
  assert.doesNotMatch(html,/home-invitation-welcome|private failure/);
  assert.equal(state.acceptAttempts,0);assert.equal(state.accepts,0);
  assert.deepEqual(state.logs,['Gold Trails homepage invitation check unavailable']);
 }
 const {request,state}=await fixture(t,{invitations:{ready:async()=>false}});
 const response=await request('/',{headers:{Cookie:cookie({'creator-invite':raw})}});
 assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/home-invitation-welcome/);
 assert.equal(state.reads,0);assert.equal(state.accepts,0);
});

test('a clean anonymous invitation page escapes the creator and masks recipient details',async t=>{
 const {request,state}=await fixture(t);
 const response=await request(path,{headers:{Cookie:cookie({'creator-invite':raw})}});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/River Teacher &lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>unsafe/);
 assert.doesNotMatch(html,new RegExp(targetEmail.replace('.','\\.')));
 assert.doesNotMatch(html,new RegExp(raw));
 assert.match(html,/href="\/login\/(?:\?[^\"]*)?"/);
 assert.match(html,/href="\/signup\/(?:\?[^\"]*)?"/);
 assert.match(html,/complimentary|free/i);
 assert.match(response.headers.get('cache-control'),/private.*no-store|no-store.*private/);
 assert.equal(response.headers.get('referrer-policy'),'strict-origin');
 assert.match(response.headers.get('x-robots-tag'),/noindex/);
 assert.equal(state.accepts,0);assert.equal(state.consumed,false);
});

test('email scanners and repeated GET or HEAD requests cannot accept an invitation',async t=>{
 const {request,state}=await fixture(t);
 for(const method of ['GET','HEAD','GET','HEAD']){
  const response=await request(path+'?token='+raw,{method});
  assert.equal(response.status,303);
  if(method==='HEAD')assert.equal(await response.text(),'');
 }
 const signedIn=await request(path,{headers:{Cookie:memberCookies()}});
 assert.equal(signedIn.status,200);
 const html=await signedIn.text();
 assert.match(html,/<form[^>]*method="post"/);
 assert.match(html,new RegExp('name="csrf" value="'+csrf+'"'));
 assert.equal(state.accepts,0);assert.equal(state.consumed,false);
});

test('malformed, unknown, expired, revoked and ambiguous invitation URLs cannot create access',async t=>{
 const {request,state}=await fixture(t);
 for(const query of ['?token=short','?token='+raw+'&token='+raw,'?token='+raw+'&next=https://evil.example/','?token='+'f'.repeat(64)]){
  const response=await request(path+query);
  assert.ok([400,410].includes(response.status),`${query}: ${response.status}`);
  assert.doesNotMatch(response.headers.get('set-cookie')||'',new RegExp('__Host-gold-creator-invite='+raw));
 }
 for(const field of ['expired','revoked']){
  state[field]=true;
  const response=await request(path+'?token='+raw);
  assert.equal(response.status,410);
  state[field]=false;
 }
 assert.equal(state.accepts,0);assert.equal(state.consumed,false);
});

test('acceptance rejects forged origins, form CSRF and another session CSRF',async t=>{
 const {post,state,account}=await fixture(t);
 for(const Origin of ['https://evil.example','null',''])assert.equal((await post({}, {Origin})).status,403);
 for(const bad of ['','short','e'.repeat(64)])assert.equal((await post({csrf:bad})).status,403);
 assert.equal((await post({}, {Cookie:cookie({member:session,'creator-invite':raw})})).status,403);
 account.csrf_token_hash=digest('f'.repeat(64));
 assert.equal((await post()).status,403);
 assert.equal(state.accepts,0);assert.equal(state.consumed,false);
});

test('an invitation grants no access without a signed-in account or to the wrong account',async t=>{
 const {post,state,account}=await fixture(t);
 const anonymous=await post({}, {Cookie:cookie({form:csrf,'creator-invite':raw})});
 assert.ok([303,401].includes(anonymous.status));
 if(anonymous.status===303)assert.match(anonymous.headers.get('location'),/^\/login\//);
 assert.equal(state.accepts,0);
 account.email='someone-else@example.invalid';
 const wrong=await post();assert.equal(wrong.status,403);
 assert.match(await wrong.text(),/email|account/i);
 assert.equal(state.accepts,0);assert.equal(state.consumed,false);
});

test('billing, suspended membership and blocked affiliation conflicts preserve the pending invitation',async t=>{
 for(const code of ['billing_resolution_required','membership_suspended','affiliation_blocked']){
  const {post,state}=await fixture(t,{invitations:{accept:async()=>{throw new CreatorInvitationError(code,'Contact Paul to resolve this account before accepting.',409);}}});
  const response=await post();assert.equal(response.status,409);
  assert.equal(state.accepts,0);assert.equal(state.consumed,false);
  assert.doesNotMatch(await response.text(),new RegExp(raw));
 }
});

test('explicit acceptance gives complimentary account access once and works after opening on another device',async t=>{
 const {request,post,state}=await fixture(t);
 // The first device merely previews; the original link still works on a second device.
 assert.equal((await request(path+'?token='+raw)).status,303);
 const second=await request(path+'?token='+raw);
 assert.equal(second.status,303);assert.equal(state.consumed,false);
 const accepted=await post();
 assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'/account/?creator=accepted');
 assert.ok(accepted.headers.getSetCookie().some(value=>/^__Host-gold-creator-invite=;/.test(value)&&/Max-Age=0/.test(value)));
 assert.equal(state.accepts,1);assert.equal(state.consumed,true);
 const account=await request('/account/?creator=accepted',{headers:{Cookie:cookie({form:csrf,member:session})}});
 assert.equal(account.status,200);const html=await account.text();
 assert.match(html,/complimentary/i);assert.match(html,/no (?:subscription )?(?:fee|payment)|free/i);
 assert.match(html,/href="\/gold-almanac\/"/);
 const replay=await post();assert.equal(replay.status,410);assert.equal(state.accepts,1);
});

test('a link that expires or is revoked after preview still cannot be accepted',async t=>{
 for(const field of ['expired','revoked']){
  const {request,post,state}=await fixture(t);
  assert.equal((await request(path+'?token='+raw)).status,303);
  state[field]=true;
  const response=await post();assert.equal(response.status,410);
  assert.equal(state.accepts,0);assert.equal(state.consumed,false);
 }
});

test('acceptance throttling and outages do not leak token, email or private database failures',async t=>{
 const limited=await fixture(t,{members:{allow:async()=>false}});
 assert.equal((await limited.post()).status,429);assert.equal(limited.state.accepts,0);
 const privateMessage=`Database failure target=${targetEmail} token=${raw}`;
 const unavailable=await fixture(t,{invitations:{accept:async()=>{throw Error(privateMessage);}}});
 const response=await unavailable.post();assert.equal(response.status,503);
 const html=await response.text();assert.doesNotMatch(html,new RegExp(raw));assert.ok(!html.includes(targetEmail));assert.ok(!html.includes(privateMessage));
 assert.ok(unavailable.state.logs.every(value=>!value.includes(raw)&&!value.includes(targetEmail)&&!value.includes('Database failure')));
});

test('creator invitations are excluded from optional usage statistics',()=>{
 assert.equal(publicPath(path),null);
 assert.equal(publicPath('/invite/river-teacher/'),null);
 const html='<!doctype html><html><head></head><body>Private invitation</body></html>';
 assert.equal(analyticsMarkup(html,path),html);
});

test('invited signup and verification retain the invitation without displaying a paid signup offer',async t=>{
 let signups=0,verificationSends=0,verifications=0;
 const {request}=await fixture(t,{mail:async message=>{assert.equal(message.purpose,'verify_email');verificationSends++;},members:{
  signup:async data=>{assert.equal(data.email,targetEmail);signups++;return{id:accountId,email:data.email};},
  issue:async()=>verification,
  consume:async(value,purpose)=>{assert.equal(value,verification);assert.equal(purpose,'verify_email');verifications++;return true;}
 }});
 const headers={Cookie:cookie({form:csrf,'creator-invite':raw})};
 const signup=await request('/signup/',{headers});assert.equal(signup.status,200);
 const signupHtml=await signup.text();assert.doesNotMatch(signupHtml,/data-signup-plus-offer|data-signup-plus-autoopen/);assert.match(signupHtml,/invitation|creator/i);
 const created=await request('/signup/',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({csrf,username:'RiverTeacher',email:targetEmail,password:'new creator test password'})});
 assert.equal(created.status,200);assert.doesNotMatch(await created.text(),/data-signup-plus-offer|data-signup-plus-autoopen/);
 assert.equal(signups,1);assert.equal(verificationSends,1);
 assert.equal((await request('/verify-email/?token='+verification,{headers})).status,200);assert.equal(verifications,0);
 const verified=await request('/verify-email/',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,token:verification})});
 assert.equal(verified.status,200);assert.equal(verifications,1);
 const verifiedHtml=await verified.text();assert.match(verifiedHtml,/creator-invitation/);assert.doesNotMatch(verifiedHtml,/data-signup-plus-offer/);
});

test('creator sign-in rotates the session and returns to the clean invitation path',async t=>{
 const password='creator test sign in password',passwordHash=await hashPassword(password);
 let rotations=0;
 const {request}=await fixture(t,{members:{
  find:async email=>email===targetEmail?{id:accountId,email:targetEmail,password_hash:passwordHash,status:'active',email_verified_at:new Date(),auth_version:0}:null,
  logout:async()=>{},login:async(id,version,nonce)=>{assert.equal(id,accountId);assert.notEqual(nonce,csrf);rotations++;return session;}
 }});
 const response=await request('/login/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie({form:csrf,'creator-invite':raw})},body:new URLSearchParams({csrf,email:targetEmail,password})});
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),path);assert.equal(rotations,1);
 assert.ok(response.headers.getSetCookie().some(value=>value.startsWith('__Host-gold-member=')));
 assert.doesNotMatch(response.headers.get('location'),new RegExp(raw));
});

test('a forged or expired invitation cookie never promises complimentary signup access',async t=>{
 for(const value of ['f'.repeat(64),'short']){
  const {request}=await fixture(t);
  const response=await request('/signup/',{headers:{Cookie:cookie({'creator-invite':value})}});
  assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/data-signup-plus-offer/);
  assert.doesNotMatch(html,/complimentary (?:creator )?access|creator invitation is waiting/i);
 }
});

test('optional invitation storage failures leave ordinary member account flows available',async t=>{
 const password='healthy account fixture password',passwordHash=await hashPassword(password);
 for(const failingMethod of ['ready','read']){
  let signups=0,logins=0,signouts=0;
  const purposes=[];
  const {request,state}=await fixture(t,{
   invitations:{[failingMethod]:async()=>{throw Error('private invitation database failure '+raw);}},
   mail:async message=>purposes.push(message.purpose),
   members:{
    find:async email=>({id:accountId,email,password_hash:passwordHash,status:'active',email_verified_at:new Date(),auth_version:0}),
    signup:async data=>{signups++;return{id:accountId,email:data.email};},
    issue:async()=>verification,
    logout:async()=>signouts++,
    login:async()=>{logins++;return session;}
   }
  });
  const headers={Cookie:cookie({form:csrf,'creator-invite':raw})};
  const submit=(url,fields,withSession=false)=>request(url,{method:'POST',headers:{
   Origin:origin,'Content-Type':'application/x-www-form-urlencoded',
   Cookie:withSession?memberCookies():headers.Cookie
  },body:new URLSearchParams({csrf,...fields})});
  for(const url of ['/login/','/signup/','/forgot-password/']){
   const page=await request(url,{headers});assert.equal(page.status,200,`${failingMethod}: ${url}`);
   assert.ok(!(await page.text()).includes('private invitation database failure'));
  }
  const account=await request('/account/',{headers:{Cookie:memberCookies()}});assert.equal(account.status,200);
  assert.equal((await submit('/logout/',{},true)).status,303);
  const recovery=await submit('/forgot-password/',{email:targetEmail});assert.equal(recovery.status,200);
  const signup=await submit('/signup/',{username:'FreshCreator',email:'fresh@example.invalid',password});assert.equal(signup.status,200);
  assert.match(await signup.text(),/Your signup request was received/);
  const login=await submit('/login/',{email:targetEmail,password});assert.equal(login.status,303);
  assert.equal(login.headers.get('location'),'/account/');
  assert.equal(signups,1);assert.equal(logins,1);assert.ok(signouts>=1);
  assert.deepEqual(purposes,['reset_password','verify_email']);
  assert.equal(state.accepts,0);
  assert.ok(state.logs.every(value=>!value.includes(raw)&&!value.includes('private invitation database failure')));
 }
});

test('creator-name links open the homepage first and preserve all acceptance state on GET and HEAD',async t=>{
 const {request,state}=await fixture(t);
 for(const method of ['GET','HEAD']){
  for(const suffix of ['','/']){
   const response=await request('/invite/river-teacher'+suffix,{method});
   assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/');
   const cookies=response.headers.getSetCookie();
   assert.ok(cookies.some(value=>/^__Host-gold-creator-name=river-teacher;/.test(value)&&/Secure; HttpOnly; SameSite=Lax/.test(value)));
   assert.ok(cookies.some(value=>/^__Host-gold-creator-invite=;/.test(value)&&/Max-Age=0/.test(value)));
   assert.equal(response.headers.get('referrer-policy'),'no-referrer');
   const text=await response.text();for(const secret of [raw,targetEmail,invitationId,accountId])assert.ok(!text.includes(secret));
   if(method==='HEAD')assert.equal(text,'');
  }
 }
 assert.equal(state.acceptAttempts,0);assert.equal(state.consumed,false);
});

test('name invitation context welcomes creators at home without revealing the recipient or changing membership',async t=>{
 let analyticsRequests=0;const analytics=Object.assign(async()=>{analyticsRequests++;return false;},{enabled:async()=>true});
 const {request,state}=await fixture(t,{analytics});
 const headers={Cookie:cookie({'creator-name':'river-teacher'})};
 const home=await request('/',{headers}),homeHtml=await home.text();
 assert.equal(home.status,200);assert.match(homeHtml,/Continue to your free creator account/);
 assert.doesNotMatch(homeHtml,/site-analytics|data-plus-support/);
 for(const privateValue of [targetEmail,raw,invitationId,creatorId,accountId])assert.ok(!homeHtml.includes(privateValue));
 assert.equal(analyticsRequests,0);
 const page=await request(path,{headers}),html=await page.text();assert.equal(page.status,200);
 assert.match(html,/normally \$5\/month/);assert.match(html,/email address that received your invitation/);
 assert.doesNotMatch(html,/c\*\*\*@example\.invalid/);assert.ok(!html.includes(targetEmail));assert.ok(!html.includes(raw));
 assert.equal(state.acceptAttempts,0);
});

test('a public creator name cannot open another member account or grant access to a different verified email',async t=>{
 const {request,state}=await fixture(t,{account:{email:'other@example.invalid'}});
 const headers={Cookie:cookie({form:csrf,member:session,'creator-name':'river-teacher'})};
 const page=await request(path,{headers}),html=await page.text();assert.equal(page.status,200);
 assert.match(html,/different email address/);assert.doesNotMatch(html,/Accept complimentary creator access/);
 assert.ok(!html.includes(targetEmail));
 const response=await request(path,{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf})});
 assert.equal(response.status,403);assert.equal(state.acceptAttempts,0);assert.equal(state.consumed,false);
});

test('name invitation acceptance requires the existing session, Origin and CSRF protections',async t=>{
 const {request,state}=await fixture(t);
 const context=() => cookie({form:csrf,member:session,'creator-name':'river-teacher'});
 const submit=(headers={},nonce=csrf)=>request(path,{method:'POST',headers:{Cookie:context(),Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({csrf:nonce})});
 assert.equal((await submit({Cookie:cookie({form:csrf,'creator-name':'river-teacher'})})).status,303);
 assert.equal((await submit({Origin:'https://other.example'})).status,403);
 assert.equal((await submit({},'f'.repeat(64))).status,403);
 assert.equal(state.accepts,0);
 const accepted=await submit();assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'/account/?creator=accepted');
 assert.equal(state.namedAccepts,1);assert.equal(state.accepts,1);
 assert.ok(accepted.headers.getSetCookie().some(value=>/^__Host-gold-creator-name=;/.test(value)&&/Max-Age=0/.test(value)));
 const account=await request('/account/',{headers:{Cookie:cookie({form:csrf,member:session})}});assert.equal(account.status,200);assert.match(await account.text(),/complimentary/i);
});

test('named signup, verification and sign-in retain the invitation without a subscription offer',async t=>{
 const password='named invitation password',passwordHash=await hashPassword(password);
 let verificationCalls=0;
 const {request,state}=await fixture(t,{members:{
  find:async()=>({id:accountId,email:targetEmail,password_hash:passwordHash,status:'active',email_verified_at:new Date(),auth_version:0}),
  logout:async()=>{},login:async()=>session,consume:async()=>{verificationCalls++;return true;}
 }});
 const headers={Cookie:cookie({form:csrf,'creator-name':'river-teacher'})};
 for(const route of ['/signup/','/login/']){
  const response=await request(route,{headers});assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/creator invitation is waiting/);assert.doesNotMatch(html,/data-signup-plus-offer/);
 }
 const verify=await request('/verify-email/',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,token:verification})});
 assert.equal(verify.status,200);assert.match(await verify.text(),/login\/\?next=%2Fcreator-invitation%2F/);assert.equal(verificationCalls,1);
 const login=await request('/login/',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,email:targetEmail,password})});
 assert.equal(login.status,303);assert.equal(login.headers.get('location'),path);assert.equal(state.accepts,0);
});

test('malformed, missing and ended creator-name invitations never enable an account',async t=>{
 const {request,state}=await fixture(t);
 for(const route of ['/invite/','/invite/UNKNOWN/','/invite/river-teacher/?next=https://other.example/','/invite/no-such-creator/'])assert.equal((await request(route)).status,410,route);
 const directPost=await request('/invite/river-teacher/',{method:'POST',body:new URLSearchParams({csrf})});assert.equal(directPost.status,405);
 for(const field of ['revoked','expired','consumed']){state[field]=true;assert.equal((await request('/invite/river-teacher/')).status,410);state[field]=false;}
 const forged=await request(path,{headers:{Cookie:cookie({'creator-name':'../private'})}});assert.equal(forged.status,410);
 assert.equal(state.accepts,0);
});

test('a valid legacy bearer link clears named context and remains usable',async t=>{
 const {request,state}=await fixture(t);
 const response=await request(path+'?token='+raw,{headers:{Cookie:cookie({'creator-name':'river-teacher'})}});
 assert.equal(response.status,303);
 assert.ok(response.headers.getSetCookie().some(value=>/^__Host-gold-creator-name=;/.test(value)&&/Max-Age=0/.test(value)));
 assert.ok(response.headers.getSetCookie().some(value=>value.startsWith('__Host-gold-creator-invite='+raw+';')));
 assert.equal(state.accepts,0);
});

test('a failed optional named invitation lookup leaves ordinary account sign-in available',async t=>{
 const {request,state}=await fixture(t,{invitations:{readNamed:async()=>{throw new Error('PRIVATE_EMAIL '+targetEmail);}}});
 for(const route of ['/','/login/','/signup/','/forgot-password/']){
  const response=await request(route,{headers:{Cookie:cookie({'creator-name':'river-teacher'})}});assert.equal(response.status,200);
  assert.doesNotMatch(await response.text(),/PRIVATE_EMAIL|creator invitation is waiting/);
 }
 assert.ok(state.logs.every(value=>!value.includes('PRIVATE_EMAIL')&&!value.includes(targetEmail)));
 assert.equal(state.accepts,0);
});
