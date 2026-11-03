import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createAdminHandler} from '../app/admin.js';
import {CreatorInvitationError} from '../app/creator-invitations/model.js';

const origin='https://gold.example',path='/admin/creator-invitations/';
const csrf='a'.repeat(64),adminSession='b'.repeat(64),inviteToken='c'.repeat(64);
const ownerId='11111111-1111-4111-8111-111111111111';
const creatorId='22222222-2222-4222-8222-222222222222';
const invitationId='33333333-3333-4333-8333-333333333333';
const targetEmail='creator@example.invalid',ownerEmail='owner@example.invalid';

async function fixture(t,options={}){
 const state={configured:[],issued:[],revoked:[],logs:[],history:[],...options.state};
 const creator={id:creatorId,slug:'river-teacher',display_name:'River Teacher <script>bad()</script>'};
 const invitations={
  ready:async()=>true,
  overview:async()=>({owner:{id:ownerId,email:ownerEmail,username:'Owner'},creators:[creator],invitations:state.history}),
  configureOwner:async(email,actor)=>{state.configured.push({email,actor});return{id:ownerId,email,username:'Owner'};},
  issue:async input=>{
   state.issued.push(input);
   const created={id:invitationId,person_id:creatorId,target_email:input.email,display_name:creator.display_name,
    slug:creator.slug,expires_at:new Date(Date.now()+14*86400000).toISOString()};
   state.history=[{...created,status:'pending'}];
   return{...created,raw:inviteToken};
  },
  revoke:async(id,actor)=>{state.revoked.push({id,actor});return{revoked:true};},
  ...options.invitations
 };
 const store={session:async raw=>raw===adminSession?{authenticated:1,csrf_token:csrf}:null};
 const admin=createAdminHandler({store,creatorInvitations:invitations,
  config:{origin,username:'site-owner',passwordHash:'unused-in-this-fixture'},
  log:message=>state.logs.push(String(message))});
 const server=createServer({admin,goldPrice:async()=>({})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(url=path,options={})=>fetch(`http://127.0.0.1:${server.address().port}${url}`,{redirect:'manual',...options});
 const post=(fields,headers={})=>request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',
  Cookie:`__Host-gold-admin=${adminSession}`,...headers},body:new URLSearchParams({csrf,...fields})});
 const ownerGet=(url=path)=>request(url,{headers:{Cookie:`__Host-gold-admin=${adminSession}`}});
 return{state,request,post,ownerGet};
}

test('creator invitation administration is owner-only and GET requests never issue or revoke links',async t=>{
 const {request,ownerGet,post,state}=await fixture(t);
 const anonymous=await request();assert.equal(anonymous.status,303);assert.equal(anonymous.headers.get('location'),'/admin/login/');
 const forged=await post({action:'issue',personId:creatorId,email:targetEmail},{Cookie:''});assert.equal(forged.status,403);
 for(const query of ['',`?action=issue&personId=${creatorId}&email=${targetEmail}`,`?action=revoke&id=${invitationId}`]){
  const response=await ownerGet(path+query);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/Creator invitations/);
  assert.match(html,/River Teacher &lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>bad\(\)/);
  assert.match(html,/<form[^>]*method="post"[^>]*action="\/admin\/creator-invitations\/"/);
  assert.match(html,/name="action" value="issue"/);
 }
 assert.equal(state.issued.length,0);assert.equal(state.revoked.length,0);assert.equal(state.configured.length,0);
});

test('owner invitation actions require the existing owner Origin and CSRF controls',async t=>{
 const {post,state}=await fixture(t);
 const input={action:'issue',personId:creatorId,email:targetEmail};
 for(const Origin of ['https://evil.example','null',''])assert.equal((await post(input,{Origin})).status,403);
 for(const value of ['','short','d'.repeat(64)])assert.equal((await post({...input,csrf:value})).status,403);
 assert.equal((await post(input,{Cookie:`__Host-gold-admin=${'e'.repeat(64)}`})).status,403);
 assert.equal(state.issued.length,0);assert.equal(state.revoked.length,0);assert.equal(state.configured.length,0);
});

