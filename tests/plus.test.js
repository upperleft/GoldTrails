import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {plusMarkup} from '../app/plus/handler.js';
import {createMemberHandler} from '../app/members.js';
import {states} from '../app/almanac/model.js';
const active='a'.repeat(64),free='b'.repeat(64),expired='c'.repeat(64),owner='d'.repeat(64);
async function fixture(t,{offline=false}={}){
 let lookups=0;const sessions=new Map([[active,{effective_level:'subscriber'}],[free,{effective_level:'free'}],[expired,{level:'subscriber',effective_level:'free'}]]);
 const almanac=createAlmanacHandler({members:{session:async raw=>{if(offline)throw Error('private auth detail');return sessions.get(raw)||null;}},owners:{session:async raw=>raw===owner?{authenticated:1}:null},store:async()=>{lookups++;return{};}});
 const server=createServer({almanac,members:createMemberHandler({}),goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const request=(path,token=null,init={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...init,headers:{...(token?{Cookie:'__Host-gold-member='+token}:{}),...init.headers}});return{request,lookups:()=>lookups};
}
test('all 50 guides and JSON endpoints require active access before any research lookup',async t=>{
 const f=await fixture(t);let r=await f.request('/gold-almanac/');assert.equal(r.status,200);let html=await r.text();assert.match(html,/class="almanac-promo"/);assert.doesNotMatch(html,/PUBLIC EXCERPT|California: the lay of the land|Almanac preview|almanac-promo[^>]*data-state/);assert.equal((html.match(/<li><svg/g)||[]).length,1);assert.match(html,/Subscriptions are|subscriptions are|subscriptions are not/);assert.doesNotMatch(html,/aria-pressed="true"/);
 for(const state of states){r=await f.request('/api/gold-almanac/'+state.slug+'/');assert.equal(r.status,403);const body=await r.json();assert.equal(body.code,'plus_required');assert.doesNotMatch(body.html,/data-record-id=|almanac-note|source-ids/);}
 r=await f.request('/gold-almanac/nevada/');assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/3,479,748/);assert.equal(f.lookups(),0);
});
test('active subscriptions unlock HTML and JSON; cached research never bypasses per-request authorization',async t=>{
 const f=await fixture(t);let r=await f.request('/gold-almanac/nevada/',active);assert.equal(r.status,200);assert.match(await r.text(),/3,479,748/);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');assert.equal(r.headers.get('x-robots-tag'),'noindex');
 r=await f.request('/api/gold-almanac/nevada/',active);assert.equal(r.status,200);assert.equal(f.lookups(),1);for(const token of [null,free,expired,'e'.repeat(64)])assert.equal((await f.request('/api/gold-almanac/nevada/',token)).status,403);assert.equal(f.lookups(),1);
 assert.equal((await f.request('/gold-almanac/nevada/',free,{method:'HEAD'})).status,403);
 assert.equal((await f.request('/gold-almanac/?state=nevada',free)).headers.get('location'),'/gold-almanac/nevada/');
});
test('verified owner preview works while an arbitrary owner cookie and authentication outages cannot unlock content',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/gold-almanac/california/',null,{headers:{Cookie:'__Host-gold-admin='+owner}})).status,200);assert.equal((await f.request('/gold-almanac/california/',null,{headers:{Cookie:'__Host-gold-admin='+'f'.repeat(64)}})).status,403);
 const offline=await fixture(t,{offline:true});const r=await offline.request('/api/gold-almanac/california/',active);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private auth detail|almanac-note/);assert.equal(offline.lookups(),0);
});
test('Plus and donation pages describe only Almanac access, separate gifts and disable every payment entry point',async t=>{
 const f=await fixture(t);const html=await(await f.request('/plus/')).text();assert.match(html,/\$5/);assert.doesNotMatch(html,/PUBLIC EXCERPT|Almanac preview|California: the lay of the land/);assert.match(html,/Subscribe · \$5\/month/);assert.match(html,/disabled aria-describedby=/);assert.match(html,/renewing automatically until canceled/);assert.doesNotMatch(html,/Private Prospecting Journal|Advanced Trip Planner|alerts|weather conditions/);
 const donation=await(await f.request('/donate/')).text();assert.match(donation,/does not renew/);assert.match(donation,/does not unlock/);assert.match(donation,/disabled aria-describedby=/);
 for(const path of ['/billing/subscribe/','/billing/donate/','/billing/manage/','/billing/webhook/'])assert.equal((await f.request(path,null,{method:'POST',body:'amount=5&level=subscriber'})).status,503);
 assert.equal((await f.request('/api/gold-almanac/texas/',free)).status,403);
});
test('one shared promotion appears on static and dynamic sidebars, with idempotent rendering and no public-content paywall',async t=>{
 const f=await fixture(t);for(const path of ['/','/articles/','/glossary/','/products/','/gold-almanac/','/plus/','/donate/']){const r=await f.request(path);assert.equal(r.status,200,path);const html=await r.text();assert.equal((html.match(/data-plus-support/g)||[]).length,1,path);assert.equal(plusMarkup(html),html);assert.match(html,/plus\.css\?v=/);}
});
test('login retains a safe state-guide destination and rejects external return URLs',async t=>{
 const f=await fixture(t);const html=await(await f.request('/login/?next=%2Fgold-almanac%2Ftexas%2F')).text();assert.match(html,/name="next" value="\/gold-almanac\/texas\/"/);const filtered=await(await f.request('/login/?next=%2Fgold-almanac%2F%3Fcreator%3Dbill-southern')).text();assert.match(filtered,/name="next" value="\/gold-almanac\/\?creator=bill-southern"/);const unsafe=await(await f.request('/login/?next=https%3A%2F%2Fevil.test%2F')).text();assert.doesNotMatch(unsafe,/name="next"/);
});
