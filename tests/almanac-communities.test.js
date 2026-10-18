import test from 'node:test';
import assert from 'node:assert/strict';
import {communityCatalog} from '../app/community-catalog.js';
import {communitiesForState} from '../app/almanac/communities.js';
import {assembleState,states,stateBySlug} from '../app/almanac/model.js';
import {dashboard,stateCommunities} from '../app/almanac/views.js';
import {escapeHtml} from '../app/directory-views.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createServer} from '../app/server.js';

const active='7'.repeat(64),free='8'.repeat(64);
const ids=entries=>entries.map(entry=>entry.id);
const california=stateBySlug('california');
const expectedCounts={Arizona:5,California:8,Colorado:3,Georgia:2,Idaho:2,Massachusetts:1,Missouri:1,Montana:1,Nevada:2,'New Mexico':1,'New York':1,'North Carolina':1,Ohio:1,Oregon:3,'South Dakota':1,Texas:1,Virginia:1,Washington:5};

test('all 50 state projections reuse catalog records, with exact local coverage and no duplicates or mutations',()=>{
 const original=JSON.stringify(communityCatalog);
 const all=[];
 assert.equal(states.length,50);
 for(const state of states){
  const entries=communitiesForState(state);
  assert.equal(entries.length,expectedCounts[state.name]||0,state.name);
  assert.equal(new Set(ids(entries)).size,entries.length,state.name+' has no duplicate records');
  assert.deepEqual(ids(assembleState(state).communities),ids(entries),state.name+' is included in the Almanac projection');
  for(const entry of entries){
   assert.equal(entry,communityCatalog.entries.find(item=>item.id===entry.id),'original catalog record '+entry.id);
   assert.equal(entry.status,'listed');
   assert.ok(entry.region.split(/\s*&\s*/).includes(state.name),entry.id+' has explicit state coverage');
  }
  for(let index=1;index<entries.length;index++)assert.ok(entries[index-1].name.localeCompare(entries[index].name,'en',{sensitivity:'base'})<=0,state.name+' is alphabetical');
  all.push(...entries);
 }
 assert.equal(all.length,40,'39 existing local listings create 40 state relationships');
 assert.equal(new Set(ids(all)).size,39);
 assert.equal(JSON.stringify(communityCatalog),original,'mapping does not rewrite, duplicate or reorder the public catalog');
});

test('combined Oregon/Washington coverage is shared, while Virginia and broad or foreign regions never leak into other states',()=>{
 const combined='or-northwest-mineral-prospectors-club';
 assert.ok(ids(communitiesForState(stateBySlug('oregon'))).includes(combined));
 assert.ok(ids(communitiesForState(stateBySlug('washington'))).includes(combined));
 assert.ok(!ids(communitiesForState(california)).includes(combined));
 assert.deepEqual(ids(communitiesForState(stateBySlug('virginia'))),['va-central-virginia-gold-prospectors']);
 assert.deepEqual(communitiesForState(stateBySlug('west-virginia')),[]);
 const projected=new Set(states.flatMap(state=>ids(communitiesForState(state))));
 for(const entry of communityCatalog.entries.filter(entry=>/nationwide|worldwide|historical|Australia/.test(entry.region)))assert.ok(!projected.has(entry.id),entry.id+' is not a state-local listing');
});

