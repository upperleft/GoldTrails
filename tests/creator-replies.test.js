import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createAdminHandler} from '../app/admin.js';
import {createCreatorRepliesImportHandler} from '../app/creator-replies/handler.js';
import {CreatorReplyInputError,replyBatch,replyMailbox,replyDestination,gmailReplyUrl} from '../app/creator-replies/model.js';

const key='a'.repeat(64),csrf='b'.repeat(64),session='c'.repeat(64),origin='https://gold.example';
const replyId='11111111-1111-4111-8111-111111111111',personId='22222222-2222-4222-8222-222222222222';
const record=(extra={})=>({message_id:'1a16063e26c25562',thread_id:'1a16063e26c25562',from_email:'creator@example.invalid',from_name:'Creator',to_email:replyDestination,subject:'Re: Your Gold Trails invitation',received_at:'2026-11-01T16:20:00.000Z',...extra});
const batch=(rows=[record()])=>({mailbox:replyMailbox,destination:replyDestination,records:rows});
const metadata=()=>({state:null,replies:[{id:replyId,person_id:personId,display_name:'River Teacher',...record(),received_at:'2026-11-01 16:20:00.000000',status:'new'}]});

async function fixture(t,{syncKey=key,replyStore={},adminStore={},analytics=null}={}){
 const state={imports:[],reviews:[],logs:[]};
 const replies={ready:async()=>true,importBatch:async rows=>{state.imports.push(rows);return {imported:rows.length,duplicates:0,unmatched:0,ambiguous:0};},overview:async()=>metadata(),review:async(...args)=>state.reviews.push(args),...replyStore};
 const owners={session:async raw=>raw===session?{authenticated:true,csrf_token:csrf}:null,...adminStore};
 const log=value=>state.logs.push(value);
 const importer=createCreatorRepliesImportHandler({store:replies,syncKey,log});
 const admin=createAdminHandler({store:owners,config:{username:'owner',origin},creatorReplies:replies,creatorRepliesSyncConfigured:importer.configured,log});
 const server=createServer({creatorRepliesImport:importer,admin,guests:null,plus:null,almanac:async()=>false,analytics,log});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path,init={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',...init});
 const post=(value=batch(),headers={})=>request('/api/creator-replies/import',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
 const adminPost=(fields={},headers={})=>request('/admin/creator-replies/',{method:'POST',headers:{Cookie:'__Host-gold-admin='+session,Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({csrf,id:replyId,status:'reviewed',...fields})});
 return {request,post,adminPost,state};
}

test('reply metadata excludes personal Gmail destinations, bodies, snippets, attachments and unexpected fields',()=>{
 assert.equal(replyBatch(batch())[0].from_email,'creator@example.invalid');
 const invalid=[
  {...batch(),mailbox:'other@gmail.com'}, {...batch(),destination:'other@example.invalid'},
  {...batch(),body:'private'},batch([record({to_email:'pshmker@gmail.com'})]),batch([record({snippet:'private'})]),
  batch([record({body:'private'})]),batch([record({attachments:[]})]),batch([record({from_email:'Display <x@example.invalid>'})]),
  batch([record({subject:'Header\r\nInjection'})]),batch([record({thread_id:'https://evil.invalid/'})]),
  batch([record({received_at:'2026-02-31T16:20:00.000Z'})]),batch([record({received_at:'2099-01-01T00:00:00.000Z'})]),
  batch([record(),record()]),batch(Array.from({length:21},(_,i)=>record({message_id:i.toString(16).padStart(16,'0')})))
 ];
 for(const value of invalid)assert.throws(()=>replyBatch(value),CreatorReplyInputError);
 assert.deepEqual(replyBatch(batch([])),[],'Empty checks are allowed without importing email contents');
});

test('subjects and names remove invitation capabilities and original links are constructed from Gmail IDs',()=>{
 const raw='d'.repeat(64),link='https://goldtrails.org/creator-invitation/?token='+raw;
 const row=replyBatch(batch([record({subject:'Re: '+link,from_name:raw})]))[0];
 assert.ok(!JSON.stringify(row).includes(raw));assert.ok(!row.subject.includes('/creator-invitation/'));
 assert.equal(gmailReplyUrl('https://evil.invalid/'),null);
 assert.equal(gmailReplyUrl(record().thread_id),'https://mail.google.com/mail/u/?authuser=pshmker%40gmail.com#all/'+record().thread_id);
});

test('metadata endpoint requires a configured 256-bit key and does not disclose metadata on rejected imports',async t=>{
 for(const syncKey of [undefined,'short','g'.repeat(64)]){
  const {post,state}=await fixture(t,{syncKey:syncKey??''});
  const response=await post();assert.equal(response.status,503);assert.equal(state.imports.length,0);
 }
 const {post,state}=await fixture(t);
 for(const authorization of ['', 'Bearer '+'f'.repeat(64),'Basic '+key]){
  const response=await post(batch(),{Authorization:authorization});assert.equal(response.status,401);
  const text=await response.text();assert.ok(!text.includes(key));assert.ok(!text.includes(record().from_email));
 }
 assert.equal(state.imports.length,0);
});

test('server-to-server import never enters public wrappers and returns counts without private metadata',async t=>{
 let analyticsRequests=0;
 const analytics=Object.assign(async()=>{analyticsRequests++;return false;},{enabled:async()=>true});
 const {post,state}=await fixture(t,{analytics});
 const response=await post();assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,imported:1,duplicates:0,unmatched:0,ambiguous:0});
 assert.equal(state.imports.length,1);assert.equal(analyticsRequests,0);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
 assert.equal(response.headers.get('access-control-allow-origin'),null);
});

test('import rejects browser origins, unsupported methods/content, oversized JSON, queries and invalid metadata',async t=>{
 const {request,post,state}=await fixture(t);
 for(const method of ['GET','HEAD','OPTIONS','PUT']){
  const response=await request('/api/creator-replies/import',{method});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'POST');assert.equal(response.headers.get('access-control-allow-origin'),null);
 }
 assert.equal((await post(batch(),{Origin:'https://other.invalid'})).status,403);
 assert.equal((await post(batch(),{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post({...batch(),padding:'x'.repeat(33000)})).status,413);
 assert.equal((await post(batch([record({snippet:'private body'})]))).status,400);
 const bad=await request('/api/creator-replies/import',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{'});assert.equal(bad.status,400);
 const query=await request('/api/creator-replies/import?token=secret',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}'});assert.equal(query.status,400);
 assert.equal(state.imports.length,0);
});

test('storage outages and missing migration return controlled failures without logging secrets or payloads',async t=>{
 for(const replyStore of [{ready:async()=>false},{ready:async()=>{throw Error('private '+key);}},{importBatch:async()=>{throw Error('SQL private '+record().from_email+' '+key);}}]){
  const {post,state}=await fixture(t,{replyStore});const response=await post();assert.equal(response.status,503);
  const output=await response.text()+JSON.stringify(state.logs);
  assert.ok(!output.includes(key));assert.ok(!output.includes(record().from_email));assert.ok(!output.includes('SQL'));
 }
});

test('private reply panel requires administrator authentication and protects review changes with origin and CSRF',async t=>{
 const {request,adminPost,state}=await fixture(t);
 for(const cookie of ['', '__Host-gold-member='+session]){
  const response=await request('/admin/creator-replies/',{headers:{Cookie:cookie}});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/admin/login/');
 }
 for(const headers of [{Origin:'https://other.invalid'},{Cookie:''}])assert.equal((await adminPost({},headers)).status,403);
 assert.equal((await adminPost({csrf:'f'.repeat(64)})).status,403);assert.equal(state.reviews.length,0);
 const saved=await adminPost();assert.equal(saved.status,200);assert.deepEqual(state.reviews,[[replyId,'reviewed','owner']]);
 assert.match(await saved.text(),/Reply reference review saved/);
});

test('private panel escapes headers, distinguishes general mail and shows honest configuration and sync state',async t=>{
 const data=metadata();data.replies[0].subject='<script>alert(1)</script>';data.replies[0].from_name='<img src=x onerror=alert(1)>';
 data.replies.push({...data.replies[0],id:'33333333-3333-4333-8333-333333333333',person_id:null,display_name:null,subject:'A general inquiry'});
 const {request}=await fixture(t,{syncKey:'',replyStore:{overview:async()=>data}});
 const response=await request('/admin/creator-replies/',{headers:{Cookie:'__Host-gold-admin='+session}});
 assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>alert|<img src=x/);
 assert.match(html,/General Gold Trails email/);assert.match(html,/No unique creator match/);
 assert.match(html,/disabled until its private sync key is configured/);assert.match(html,/Forwarding and scheduled checks must be connected separately/);assert.match(html,/No successful import yet/);
 assert.match(html,/https:\/\/mail\.google\.com\/mail\/u\/\?authuser=pshmker%40gmail.com#all\//);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
});

test('optional reply storage failures do not prevent normal administrator sign-in pages or invitation pages',async t=>{
 const {request,state}=await fixture(t,{replyStore:{ready:async()=>{throw Error('private '+key);}}});
 const response=await request('/admin/creator-replies/',{headers:{Cookie:'__Host-gold-admin='+session}});assert.equal(response.status,503);
 assert.ok(!(await response.text()).includes(key));assert.deepEqual(state.logs,['Gold Trails creator reply workspace unavailable']);
 const invitations=await request('/admin/creator-invitations/',{headers:{Cookie:'__Host-gold-admin='+session}});assert.equal(invitations.status,503);assert.match(await invitations.text(),/Creator invitations are being prepared/);
});