test('owner issue shows the private creator code once while later overviews keep that capability private',async t=>{
 const {post,ownerGet,state}=await fixture(t);
 const configured=await post({action:'configure_owner',email:ownerEmail});assert.equal(configured.status,200);
 assert.deepEqual(state.configured,[{email:ownerEmail,actor:'site-owner'}]);
 const issued=await post({action:'issue',personId:creatorId,email:targetEmail},{Host:'untrusted.example'});
 assert.equal(issued.status,200);
 assert.deepEqual(state.issued,[{personId:creatorId,email:targetEmail,actor:'site-owner'}]);
 const html=await issued.text();
 assert.ok(html.includes(origin+'/invite/river-teacher/?code='+inviteToken));
 const personalLink=html.match(/<input\b[^>]*aria-label="Personal invitation link"[^>]*>/)?.[0]||'';
 assert.ok(personalLink.includes('value="'+origin+'/invite/river-teacher/?code='+inviteToken+'"'));
 assert.match(personalLink,/\breadonly\b/);
 assert.ok(!html.includes('https://untrusted.example'));
 assert.match(html,/readonly[^>]*aria-label="Personal invitation link"/);
 assert.match(html,/Invitation message/);assert.match(html,/has not been sent/i);
 assert.match(html,/without a separate verification email|No separate verification email/i);
 assert.match(issued.headers.get('cache-control'),/no-store/);
 assert.equal(issued.headers.get('referrer-policy'),'strict-origin');
 assert.match(issued.headers.get('x-robots-tag'),/noindex/);
 assert.match(issued.headers.get('content-security-policy'),/script-src 'none'/);
 for(let count=0;count<2;count++){
  const overview=await ownerGet();assert.equal(overview.status,200);
  const summary=await overview.text();assert.ok(!summary.includes(inviteToken));assert.match(summary,/pending/);
  assert.match(summary,/name="action" value="revoke"/);
 }
 assert.ok(state.logs.every(message=>!message.includes(inviteToken)&&!message.includes(targetEmail)));
});

test('pending invitations can be revoked through POST while accepted grants return a conflict',async t=>{
 const active=await fixture(t);
 const revoked=await active.post({action:'revoke',id:invitationId});assert.equal(revoked.status,200);
 assert.deepEqual(active.state.revoked,[{id:invitationId,actor:'site-owner'}]);
 assert.match(await revoked.text(),/pending invitation link has been revoked/i);
 const accepted=await fixture(t,{invitations:{revoke:async()=>{throw new CreatorInvitationError('invitation_unavailable','Only pending invitation links can be revoked.',409);}}});
 const conflict=await accepted.post({action:'revoke',id:invitationId});assert.equal(conflict.status,409);
 assert.match(await conflict.text(),/Only pending/);
});

test('unready storage and malformed actions cannot mutate invitation data',async t=>{
 const unavailable=await fixture(t,{invitations:{ready:async()=>false}});
 assert.equal((await unavailable.ownerGet()).status,503);
 assert.equal((await unavailable.post({action:'issue',personId:creatorId,email:targetEmail})).status,503);
 assert.equal(unavailable.state.issued.length,0);
 const ready=await fixture(t);
 for(const action of ['','remove_account','send_email'])assert.equal((await ready.post({action})).status,400);
 const duplicate=await ready.request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:`__Host-gold-admin=${adminSession}`},
  body:new URLSearchParams([['csrf',csrf],['action','issue'],['action','revoke']])});
 assert.equal(duplicate.status,400);
 const wrongType=await ready.request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:`__Host-gold-admin=${adminSession}`},body:'{}'});
 assert.equal(wrongType.status,400);assert.equal(ready.state.issued.length,0);assert.equal(ready.state.revoked.length,0);
});

test('private invitation storage failures never expose target emails or token material',async t=>{
 const sensitive=`SQL failure ${targetEmail} ${inviteToken}`;
 const {post,state}=await fixture(t,{invitations:{issue:async()=>{throw Error(sensitive);}}});
 const response=await post({action:'issue',personId:creatorId,email:targetEmail});assert.equal(response.status,503);
 const html=await response.text();assert.ok(!html.includes(sensitive));assert.ok(!html.includes(targetEmail));assert.ok(!html.includes(inviteToken));
 assert.ok(state.logs.every(message=>!message.includes(sensitive)&&!message.includes(targetEmail)&&!message.includes(inviteToken)));
});
