import test from 'node:test';
import assert from 'node:assert/strict';
import {createSuggestionsHandler,suggestionInbox} from '../app/suggestions.js';
import {createAdminHandler} from '../app/admin.js';
import {createServer} from '../app/server.js';
import {createAnalyticsHandler} from '../app/analytics/handler.js';
const origin='https://gold.test',csrf='b'.repeat(64),cookie='__Host-gold-admin='+'a'.repeat(64);
async function fixture(t){
 const rows=[],store={ready:async()=>true,submit:async r=>{if(!rows.some(x=>x.id===r.id))rows.push({...r,status:'new',created_at:'2026-10-15'});},list:async status=>rows.filter(r=>r.status===status),review:async(id,status)=>{rows.find(r=>r.id===id).status=status;}};
 const admin=createAdminHandler({store:{session:async raw=>raw==='a'.repeat(64)?{authenticated:1,csrf_token:csrf}:null},config:{origin},suggestionStore:store,log:()=>{}});
 const suggestions=createSuggestionsHandler({store,origin,log:()=>{}}),analytics=createAnalyticsHandler({origin,store:{ready:async()=>true},log:()=>{}});
 const server=createServer({suggestions,admin,analytics,goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const request=(path,init={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...init});
 const form=async()=>{const html=await(await request('/')).text();return new URLSearchParams({token:html.match(/name="token" value="([^"]+)"/)[1],page:'/',message:'Please add more photographs of gold pans.',website:''});};
 const post=(body,headers={})=>request('/suggestions/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers},body});return{rows,request,form,post};
}
test('public footer offers a real accessible suggestion form, independent of statistics',async t=>{
 const f=await fixture(t),html=await(await f.request('/')).text();assert.match(html,/<details class="suggestion-box">/);assert.match(html,/textarea name="message"/);assert.match(html,/No login needed/);assert.match(html,/site-analytics.js/);
 const r=await f.post(await f.form());assert.equal(r.status,200);assert.match(await r.text(),/saved in the private Gold Trails review inbox/);assert.equal(f.rows.length,1);assert.equal(f.rows[0].path,'/');
});
test('repeated submission is idempotent; forged forms, cross-site posts and hidden spam are rejected',async t=>{
 const f=await fixture(t),form=await f.form();await f.post(form);await f.post(form);assert.equal(f.rows.length,1);
 assert.equal((await f.post(await f.form(),{Origin:'https://evil.test'})).status,403);
 let bad=await f.form();bad.set('token','forged');assert.equal((await f.post(bad)).status,403);
 bad=await f.form();bad.set('website','spam');assert.equal((await f.post(bad)).status,400);assert.equal(f.rows.length,1);
});
test('bad input does not claim success, retains escaped text for correction, and bounds payload size',async t=>{
 const f=await fixture(t),form=await f.form();form.set('message','<b>');const r=await f.post(form);assert.equal(r.status,400);assert.match(await r.text(),/&lt;b&gt;/);assert.equal(f.rows.length,0);
 assert.equal((await f.post('message='+'x'.repeat(41000))).status,413);
 const forged=await(await f.request('/suggestions/?sent=1')).text();assert.doesNotMatch(forged,/Your suggestion has been saved/);
});
test('suggestions stay private, owner review requires CSRF, and review is reversible',async t=>{
 const f=await fixture(t);let form=await f.form();form.set('message','<script>alert("unsafe")</script>');await f.post(form);
 assert.equal((await f.request('/admin/suggestions/')).status,303);
 let r=await f.request('/admin/suggestions/',{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');let html=await r.text();assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 const body=new URLSearchParams({csrf,id:f.rows[0].id,status:'reviewed'}),headers={Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie};
 assert.equal((await f.request('/admin/suggestions/',{method:'POST',headers,body})).status,303);assert.equal(f.rows[0].status,'reviewed');
 body.set('status','new');await f.request('/admin/suggestions/',{method:'POST',headers,body});assert.equal(f.rows[0].status,'new');body.set('csrf','0'.repeat(64));assert.equal((await f.request('/admin/suggestions/',{method:'POST',headers,body})).status,403);
});
test('disconnected storage shows an unavailable message and never claims delivery',async t=>{
 const handler=createSuggestionsHandler(),server=createServer({suggestions:handler,goldPrice:async()=>({})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 assert.doesNotMatch(await(await fetch(base+'/')).text(),/suggestion-box/);const r=await fetch(base+'/suggestions/');assert.equal(r.status,503);assert.match(await r.text(),/temporarily unavailable/);
});
