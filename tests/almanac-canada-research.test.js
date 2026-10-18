import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from '../app/server.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createGuestPlusAccess} from '../app/plus/guest-access.js';
import {canadianContent,canadianRegionBySlug,assembleCanada} from '../app/almanac/canada.js';
import {unifiedCreatorRecords} from '../app/almanac/creators.js';
import {dashboard} from '../app/almanac/views.js';

test('Canadian guides publish only documented facts, preserve scope and keep every citation reachable',()=>{
 const research=JSON.parse(readFileSync(new URL('../docs/research/canada-almanac-2026-10-18/research.json',import.meta.url)));
 assert.equal(canadianContent.regions.length,13);
 for(const r of canadianContent.regions){
  const original=research.regions.find(p=>p.iso===r.id),published=[r.overview,...r.researchNotes];
  const html=dashboard(assembleCanada(canadianRegionBySlug(r.slug)));
  for(const c of published){const evidence=original.claims.find(e=>e.id===c.id);assert.equal(evidence.classification,'documented');assert.equal(evidence.status,'source_checked');assert.equal(c.text,evidence.text);assert.ok(html.includes(c.id));}
  for(const c of original.claims.filter(c=>c.classification!=='documented'))assert.ok(!html.includes('data-record-id="'+c.id+'"'));
  for(const link of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(html.includes('id="'+link[1]+'"'),r.slug+':'+link[1]);
  for(const statistic of r.statistics){assert.deepEqual(statistic,original.statistics.find(s=>s.id===statistic.id));assert.match(html,/Production in context/);}
  assert.doesNotMatch(html,/undefined|Invalid Date|\/connections\/states\//);
 }
 const pe=dashboard(assembleCanada(canadianRegionBySlug('prince-edward-island')));assert.doesNotMatch(pe,/id="numbers"|Typical gold size|Gold potential|first discovery/i);
});

test('Canadian guide creator links reuse public canonical profiles and include Vancouver Island in BC',()=>{
 const records=unifiedCreatorRecords({people:[],regions:[],topics:[]});
 const data=assembleCanada(canadianRegionBySlug('british-columbia'),{available:true,records});
 for(const slug of ['dan-hurd','pioneer-pauly','crux-prospecting'])assert.ok(data.creators.some(c=>c.slug===slug&&c.url==='/prospectors/'+slug+'/'));
 assert.ok(!data.creators.some(c=>c.slug==='nick-molnar'));
 const html=dashboard(data);assert.match(html,/Pioneer Pauly/);assert.doesNotMatch(html,/Not documented|undefined/);
});

test('all 13 Canadian HTML/API guides require Plus or an active Friends pass and skip the U.S. database store',async t=>{
 const paid='a'.repeat(64),guest='c'.repeat(64),now=Date.parse('2026-10-18T12:00:00Z');let clock=now,storeCalls=0;
 const guests=createGuestPlusAccess({passes:[{id:'canada-research-test',tokenHash:createHash('sha256').update(guest).digest('hex'),expiresAt:new Date(now+86400000).toISOString()}],now:()=>clock});
 const members={session:async raw=>({effective_level:raw===paid?'subscriber':'free'})};
 const records=unifiedCreatorRecords({people:[],regions:[],topics:[]});
 const almanac=createAlmanacHandler({members,guests,store:async()=>{storeCalls++;throw new Error('U.S. only');},creators:async()=>({available:true,records})});
 const server=createServer({almanac,guests,memberSessions:members,goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const request=(url,cookie='')=>fetch(base+url,{headers:cookie?{Cookie:cookie}:{},redirect:'manual'});
 for(const r of canadianContent.regions){
  for(const prefix of ['/gold-almanac/','/api/gold-almanac/']){
   const url=prefix+r.slug+'/';const locked=await request(url);assert.equal(locked.status,403);assert.ok(!(await locked.text()).includes(r.overview.text));
   const free=await request(url,'__Host-gold-member='+('b'.repeat(64)));assert.equal(free.status,403);
   for(const cookie of ['__Host-gold-member='+paid,'__Host-gold-plus-guest='+guest]){
    const response=await request(url,cookie);assert.equal(response.status,200,r.slug);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie');
    if(prefix.includes('/api/')){const json=await response.json();assert.equal(json.state.id,r.id);assert.equal(json.url,'/gold-almanac/'+r.slug+'/');assert.match(json.html,new RegExp('Gold in '+r.name));}
    else {const html=await response.text();assert.match(html,/13 Canadian provinces and territories/);assert.ok(html.includes('data-state-id="'+r.id+'"'));assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);}
   }
  }
 }
 assert.equal(storeCalls,0,'Canadian IDs never reach U.S.-specific database queries');
 assert.equal((await request('/gold-almanac/?state=yukon')).headers.get('location'),'/gold-almanac/yukon/');
 clock+=86400000;assert.equal((await request('/api/gold-almanac/yukon/','__Host-gold-plus-guest='+guest)).status,403);
 assert.equal((await request('/api/gold-almanac/yukon/','__Host-gold-member='+paid)).status,200);
 assert.equal((await request('/api/gold-almanac/atlantis/','__Host-gold-member='+paid)).status,404);
});