test('state rendering preserves public links, original dates and access notes, without unrelated state listings',()=>{
 const html=dashboard(assembleState(california));
 assert.match(html,/id="communities"/);
 assert.match(html,/Clubs &amp; groups in California/);
 assert.match(html,/href="#communities"/);
 const entries=communitiesForState(california);
 for(const entry of entries){
  assert.match(html,new RegExp('data-record-id="community:'+entry.id+'"'));
  assert.ok(html.includes(escapeHtml(entry.name)),entry.name);
  assert.ok(html.includes(escapeHtml(entry.location)),entry.id+' location');
  assert.ok(html.includes(escapeHtml(entry.summary)),entry.id+' summary');
  assert.ok(html.includes(escapeHtml(entry.accessNote)),entry.id+' original access note');
  assert.ok(html.includes(entry.checkedAt),entry.id+' original check date');
  assert.ok(html.includes('href="/clubs-groups/#'+entry.id+'"'),entry.id+' public directory permalink');
  for(const link of entry.links){
   const anchor=[...html.matchAll(/<a\b[^>]*>/g)].map(match=>match[0]).find(anchor=>anchor.includes('href="'+escapeHtml(link.url)+'"'));
   assert.ok(anchor,entry.id+' original outbound URL');
   assert.match(anchor,/target="_blank"/);
   assert.match(anchor,/rel="noopener noreferrer"/);
  }
 }
 assert.equal((html.match(/data-record-id="community:/g)||[]).length,entries.length);
 assert.doesNotMatch(html,/data-record-id="community:western-washington"/);
});

test('states without a checked listing retain an honest directory route without implying that no clubs exist',()=>{
 const html=stateCommunities(stateBySlug('west-virginia'),[]);
 assert.match(html,/Clubs &amp; groups in West Virginia/);
 assert.match(html,/listing/i);
 assert.match(html,/yet|not.*(?:listed|listing|checked)|don.t have/i);
 assert.match(html,/href="\/clubs-groups\//);
 assert.doesNotMatch(html,/no clubs (?:exist|in)|no groups (?:exist|in)|there are no (?:clubs|groups)/i);
 assert.doesNotMatch(html,/data-record-id="community:/);
});

test('state community content is escaped and unsafe supplied outbound URLs are rejected',()=>{
 const entry=structuredClone(communityCatalog.entries[0]);
 entry.name='<img src=x onerror=alert(1)>';
 entry.location='"location" & <location>';
 entry.summary='<script>summary()</script>';
 entry.accessNote='<script>access()</script>';
 entry.links=[{label:'<script>link()</script>',url:'javascript:alert(1)',platform:'Website'}];
 const html=stateCommunities({...california,name:'<script>state()</script>'},[entry]);
 for(const value of [entry.name,entry.location,entry.summary,entry.accessNote])assert.ok(html.includes(escapeHtml(value)),value+' is escaped');
 assert.match(html,/&lt;script&gt;state\(\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>|<img src=x|href="javascript:/);
});

async function fixture(t){
 let lookups=0;
 const sessions=new Map([[active,{effective_level:'subscriber'}],[free,{effective_level:'free'}]]);
 const almanac=createAlmanacHandler({members:{session:async token=>sessions.get(token)||null},store:async()=>{lookups++;return{};}});
 const server=createServer({almanac,goldPrice:async()=>({}),log:()=>{}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path,token=null)=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',headers:token?{Cookie:'__Host-gold-member='+token}:{}});
 return{request,lookups:()=>lookups};
}

test('public club listings remain free, while state HTML/API require active Plus even after the state cache is warm',async t=>{
 const f=await fixture(t);
 for(const token of [null,free]){
  const response=await f.request('/clubs-groups/',token);
  assert.equal(response.status,200,'public directory '+(token?'free member':'anonymous'));
  const html=await response.text();
  assert.match(html,/Au Mojave Prospectors/);
  assert.match(html,/id="western-washington"/);
 }
 let response=await f.request('/gold-almanac/california/',active);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('vary'),'Cookie');
 assert.match(await response.text(),/data-record-id="community:au-mojave"/);
 response=await f.request('/api/gold-almanac/california/',active);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.match(body.html,/data-record-id="community:au-mojave"/);
 assert.doesNotMatch(body.html,/data-record-id="community:western-washington"/);
 assert.equal(f.lookups(),1,'HTML and API share the state cache');
 for(const token of [null,free])for(const path of ['/gold-almanac/california/','/api/gold-almanac/california/']){
  response=await f.request(path,token);
  assert.equal(response.status,403,path+' '+(token?'free member':'anonymous'));
  assert.doesNotMatch(await response.text(),/data-record-id="community:|Au Mojave Prospectors/);
 }
 assert.equal(f.lookups(),1,'denied requests never load cached state research');
});
