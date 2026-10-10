import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createProductsHandler} from '../app/product-reports.js';
import {createAdminHandler} from '../app/admin.js';
import {productCatalog,mergedProducts} from '../app/products-page.js';
import {reportInput,productInput,createProductWorkspace,ProductConflict} from '../app/product-workspace.js';
const origin='https://gold.example',nonce='a'.repeat(64),admin='b'.repeat(64),csrf='c'.repeat(64),member='d'.repeat(64),rid='11111111-1111-4111-8111-111111111111';
const reportFields={product:'GT-P0002',submission_id:rid,report_type:'incorrect',message:'The product URL has changed.',suggested_url:'https://example.com/updated',reply_email:'reporter@example.com'};
import {memoryWorkspace} from './helpers/product-workspace-fixture.js';

async function fixture(t){const ws=memoryWorkspace();const auth={session:async raw=>raw===admin?{authenticated:1,csrf_token:csrf}:null};const server=createServer({products:createProductsHandler({store:ws,config:{origin},members:{session:async raw=>raw===member?{id:rid}:null},log:()=>{}}),admin:createAdminHandler({store:auth,config:{origin,username:'owner'},workspace:ws,log:()=>{}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const request=(path,fields,headers={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',headers:{...(fields?{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers},...(fields?{method:'POST',body:new URLSearchParams(fields)}:{})});return {ws,request};}
const pubHeaders={Cookie:`__Host-gold-report=${nonce}`},adminHeaders={Cookie:`__Host-gold-admin=${admin}`};
test('report → admin queue → reviewed edit → public catalog works without email or automatic publication',async t=>{
 const {ws,request}=await fixture(t);const form=await request('/products/report/?product=GT-P0002');assert.equal(form.status,200);assert.match(form.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);assert.equal(form.headers.get('referrer-policy'),'strict-origin');
 assert.equal((await request('/products/report/',{csrf:nonce,...reportFields},pubHeaders)).status,200);assert.equal(ws.reportsData.length,1);assert.equal(ws.overrides.length,0);
 const queue=await request('/admin/reports/',null,adminHeaders);assert.match(await queue.text(),/Garrett/);
 const detail=await request('/admin/reports/'+rid+'/',null,adminHeaders);assert.match(await detail.text(),/The product URL has changed/);
 const p=productCatalog().find(p=>p.product_id==='GT-P0002'),edit={...p,product_name:'Garrett reviewed pan',editor_note:'Confirmed the updated manufacturer listing',source_url:'https://example.com/updated',version:'0',csrf};
 assert.equal((await request('/admin/products/GT-P0002/',edit,adminHeaders)).status,303);assert.equal(ws.changesData.length,1);assert.match(await (await request('/products/')).text(),/Garrett reviewed pan/);
 assert.equal((await request('/admin/reports/'+rid+'/',{csrf,version:'0',status:'resolved',editor_note:'Updated the catalog'},adminHeaders)).status,303);assert.equal(ws.eventsData.length,1);assert.equal(ws.reportsData[0].status,'resolved');
});
test('admin dashboard, product editor, member profiles and reports require owner session and valid mutation origin/CSRF',async t=>{
 const {request,ws}=await fixture(t);for(const path of ['/admin/','/admin/products/','/admin/members/','/admin/members/'+rid+'/','/admin/reports/','/admin/reports/'+rid+'/'])assert.equal((await request(path)).headers.get('location'),'/admin/login/');
 for(const headers of [{...adminHeaders,Origin:'https://evil.example'},{...adminHeaders}]){const fields={csrf:headers.Origin?csrf:'f'.repeat(64),version:'0'};assert.equal((await request('/admin/products/GT-P0002/',fields,headers)).status,403);}assert.equal(ws.overrides.length,0);
 const dashboard=await request('/admin/',null,adminHeaders);assert.equal(dashboard.status,200);assert.match(await dashboard.text(),/Administrator dashboard/);
 const profile=await request('/admin/members/'+rid+'/',null,adminHeaders),html=await profile.text();assert.match(html,/private@example.com/);assert.doesNotMatch(html,/NEVER_RENDER_PASSWORD_HASH/);
});
test('public reports reject forged Origin/CSRF, invalid IDs, unsafe links and spam; retries are idempotent',async t=>{
 const {ws,request}=await fixture(t);for(const fields of [{...reportFields,csrf:'f'.repeat(64)},{...reportFields,csrf:nonce,product:'not-real'},{...reportFields,csrf:nonce,suggested_url:'javascript:alert(1)'},{...reportFields,csrf:nonce,company_website:'spam'}]){assert.ok((await request('/products/report/',fields,pubHeaders)).status>=400);}assert.equal(ws.reportsData.length,0);
 assert.equal((await request('/products/report/',{csrf:nonce,...reportFields},{...pubHeaders,Origin:'null'})).status,403);
 const fields={csrf:nonce,...reportFields,account_id:'evil',level:'subscriber'};for(let i=0;i<2;i++)assert.equal((await request('/products/report/',fields,pubHeaders)).status,200);assert.equal(ws.reportsData.length,1);assert.equal(ws.reportsData[0].account_id,null);
 ws.setAllowed(false);assert.equal((await request('/products/report/',fields,pubHeaders)).status,429);
});
test('submitted markup is escaped, member identity comes from session, and stale owner edits conflict',async t=>{
 const {ws,request}=await fixture(t);await request('/products/report/',{csrf:nonce,...reportFields,message:'<script>alert("x")</script>',business_name:'<img src=x onerror=alert(1)>'},{Cookie:`__Host-gold-report=${nonce}; __Host-gold-member=${member}`});assert.equal(ws.reportsData[0].account_id,rid);
 const html=await (await request('/admin/reports/'+rid+'/',null,adminHeaders)).text();assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);assert.match(html,/&lt;img/);
 assert.equal((await request('/admin/reports/'+rid+'/',{csrf,version:'9',status:'resolved'},adminHeaders)).status,409);assert.equal(ws.eventsData.length,0);
});
test('missing migration leaves public catalog working and reports honestly unavailable',async t=>{const {ws,request}=await fixture(t);ws.setReady(false);assert.equal((await request('/products/')).status,200);assert.equal((await request('/products/report/?product=GT-P0002')).status,503);assert.equal((await request('/admin/products/',null,adminHeaders)).status,200);assert.equal((await request('/admin/reports/',null,adminHeaders)).status,503);});
test('product edits and report reviews lock revisions, audit atomically and roll back conflicts',async()=>{
 const sql=[];let rollback=false,commit=false;const c={beginTransaction:async()=>{},query:async(q,args)=>{sql.push([q,args]);if(q.startsWith('SELECT edit_version,changes_json'))return[{edit_version:2,changes_json:'{}'}];if(q.startsWith('SELECT edit_version FROM product_reports'))return[{edit_version:0}];return [];},rollback:async()=>rollback=true,commit:async()=>commit=true,release:()=>{}};const store=createProductWorkspace({getConnection:async()=>c});const p=productCatalog()[0],f=new URLSearchParams({...p,editor_note:'Confirmed official product page'}),data=productInput(f);
 await assert.rejects(store.saveProduct(p.product_id,0,data,'owner'),ProductConflict);assert.ok(rollback&&!commit);sql.length=0;await store.saveProduct(p.product_id,2,data,'owner');assert.ok(sql.some(([q])=>q.includes('FOR UPDATE')));assert.ok(sql.some(([q])=>q.startsWith('INSERT INTO product_change_log')));assert.ok(commit);
 sql.length=0;await store.review(rid,0,'resolved','Confirmed source','owner');assert.ok(sql.some(([q])=>q.startsWith('INSERT INTO product_report_events')));
});
test('input validation bounds private fields and permits only supported report/product changes',()=>{assert.throws(()=>reportInput(new URLSearchParams({...reportFields,message:'short'})));assert.throws(()=>reportInput(new URLSearchParams({...reportFields,reply_email:'bad'})));const p=productCatalog()[0];assert.throws(()=>productInput(new URLSearchParams({...p,editor_note:'',availability:'current'})));assert.throws(()=>productInput(new URLSearchParams({...p,editor_note:'Checked',official_product_url:'https://user:secret@example.com'})));});
