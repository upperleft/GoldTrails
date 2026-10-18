import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createMemberHandler} from '../app/members.js';

const origin='https://gold.example';
const csrf='a'.repeat(64),emailToken='b'.repeat(64);
const identity={username:'TrailReader',email:'reader@example.invalid',password:'a useful test password'};

async function fixture(t,options={}){
 const server=createServer({members:createMemberHandler({config:{origin,open:true},log:()=>{},...options}),goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return (path,fields=null,headers={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{
  redirect:'manual',
  ...(fields===null?{}:{method:'POST',body:new URLSearchParams({csrf,...fields})}),
  headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:`__Host-gold-form=${csrf}`,...headers}
 });
}

function offer(html){
 const dialog=html.match(/<dialog\b(?=[^>]*\bid="signup-plus-offer")[^>]*>[\s\S]*?<\/dialog>/)?.[0];
 assert.ok(dialog,'the signup offer is a native dialog');
 assert.match(dialog,/\bdata-signup-plus-offer(?:\s|=|>)/);
 assert.match(dialog,/<button\b[^>]*>[\s\S]*?Maybe later[\s\S]*?<\/button>/);
 assert.match(dialog,/<a\b[^>]*href="\/plus\/"[^>]*>[\s\S]*?Yes, subscribe[\s\S]*?<\/a>/);
 return dialog;
}
function noAutomaticOffer(html){assert.doesNotMatch(html,/\bdata-signup-plus-autoopen(?:\s|=|>)/);}

test('open signup prepares an offer without interrupting completion of the registration form',async t=>{
 let writes=0;
 const request=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,signup:async()=>writes++}});
 const response=await request('/signup/');
 assert.equal(response.status,200);
 const html=await response.text();
 offer(html);noAutomaticOffer(html);
 assert.match(html,/<form\b[^>]*data-async-signup/);
 assert.match(html,/name="email"/);
 assert.equal(writes,0);
});

test('fresh and duplicate signup show the same Plus offer without revealing account existence in HTML or JSON',async t=>{
 let created=0,sent=0;
 const fresh=await fixture(t,{mail:async()=>sent++,store:{ready:async()=>true,allow:async()=>true,signup:async data=>{created++;return{id:'new-member',email:data.email};},issue:async()=>emailToken}});
 const duplicate=await fixture(t,{mail:async()=>assert.fail('a duplicate signup must not send an extra message'),store:{ready:async()=>true,allow:async()=>true,signup:async()=>{throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});}}});
 const htmlResults=await Promise.all([fresh('/signup/',identity),duplicate('/signup/',identity)]);
 const dialogs=[];
 for(const response of htmlResults){
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Your signup request was received/);
  assert.match(html,/href="\/resend-verification\/"/);
  const dialog=offer(html);assert.match(dialog,/\bdata-signup-plus-autoopen(?:\s|=|>)/);dialogs.push(dialog);
 }
 assert.equal(dialogs[0],dialogs[1]);
 const jsonResults=await Promise.all([fresh('/signup/',identity,{Accept:'application/json'}),duplicate('/signup/',identity,{Accept:'application/json'})]);
 const outcomes=[];
 for(const response of jsonResults){
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/application\/json/);
  const outcome=await response.json();
  assert.equal(outcome.outcome,'email_requested');
  assert.equal(outcome.title,'Check your email');
  assert.doesNotMatch(JSON.stringify(outcome),/<dialog|reader@example\.invalid|scrypt:/);
  outcomes.push(outcome);
 }
 assert.deepEqual(outcomes[0],outcomes[1]);
 assert.equal(created,2);assert.equal(sent,2);
});

test('closed signup and validation, security, throttling and delivery failures never open the sales dialog',async t=>{
 let created=0;
 const active=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,allow:async()=>true,signup:async()=>created++}});
 for(const [fields,headers,status] of [[{...identity,password:'short'},{},400],[identity,{Origin:'https://other.example'},403],[{...identity,csrf:'c'.repeat(64)},{},403]]){
  const response=await active('/signup/',fields,headers);assert.equal(response.status,status);noAutomaticOffer(await response.text());
 }
 assert.equal(created,0);
 const closed=await fixture(t,{store:{ready:async()=>true,signup:async()=>assert.fail('closed registration must not write')}});
 for(const fields of [null,identity]){const response=await closed('/signup/',fields);assert.equal(response.status,200);const html=await response.text();assert.match(html,/fieldset disabled/);noAutomaticOffer(html);}
 const limited=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,allow:async()=>false,signup:async()=>assert.fail('throttled registration must not write')}});
 const throttled=await limited('/signup/',identity);assert.equal(throttled.status,429);noAutomaticOffer(await throttled.text());
 const outage=await fixture(t,{mail:async()=>{throw Error('private provider outage');},store:{ready:async()=>true,allow:async()=>true,signup:async data=>({id:'new-member',email:data.email}),issue:async()=>emailToken}});
 const unavailable=await outage('/signup/',identity);assert.equal(unavailable.status,503);const html=await unavailable.text();noAutomaticOffer(html);assert.doesNotMatch(html,/private provider outage/);
});

test('sign-in, account recovery and email verification remain outside the automatic signup promotion',async t=>{
 const request=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,allow:async()=>true,find:async()=>null,consume:async()=>true}});
 for(const path of ['/login/','/forgot-password/','/resend-verification/','/verify-email/?token='+emailToken,'/reset-password/?token='+emailToken]){
  const response=await request(path);assert.equal(response.status,200,path);noAutomaticOffer(await response.text());
 }
 for(const [path,fields] of [['/forgot-password/',{email:identity.email}],['/resend-verification/',{email:identity.email}],['/verify-email/',{token:emailToken}]]){
  const response=await request(path,fields);assert.equal(response.status,200,path);noAutomaticOffer(await response.text());
 }
 const failed=await request('/login/',{email:identity.email,password:identity.password});assert.equal(failed.status,401);noAutomaticOffer(await failed.text());
});

test('the signup promotion cannot grant paid access or bypass the disabled payment gate',async t=>{
 let submitted;
 const request=await fixture(t,{mail:async()=>{},store:{ready:async()=>true,allow:async()=>true,signup:async data=>{submitted=data;return{id:'new-member',email:data.email};},issue:async()=>emailToken}});
 const signup=await request('/signup/',{...identity,level:'subscriber',effective_level:'subscriber',plan:'plus',subscribe:'true'});
 assert.equal(signup.status,200);offer(await signup.text());
 for(const key of ['level','effective_level','plan','subscribe'])assert.equal(submitted[key],undefined,`${key} cannot become a signup entitlement`);
 assert.doesNotMatch(signup.headers.get('set-cookie')||'',/__Host-gold-member=/,'registration does not sign in or create a paid session');
 const plus=await request('/plus/');assert.equal(plus.status,200);const html=await plus.text();
 assert.match(html,/Subscribe · \$5\/month/);assert.match(html,/<button\b[^>]*\bdisabled\b/);
 const payment=await request('/billing/subscribe/',{level:'subscriber',amount:'5'});
 assert.equal(payment.status,503);assert.match(await payment.text(),/No payment has been created or confirmed/);
 const protectedGuide=await request('/api/gold-almanac/california/');assert.equal(protectedGuide.status,403);assert.equal((await protectedGuide.json()).code,'plus_required');
});
