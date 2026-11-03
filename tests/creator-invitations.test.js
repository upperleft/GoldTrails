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

function assertFocusedAccess(html,context='creator onboarding'){
 assert.match(html,/data-creator-access-flow/,context+' uses the invitation shell');
 assert.match(html,/creator-access\.css\?v=/,context+' includes invitation styling');
 assert.equal((html.match(/<h1\b/g)||[]).length,1,context+' has one page title');
 assert.doesNotMatch(html,/<nav\b|<aside\b/,context+' has no public navigation or sidebar');
 assert.doesNotMatch(html,/href="\/(?:prospectors|products|articles|gold-games|gold-almanac|connections|plus|account|admin)(?:\/|\?|")/,context+' keeps site destinations out of the unfinished flow');
 const allowed=new Set(['/creator-invitation/','/signup/','/login/','/forgot-password/','/resend-verification/','/verify-email/','/reset-password/']);
 for(const [,href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  if(href.startsWith('#'))continue;
  const destination=new URL(href,origin);
  assert.equal(destination.origin,origin,context+' has no external navigation');
  assert.ok(allowed.has(destination.pathname),context+' unexpected link: '+href);
 }
}

function assertPendingHomepage(html){
 assert.match(html,/data-complimentary-invitation/);
 assert.match(html,/data-creator-access-flow/);assert.match(html,/data-creator-access-home/);
 assert.match(html,/home-graphical/);assert.match(html,/class="hero"/,'The illustrated homepage remains visible');
 assert.match(html,/home-classic/);assert.match(html,/home-invitation-welcome/);
 assert.match(html,/aria-disabled="true"/,'Public navigation remains visible but inert');
 const destinations=[];
 for(const [,href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  if(href.startsWith('#'))continue;
  const destination=new URL(href,origin);destinations.push(destination);
  assert.equal(destination.origin,origin,'Pending homepage has no external navigation');
  assert.equal(destination.pathname,path,'Only Continue can leave the pending homepage');
 }
 assert.equal(destinations.length,1,'The pending homepage exposes a single real invitation link');
 assert.doesNotMatch(html,/href="\/prospectors\//);
}

async function fixture(t,options={}){
 const state={reads:0,acceptAttempts:0,accepts:0,consumed:false,revoked:false,expired:false,logs:[],...options.state};
 const account={id:accountId,username:'RiverTeacher',display_name:'River Teacher',email:targetEmail,
  account_number:42,effective_level:'free',csrf_token_hash:digest(csrf),...options.account};
 const invitation=pendingInvitation();
 const invitations={
  ready:async()=>true,
  read:async value=>{state.reads++;return value===raw&&!state.consumed&&!state.revoked&&!state.expired?{...invitation}:null;},
  recipientState:async value=>value===raw?'new':null,
  accepted:async()=>null,
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
  acceptedProfile:async id=>{assert.equal(id,accountId);state.profileReads=(state.profileReads||0)+1;return state.consumed?{slug:invitation.slug,display_name:invitation.display_name}:null;},
  ...options.invitations
 };
 const members={ready:async()=>true,allow:async()=>true,session:async value=>value===session?{...account}:null,...options.members};
 const config={origin,open:true};
 const log=value=>state.logs.push(String(value));
 const handler=createCreatorInvitationHandler({store:invitations,members,config,log});
 const server=createServer({creatorInvitations:handler,memberSessions:members,homepage:createHomepageHandler({members,invitations,config,guests:null}),analytics:options.analytics,suggestions:options.suggestions,directory:options.directory,
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

test('a valid invitation opens the illustrated homepage with only Continue active and cannot consume its capability',async t=>{
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
  assertPendingHomepage(html);
  assert.match(html,/complimentary.*invitation is waiting/);
  assert.match(html,/href="\/creator-invitation\/">Continue to your free creator account<\/a>/);
  assert.doesNotMatch(html,/site-analytics\.(?:js|css)|data-plus-support|\$5|\/ month|href="\/plus\/"/);
  for(const privateValue of [raw,targetEmail,invitationId,creatorId,accountId,'River Teacher'])assert.ok(!html.includes(privateValue));
 }
 assert.equal(analyticsRequests,0);
 assert.equal(state.acceptAttempts,0);assert.equal(state.accepts,0);assert.equal(state.consumed,false);
 assert.equal(account.effective_level,'free');
 const continueInvitation=await request(path,{headers:{Cookie:browserCookies}});
 assert.equal(continueInvitation.status,200);assert.match(await continueInvitation.text(),/name="action" value="create_account"/);
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

test('a clean private invitation page escapes the creator and binds its account form to the invited recipient',async t=>{
 const {request,state}=await fixture(t);
 const response=await request(path,{headers:{Cookie:cookie({'creator-invite':raw})}});
 assert.equal(response.status,200);
 const html=await response.text();
 assertFocusedAccess(html,'anonymous invitation');
 assert.match(html,/River Teacher &lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>unsafe/);
 const emailInput=html.match(/<input\b[^>]*name="email"[^>]*>/)?.[0]||'';
 assert.ok(emailInput.includes('value="'+targetEmail+'"'));assert.match(emailInput,/\breadonly\b/);
 assert.doesNotMatch(html,new RegExp(raw));
 assert.doesNotMatch(html,/href="\/login\//);
 assert.match(html,/<form\b[^>]*action="\/creator-invitation\/"/);
 assert.match(html,/name="action" value="create_account"/);
 assert.doesNotMatch(html,/href="\/(?:signup|verify-email|resend-verification)\/|verify your email|verification email is on its way/i);
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
 assertFocusedAccess(html,'signed-in pending invitation');
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
 const {request,post,state}=await fixture(t,{directory:{profile:async slug=>slug==='river-teacher'?{slug,display_name:'Public River Teacher'}:null}});
 // The first device merely previews; the original link still works on a second device.
 assert.equal((await request(path+'?token='+raw)).status,303);
 const second=await request(path+'?token='+raw);
 assert.equal(second.status,303);assert.equal(state.consumed,false);
 const accepted=await post();
 assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'/?creator=accepted');
 assert.ok(accepted.headers.getSetCookie().some(value=>/^__Host-gold-creator-invite=;/.test(value)&&/Max-Age=0/.test(value)));
 assert.equal(state.accepts,1);assert.equal(state.consumed,true);
 const headers={Cookie:cookie({form:csrf,member:session})};
 const home=await request(accepted.headers.get('location'),{headers});assert.equal(home.status,200);const homeHtml=await home.text();
 assert.match(homeHtml,/data-creator-membership-ready/);
 assert.match(homeHtml,/href="\/prospectors\/river-teacher\/"[^>]*>View your creator profile/);
 assert.match(homeHtml,/River Teacher &lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
 assert.doesNotMatch(homeHtml,/<script>unsafe|data-creator-access-flow|home-invitation-welcome/);
 assert.match(home.headers.get('cache-control'),/private.*no-store|no-store.*private/);
 const profile=await request('/prospectors/river-teacher/',{headers});assert.equal(profile.status,200);assert.match(await profile.text(),/Public River Teacher/);
 const account=await request('/account/?creator=accepted',{headers});
 assert.equal(account.status,200);const html=await account.text();
 assert.match(html,/complimentary/i);assert.match(html,/no (?:subscription )?(?:fee|payment)|free/i);
 assert.match(html,/href="\/gold-almanac\/"/);
 assert.match(html,/href="\/prospectors\/river-teacher\/">View your creator profile/);
 assert.match(html,/River Teacher &lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>unsafe/);
 assert.ok(state.profileReads>=1);
 const replay=await post();assert.equal(replay.status,410);assert.equal(state.accepts,1);
});

test('an accepted-home query alone cannot reveal a profile shortcut or claim complimentary creator access',async t=>{
 for(const account of [{effective_level:'free',grant_source:'complimentary'},{effective_level:'subscriber',grant_source:'stripe'}]){
  let profileReads=0;
  const {request,state}=await fixture(t,{account,invitations:{acceptedProfile:async()=>{profileReads++;return {slug:'river-teacher',display_name:'Private Creator'};}}});
  for(const headers of [{},{Cookie:cookie({form:csrf,member:session})}]){
   const response=await request('/?creator=accepted',{headers});assert.equal(response.status,200);
   const html=await response.text();assert.doesNotMatch(html,/data-creator-membership-ready|Your creator account is ready|Private Creator/);
  }
  assert.equal(profileReads,0);assert.equal(state.acceptAttempts,0);
 }
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

test('a private invitation redirects ordinary signup back to its own account form without requesting verification',async t=>{
 let signups=0,verificationSends=0,issued=0;
 const {request,state}=await fixture(t,{mail:async()=>verificationSends++,members:{
  signup:async()=>signups++,issue:async()=>{issued++;return verification;}
 }});
 const headers={Cookie:cookie({form:csrf,'creator-invite':raw})};
 for(const method of ['GET','HEAD']){
  const signup=await request('/signup/',{method,headers});assert.equal(signup.status,303);assert.equal(signup.headers.get('location'),path);
 }
 const created=await request('/signup/',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({csrf,username:'RiverTeacher',email:targetEmail,password:'new creator test password'})});
 assert.equal(created.status,303);assert.equal(created.headers.get('location'),path);
 const createdHtml=await created.text();assert.doesNotMatch(createdHtml,/data-signup-plus-offer|new creator test password/);
 assert.equal(signups,0);assert.equal(verificationSends,0);assert.equal(issued,0);assert.equal(state.accepts,0);
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
 assertPendingHomepage(homeHtml);
 assert.doesNotMatch(homeHtml,/site-analytics|data-plus-support/);
 for(const privateValue of [targetEmail,raw,invitationId,creatorId,accountId])assert.ok(!homeHtml.includes(privateValue));
 assert.equal(analyticsRequests,0);
 const page=await request(path,{headers}),html=await page.text();assert.equal(page.status,200);
 assertFocusedAccess(html,'named invitation');
 assert.match(html,/normally \$5\/month/);assert.match(html,/email address that received your invitation/);
 assert.doesNotMatch(html,/c\*\*\*@example\.invalid/);assert.ok(!html.includes(targetEmail));assert.ok(!html.includes(raw));
 assert.equal(state.acceptAttempts,0);
});

test('a public creator name cannot open another member account or grant access to a different verified email',async t=>{
 const {request,state}=await fixture(t,{account:{email:'other@example.invalid'}});
 const headers={Cookie:cookie({form:csrf,member:session,'creator-name':'river-teacher'})};
 const page=await request(path,{headers}),html=await page.text();assert.equal(page.status,200);
 assertFocusedAccess(html,'wrong-account invitation');
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
 const accepted=await submit();assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'/?creator=accepted');
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
  assertFocusedAccess(html,'named '+route);
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

test('pending named and bearer contexts redirect only their own public profile and videos on GET and HEAD',async t=>{
 let profileReads=0;
 const directory={profile:async slug=>{profileReads++;return {slug,display_name:'Public '+slug};}};
 const {request,state}=await fixture(t,{directory});
 for(const invitationCookie of [{'creator-name':'river-teacher'},{'creator-invite':raw}]){
  for(const signedIn of [false,true]){
   const headers={Cookie:cookie({...invitationCookie,...(signedIn?{member:session,form:csrf}:{})})};
   for(const method of ['GET','HEAD'])for(const suffix of ['/','/videos/']){
    const response=await request('/prospectors/river-teacher'+suffix,{method,headers});
    assert.equal(response.status,303,method+' '+suffix);
    assert.equal(response.headers.get('location'),path);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal(await response.text(),'');
   }
  }
 }
 assert.equal(profileReads,0,'Pending profile redirects happen before directory reads');
 assert.equal(state.acceptAttempts,0);assert.equal(state.consumed,false);
 const unrelated=await request('/prospectors/another-creator/',{headers:{Cookie:cookie({'creator-name':'river-teacher'})}});
 assert.equal(unrelated.status,200);assert.equal(unrelated.headers.get('location'),null);
 assert.match(await unrelated.text(),/Public another-creator/);assert.equal(profileReads,1);
});

test('ordinary, invalid and ended invitation contexts leave a public creator profile available',async t=>{
 let profileReads=0;
 const {request,state}=await fixture(t,{directory:{profile:async slug=>{profileReads++;return {slug,display_name:'Public River Teacher'};}}});
 const ordinary=async values=>{
  for(const method of ['GET','HEAD']){
   const response=await request('/prospectors/river-teacher/',{method,headers:values?{Cookie:cookie(values)}:{}});
   assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
   const html=await response.text();
   if(method==='HEAD')assert.equal(html,'');else {assert.match(html,/Public River Teacher/);assert.doesNotMatch(html,/data-creator-access-flow/);}
  }
 };
 await ordinary();await ordinary({'creator-invite':'short'});await ordinary({'creator-invite':'f'.repeat(64)});await ordinary({'creator-name':'no-such-creator'});
 for(const flag of ['consumed','revoked','expired']){
  state[flag]=true;
  await ordinary({'creator-name':'river-teacher'});await ordinary({'creator-invite':raw});
  state[flag]=false;
 }
 assert.equal(profileReads,20);assert.equal(state.acceptAttempts,0);
});

test('pending invitation context keeps all member access and recovery screens focused on GET and HEAD',async t=>{
 const {request,state}=await fixture(t);
 for(const context of [{'creator-name':'river-teacher'},{'creator-invite':raw}]){
  const headers={Cookie:cookie({form:csrf,...context})};
  for(const route of ['/signup/','/login/','/forgot-password/','/resend-verification/','/verify-email/?token='+verification,'/reset-password/?token='+verification]){
   for(const method of ['GET','HEAD']){
    const response=await request(route,{method,headers});
    if(route==='/signup/'&&context['creator-invite']){assert.equal(response.status,303);assert.equal(response.headers.get('location'),path);continue;}
    assert.equal(response.status,200,route);
    assert.match(response.headers.get('cache-control'),/no-store/);
    const html=await response.text();
    if(method==='HEAD'){assert.equal(html,'');continue;}
    assertFocusedAccess(html,route);
    assert.doesNotMatch(html,/data-signup-plus-offer|data-plus-support|site-analytics/);
    if(route==='/login/'&&context['creator-invite']){
     const email=html.match(/<input\b[^>]*name="email"[^>]*>/)?.[0]||'';
     assert.ok(email.includes('value="'+targetEmail+'"'));assert.match(email,/\breadonly\b/);
    }else assert.ok(!html.includes(targetEmail),route+' does not reveal the invited address');
   }
  }
 }
 assert.equal(state.acceptAttempts,0);assert.equal(state.consumed,false);
});

test('pending member validation and recovery results stay in the invitation shell without accepting access',async t=>{
 const consumed=[];
 const {request,state}=await fixture(t,{members:{find:async()=>null,consume:async(_raw,purpose)=>{consumed.push(purpose);return true;}}});
 for(const context of [{'creator-name':'river-teacher'},{'creator-invite':raw}]){
  const headers={Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie({form:csrf,...context})};
  for(const [route,fields,status] of [
   ['/signup/',{username:'bad!',email:targetEmail,password:'a valid test password'},400],
   ['/forgot-password/',{email:'not an email'},400],
   ['/resend-verification/',{email:targetEmail},200],
   ['/verify-email/',{token:verification},200],
   ['/reset-password/',{token:verification,password:'a new test password'},200]
  ]){
   const response=await request(route,{method:'POST',headers,body:new URLSearchParams({csrf,...fields})});
   if(route==='/signup/'&&context['creator-invite']){assert.equal(response.status,303);assert.equal(response.headers.get('location'),path);continue;}
   assert.equal(response.status,status,route);assertFocusedAccess(await response.text(),route+' result');
  }
 }
 assert.deepEqual(consumed,['verify_email','reset_password','verify_email','reset_password']);
 assert.equal(state.acceptAttempts,0);assert.equal(state.consumed,false);
});

test('wrong-account invitation offers protected inline sign-out and retains the invitation for the next sign-in',async t=>{
 let signouts=0;
 const {request,state}=await fixture(t,{account:{email:'other@example.invalid'},members:{logout:async value=>{assert.equal(value,session);signouts++;}}});
 for(const context of [{'creator-name':'river-teacher'},{'creator-invite':raw}]){
  const headers={Cookie:cookie({form:csrf,member:session,...context})};
  const page=await request(path,{headers});assert.equal(page.status,200);const html=await page.text();
  assertFocusedAccess(html,'wrong-account invitation');
  assert.match(html,/<form\b[^>]*method="post"[^>]*action="\/logout\/"[^>]*>[\s\S]*?name="csrf" value="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"[\s\S]*?<button[^>]*type="submit"[^>]*>Sign out/i);
  assert.doesNotMatch(html,/href="\/account\/"|Accept complimentary creator access/);
  const submit=(extra={},nonce=csrf)=>request('/logout/',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...extra},body:new URLSearchParams({csrf:nonce})});
  assert.equal((await submit({Origin:'https://other.example'})).status,403);
  assert.equal((await submit({},'f'.repeat(64))).status,403);
  const before=signouts;
  const signedOut=await submit();assert.equal(signedOut.status,303);assert.equal(signedOut.headers.get('location'),'/login/');
  assert.equal(signouts,before+1);
  assert.ok(signedOut.headers.getSetCookie().some(value=>/^__Host-gold-member=;/.test(value)&&/Max-Age=0/.test(value)));
  assert.ok(!signedOut.headers.getSetCookie().some(value=>/^__Host-gold-creator-(?:name|invite)=;/.test(value)),'Sign-out retains the invitation context');
  const login=await request('/login/',{headers:{Cookie:cookie({form:csrf,...context})}});
  assert.equal(login.status,200);const loginHtml=await login.text();assertFocusedAccess(loginHtml,'sign-in after wrong-account sign-out');
  assert.match(loginHtml,/name="next" value="\/creator-invitation\/"/);
 }
 assert.equal(signouts,2);assert.equal(state.acceptAttempts,0);assert.equal(state.consumed,false);
});

test('public response wrappers cannot add unrelated links to pending creator home or member screens',async t=>{
 let attachments=0,analyticsRequests=0;
 const suggestions=Object.assign(async()=>false,{enabled:async()=>true,attach:(_req,res)=>{
  attachments++;const end=res.end.bind(res);
  res.end=(chunk,...args)=>end(typeof chunk==='string'?chunk.replace('</body>','<a href="/products/">Wrapper shopping link</a></body>'):chunk,...args);
 }});
 const analytics=Object.assign(async()=>{analyticsRequests++;return false;},{enabled:async()=>true});
 const {request,state}=await fixture(t,{suggestions,analytics});
 for(const context of [{'creator-name':'river-teacher'},{'creator-invite':raw}]){
  const headers={Cookie:cookie(context)};
  for(const route of ['/','/signup/','/login/','/forgot-password/','/resend-verification/','/verify-email/?token='+verification,'/reset-password/?token='+verification]){
   const response=await request(route,{headers});
   if(route==='/signup/'&&context['creator-invite']){assert.equal(response.status,303);assert.equal(response.headers.get('location'),path);continue;}
   assert.equal(response.status,200,route);
   const html=await response.text();if(route==='/')assertPendingHomepage(html);else assertFocusedAccess(html,'unwrapped '+route);
   assert.doesNotMatch(html,/Wrapper shopping link|site-analytics\.js/);
  }
 }
 assert.equal(attachments,0);assert.equal(analyticsRequests,0);assert.equal(state.acceptAttempts,0);
 const ordinary=await request('/login/');assert.equal(ordinary.status,200);
 assert.match(await ordinary.text(),/Wrapper shopping link/,'The fixture wrapper still applies to ordinary public member pages');
 assert.equal(attachments,1);assert.equal(analyticsRequests,1);
});
