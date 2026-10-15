import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFileSync} from 'node:fs';
import {createServer} from '../app/server.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createAlmanacStore} from '../app/almanac/store.js';
import {states,content,validateContent,assembleState,stateBySlug,statesInCoverage,sourceVideoUrl} from '../app/almanac/model.js';
import {dashboard,almanacPage,historicMines,panningDestinations} from '../app/almanac/views.js';
import {stateBirds} from '../app/almanac/ornaments.js';

test('published research renders with citations, preserves legacy records and excludes held claims',()=>{
 const baseline=JSON.parse(readFileSync(new URL('./fixtures/almanac-content-before-research.json',import.meta.url),'utf8'));
 for(const previous of baseline.states){
  const current=content.states.find(s=>s.id===previous.id);
  for(const key of Object.keys(previous)){
   if(key==='facts')for(const fact of previous.facts)assert.deepEqual(current.facts.find(f=>f.id===fact.id),fact);
   else assert.deepEqual(current[key],previous[key],previous.id+':'+key);
  }
 }
 const claims=JSON.parse(readFileSync(new URL('./fixtures/almanac-research-review-status.json',import.meta.url),'utf8'));
 for(const state of states){
  const html=dashboard(assembleState(state));
  const anchors=new Set([...html.matchAll(/id="(source-[^"]+)"/g)].map(m=>m[1]));
  for(const link of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(anchors.has(link[1]),state.name+':'+link[1]);
  for(const note of content.states.find(s=>s.id===state.id).researchNotes||[]){
   const original=claims.find(c=>c.id===note.researchClaimId);
   assert.equal(original.evidenceStatus,'source_checked');assert.equal(original.publicationStatus,'editorial_review_required');
   assert.ok(html.includes('data-record-id="'+note.id+'"'));assert.ok(html.includes(note.title.replaceAll('&','&amp;')));
  }
  for(const held of claims.filter(c=>c.stateId===state.id&&(!['editorial_review_required'].includes(c.publicationStatus)||c.evidenceStatus!=='source_checked')))assert.ok(!html.includes('data-record-id="'+held.id+'"'),held.id);
 }
 assert.equal(content.states.flatMap(s=>s.researchNotes||[]).length,76);
 const ca=dashboard(assembleState(stateBySlug('california')));assert.match(ca,/106,130,214/);assert.match(ca,/1848–1965/);assert.match(ca,/historical estimates/);
 const pa=content.states.find(s=>s.id==='US-PA');assert.ok(!pa.facts.some(f=>f.value===37459));
 assert.match(dashboard(assembleState(stateBySlug('pennsylvania'))),/mine-specific historical figure/);
});

test('published research validation rejects unchecked notes, unknown categories and missing attribution',()=>{
 const fixture=()=>structuredClone(content);
 for(const mutate of [n=>n.status='held_draft',n=>n.category='invented',n=>n.researchClaimId='unreviewed',n=>n.title='']){
  const data=fixture();mutate(data.states.find(s=>s.researchNotes?.length).researchNotes[0]);assert.throws(()=>validateContent(data),/published research/);
 }
 const data=fixture();data.states.find(s=>s.researchNotes?.length).researchNotes[0].sourceIds=[];assert.throws(()=>validateContent(data),/Unattributed/);
});

test('all 50 states have distinct stable URLs, real outlines and readable names including insets',()=>{
 assert.equal(states.length,50);assert.equal(new Set(states.map(s=>s.slug)).size,50);assert.equal(new Set(states.map(s=>s.fips)).size,50);
 for(const s of states){assert.ok(s.path.startsWith('M'));assert.ok(s.path.endsWith('Z'));assert.ok(s.label.every(Number.isFinite));}
 assert.ok(stateBySlug('alaska'));assert.ok(stateBySlug('hawaii'));assert.equal(stateBySlug('district-of-columbia'),undefined);
 const html=almanacPage(assembleState(stateBySlug('california')));assert.equal((html.match(/data-state="/g)||[]).length,50);assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);assert.ok(html.indexOf('id="state-details"')>html.indexOf('</svg>'));assert.ok(!html.includes('<title>California</title>'));
});
test('all state headers show only their sourced bird once, without tree or other accent rows',()=>{
 assert.equal(stateBirds.length,50);
 for(const state of states){
  const html=dashboard(assembleState(state));
  const bird=stateBirds.find(b=>b.stateId===state.id),header=html.match(/<header class="almanac-state-heading">([\s\S]*?)<\/header>/)[1];
  const image='/assets/almanac/'+bird.asset+'.png';
  assert.ok(header.includes('class="almanac-state-bird"'),state.name);assert.ok(header.includes(image),state.name);
  assert.equal(html.split(image).length-1,1,state.name);assert.ok(!header.includes('<svg'),state.name);
  assert.ok(!html.includes('almanac-local-motifs'),state.name);
  assert.ok(!/\/assets\/almanac\/(?:pine|maple|lobster)\.png/.test(html),state.name);
  assert.ok(!html.includes('State tree'),state.name);
  assert.ok(existsSync(new URL('../dist/assets/almanac/'+bird.asset+'.png',import.meta.url)));
  assert.match(bird.source,/^https:\/\//);assert.ok(html.includes(bird.source.replaceAll('&','&amp;')));
 }
 const root=almanacPage({state:null});assert.ok(!root.includes('almanac-local-motifs'));assert.ok(!root.includes('aria-pressed="true"'));
});
test('statistics retain periods, units and provenance; unsourced values and broken relationships fail validation',()=>{
 assert.equal(content.states.find(s=>s.id==='US-NV').facts[0].value,3479748);
 const altered=()=>structuredClone(content);
 let x=altered();x.states[0].facts[0].sourceIds=[];assert.throws(()=>validateContent(x),/Unattributed/);
 x=altered();x.states[0].facts[0].unit='';assert.throws(()=>validateContent(x),/statistic/);
 x=altered();x.states[0].articleIds=['article:fictional'];assert.throws(()=>validateContent(x),/relationship/);
 x=altered();x.archives[0].url='javascript:alert(1)';assert.throws(()=>validateContent(x),/archival/);
 x=altered();x.states[0].facts[0].id=x.states[0].id;assert.throws(()=>validateContent(x),/Duplicate/);
});
test('sparse states never imply zero; California rush date is not asserted as first discovery',()=>{
 const empty=dashboard(assembleState(stateBySlug('delaware')));assert.ok(!empty.includes('Not yet researched'));assert.ok(!empty.includes('0 ounces'));assert.ok(!empty.includes('id="numbers"'));assert.match(empty,/A gold occurrence is not permission/);
 const california=dashboard(assembleState(stateBySlug('california')));assert.match(california,/not the state’s first discovery/);assert.match(california,/13,500/);assert.match(california,/not a count of active mines/);
 const nc=dashboard(assembleState(stateBySlug('north-carolina')));assert.match(nc,/Peter/);assert.match(nc,/enslaved/);
 assert.ok(content.archives.every(a=>a.author!=='Attribution not yet reviewed'&&a.year));
});
test('access guidance requires checked, attributed records and renders its own source bibliography',()=>{
 const fixture=structuredClone(content);const state=fixture.states.find(s=>s.id==='US-VT');
 state.accessNotes[0].sourceIds=[];assert.throws(()=>validateContent(fixture),/Unattributed/);
 const unchecked=structuredClone(content);unchecked.states.find(s=>s.id==='US-VT').accessNotes[0].status='reported_occurrence';assert.throws(()=>validateContent(unchecked),/access note/);
 const html=dashboard(assembleState(stateBySlug('vermont')));assert.match(html,/Buffalo Brook/);assert.match(html,/wildlife management areas/);assert.match(html,/id="source-vt-sluice-2023"/);
 const ct=dashboard(assembleState(stateBySlug('connecticut')));assert.match(ct,/not a count of gold mines/);assert.ok(!ct.includes('data-record-id="US-CT:historic-sites"'));
 const nh=dashboard(assembleState(stateBySlug('new-hampshire')));assert.match(nh,/original document needs recheck/);assert.ok(!nh.includes('data-record-id="US-NH:first-discovery"'));
});
test('historic gold records distinguish prospects and disputed results, retain uncertainty and credit location sources',()=>{
 const me=content.states.find(s=>s.id==='US-ME'),vt=content.states.find(s=>s.id==='US-VT'),nh=content.states.find(s=>s.id==='US-NH');
 assert.equal(me.mines.length,7);assert.equal(vt.mines.length,2);assert.equal(nh.mines.length,4);
 assert.ok(me.mines.some(m=>m.kind==='gold_prospect'));assert.ok(vt.mines.some(m=>m.kind==='disputed_gold_working'));
 for(const slug of ['maine','vermont','new-hampshire']){
  const html=dashboard(assembleState(stateBySlug(slug)));
  const ids=new Set([...html.matchAll(/id="(source-[^"]+)"/g)].map(m=>m[1]));
  for(const match of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(ids.has(match[1]),match[1]);
 }
 const html=dashboard(assembleState(stateBySlug('maine')));assert.equal((html.match(/data-mine-coordinate=/g)||[]).length,6);assert.match(html,/accuracy unknown/);assert.match(html,/100 metres/);assert.ok(!html.includes('data-record-id="US-ME:historic-sites"'));
 const unresolved=dashboard(assembleState(stateBySlug('new-hampshire')));assert.match(unresolved,/Unresolved — not plotted/);assert.ok(!unresolved.includes('data-mine-coordinate'));assert.ok(!unresolved.includes('data-mine-map-load'));
 assert.match(dashboard(assembleState(stateBySlug('new-york'))),/research gap, not proof/);
});
test('invented mine points, malformed coordinates and uncredited locations are rejected',()=>{
 let d=structuredClone(content);d.states.find(s=>s.id==='US-NH').mines[0].location.coordinates=[44,-71];assert.throws(()=>validateContent(d),/Unresolved/);
 for(const change of [l=>l.coordinates=[91,-72],l=>l.sourceId='fiction',l=>l.accuracyMeters=0,l=>l.datum='unknown',l=>l.coordinates=[43,'-72']]){
  d=structuredClone(content);change(d.states.find(s=>s.id==='US-VT').mines[0].location);assert.throws(()=>validateContent(d),/sourced mine coordinate/);
 }
 d=structuredClone(content);d.states.find(s=>s.id==='US-VT').mines[0].sourceIds=[];assert.throws(()=>validateContent(d),/sourced mine coordinate/);
 const fixture=structuredClone(content.states.find(s=>s.id==='US-VT').mines);fixture[0].title='<img src=x onerror=evil()>';
 const html=historicMines(fixture);assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
});
test('coverage does not expand vague regions, overlap state names, or revive blocked creators',()=>{
 assert.deepEqual(statesInCoverage('New England and western USA'),[]);assert.deepEqual(statesInCoverage('West Virginia, USA'),['US-WV']);
 assert.deepEqual(new Set(statesInCoverage('California and Nevada')),new Set(['US-CA','US-NV']));
 const me=stateBySlug('maine');assert.ok(assembleState(me).creators.some(c=>c.slug==='hip-bee-explorer'));
 assert.ok(!assembleState(me,{excludedSlugs:['hip-bee-explorer']},'connected').creators.some(c=>c.slug==='hip-bee-explorer'));
 assert.equal(assembleState(me,null,'unavailable').creators.length,0);
 assert.ok(assembleState(me).creators.every(c=>!c.url));assert.ok(assembleState(me,{creators:[],excludedSlugs:[]},'connected').creators.every(c=>c.url.startsWith('/prospectors/')));
});
test('timestamps require inspected footage and actual YouTube URLs; public text is escaped',()=>{
 assert.equal(sourceVideoUrl('javascript:evil()',20,'footage'),null);
 assert.match(sourceVideoUrl('https://www.youtube.com/watch?v=real',0,'footage'),/t=0s/);
 assert.ok(!sourceVideoUrl('https://www.youtube.com/watch?v=real',33,'title_description').includes('t='));
 assert.ok(!sourceVideoUrl('https://example.com/article',33,'footage').includes('t='));
 const state=assembleState(stateBySlug('maine'),{creators:[{slug:'real',display_name:'<script>bad()</script>',region_name:'Maine',relationship_type:'covers',source_url:'javascript:evil()'}]},'connected');
 const html=dashboard(state);assert.ok(!html.includes('<script>bad()'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;script&gt;/);
});
test('database projection uses published sources and explicit coverage, not residence or private fields',async()=>{
 const calls=[];const store=createAlmanacStore({query:async(sql,params)=>{calls.push({sql,params});return sql.includes('schema_migrations')?[{version:'005_creator_research'}]:[];}});
 const data=await store(stateBySlug('maine'));assert.deepEqual(data.creators,[]);
 const creators=calls.find(c=>c.sql.includes('person_regions'));assert.match(creators.sql,/relationship_type IN \('covers','teaches_in'\)/);assert.match(creators.sql,/JOIN source_references/);assert.match(creators.sql,/is_sample=0/);assert.match(creators.sql,/source_checked/);assert.deepEqual(creators.params,['Maine']);
 const water=calls.find(c=>c.sql.includes('creator_waterway_evidence'));assert.match(water.sql,/location_status='explicit'/);assert.match(water.sql,/resolution='verified'/);assert.deepEqual(water.params,['Maine']);
 const all=calls.map(c=>c.sql).join('\n');assert.ok(!/password|email|evidence_note|quotation_excerpt|private_notes/.test(all));assert.ok(!/\b(INSERT|UPDATE|DELETE)\b/.test(all));
});
async function serve(handler,run){const server=createServer({almanac:handler,log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(r=>server.close(r));}}
test('canonical routes, refresh, all-state API and section anchors preserve selection',async()=>{
 await serve(createAlmanacHandler({members:{session:async()=>({effective_level:'subscriber'})}}),async root=>{
  const response=await fetch(root+'/gold-almanac/?state=maine',{redirect:'manual'});assert.equal(response.status,308);assert.equal(response.headers.get('location'),'/gold-almanac/maine/');
  const html=await(await fetch(root+'/gold-almanac/maine/')).text();assert.match(html,/data-state-id="US-ME"/);assert.ok(!html.includes('id="almanac-state"'));assert.match(html,/data-state="maine" aria-label="Maine" aria-pressed="true"/);assert.match(html,/href="#historic-mines"/);assert.ok(!html.includes('href="#history"'));
  for(const s of states){const r=await fetch(root+'/api/gold-almanac/'+s.slug+'/');assert.equal(r.status,200);const data=await r.json();assert.equal(data.state.id,s.id);assert.equal(data.url,'/gold-almanac/'+s.slug+'/');assert.match(data.html,new RegExp('Gold in '+s.name));}
  assert.equal((await fetch(root+'/gold-almanac/imaginary/')).status,404);assert.equal((await fetch(root+'/api/gold-almanac/imaginary/')).status,404);
  assert.equal((await fetch(root+'/api/gold-almanac/maine/',{method:'POST'})).status,405);assert.equal(await(await fetch(root+'/gold-almanac/maine/',{method:'HEAD'})).text(),'');
 });
});
test('public connections cache by state; outages preserve sourced notes and never expose SQL diagnostics',async()=>{
 let calls=0;const fixture={creators:[{slug:'hip-bee-explorer',display_name:'Hip Bee Explorer',region_name:'Maine',relationship_type:'covers',source_url:'https://example.com/reference',checked_at:'2026-10-11'}],regions:[],waterways:[],resources:[],excludedSlugs:[]};
 await serve(createAlmanacHandler({members:{session:async()=>({effective_level:'subscriber'})},store:async state=>{calls++;if(state.code==='NV')throw new Error('private database password SQL');return fixture;}}),async root=>{
  for(let i=0;i<2;i++){const html=await(await fetch(root+'/gold-almanac/maine/')).text();assert.match(html,/href="\/prospectors\/hip-bee-explorer\/"/);assert.match(html,/Published database connections/);}assert.equal(calls,1);
  const html=await(await fetch(root+'/gold-almanac/nevada/')).text();assert.match(html,/3,479,748/);assert.match(html,/temporarily unavailable/);assert.ok(!html.includes('private database password'));assert.equal(calls,2);
 });
});

test('mine paper trails preserve per-note provenance and distinguish reviewed documents from catalog leads',()=>{
 const me=content.states.find(s=>s.id==='US-ME'),nh=content.states.find(s=>s.id==='US-NH');
 assert.ok([...me.mines,...nh.mines].every(m=>m.historyNotes.length&&m.researchNote));
 const golden=me.mines.find(m=>m.id.endsWith(':1475'));
 assert.match(golden.dates,/1880.*1881/);assert.match(golden.historyNotes.find(n=>n.id.endsWith(':1881')).text,/does not establish that the mill was built/);
 const silver=me.mines.find(m=>m.id.endsWith(':426'));assert.equal(silver.kind,'gold_prospect');assert.match(silver.historyNotes[0].text,/not an established opening date/);
 const html=dashboard(assembleState(stateBySlug('maine')));
 assert.match(html,/Follow the paper trail/);assert.match(html,/Catalog checked; original pages not yet inspected/);assert.match(html,/Source reviewed/);assert.match(html,/Still to establish/);
 const original=content.sources.find(s=>s.id==='me-emj-1880');assert.ok(html.includes(`href="${original.url}" target="_blank" rel="noopener noreferrer"`));
 for(const mine of [...me.mines,...nh.mines])for(const n of mine.historyNotes)assert.ok(n.sourceIds.every(id=>mine.sourceIds.includes(id)));
 const edits=[m=>m.historyNotes[0].sourceIds=['fiction'],m=>m.historyNotes[0].reviewedAt='',m=>m.historyNotes[0].id=m.id,m=>m.furtherReading[0].sourceId='fiction',m=>m.furtherReading[0].locator='',m=>m.furtherReading[0].inspection='assumed',m=>m.researchNote=42];
 for(const change of edits){const fixture=structuredClone(content);change(fixture.states.find(s=>s.id==='US-ME').mines[0]);assert.throws(()=>validateContent(fixture));}
 const catalog=structuredClone(content);catalog.states.find(s=>s.id==='US-ME').mines.find(m=>m.id.endsWith(':1681')).furtherReading[0].inspection='document_reviewed';assert.throws(()=>validateContent(catalog),/archival/);
 const unsafe=structuredClone(me.mines);unsafe[0].historyNotes[0].text='<script>evil()</script>';unsafe[0].researchNote='<img onerror=evil()> ';
 const escaped=historicMines(unsafe);assert.ok(!escaped.includes('<script>evil()'));assert.ok(!escaped.includes('<img'));assert.match(escaped,/&lt;script&gt;/);
 const nhHtml=dashboard(assembleState(stateBySlug('new-hampshire')));assert.match(nhHtml,/Godfrey Memorial/);assert.match(nhHtml,/have not been proven/);assert.ok(!nhHtml.includes('data-mine-coordinate'));
});

test('historical accounts preserve conflicting dates, separate similar mine names and do not invent map points',()=>{
 const vt=content.states.find(s=>s.id==='US-VT'),nh=content.states.find(s=>s.id==='US-NH'),me=content.states.find(s=>s.id==='US-ME');
 const rooks=vt.mines.find(m=>m.id==='US-VT:mine:rooks');
 assert.match(rooks.dates,/1887 or 1889/);assert.match(rooks.text,/Neither establishes uninterrupted/);
 assert.ok(rooks.historyNotes.some(n=>n.sourceIds.includes('vt-plymouth-smith')));
 const dodge=nh.mines.find(m=>m.id==='US-NH:mine:dodge');assert.match(dodge.dates,/summer-1915/);
 const tunnel=nh.mines.find(m=>m.id==='US-NH:mine:tunnel');assert.match(tunnel.text,/distinct historical working/);
 const dublin=nh.mines.find(m=>m.id==='US-NH:mine:dublin-diamond');assert.equal(dublin.kind,'disputed_gold_working');
 assert.ok(nh.mines.every(m=>m.location.precision==='unresolved'&&!m.location.coordinates));
 const pittston=me.mines.find(m=>m.id==='US-ME:mine:pittston');assert.equal(pittston.kind,'disputed_gold_working');assert.equal(pittston.location.precision,'unresolved');
 for(const slug of ['maine','vermont','new-hampshire']){
  const html=dashboard(assembleState(stateBySlug(slug))),ids=new Set([...html.matchAll(/id="(source-[^"]+)"/g)].map(m=>m[1]));
  for(const ref of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(ids.has(ref[1]),ref[1]);
 }
});

test('document links open the inspected PDF page and reject malformed page references',()=>{
 const vt=dashboard(assembleState(stateBySlug('vermont'))),me=dashboard(assembleState(stateBySlug('maine')));
 assert.ok(vt.includes('https://pubs.usgs.gov/bul/0225/report.pdf#page=87" target="_blank" rel="noopener noreferrer"'));
 assert.ok(me.includes('https://pubs.usgs.gov/bul/0225/report.pdf#page=85" target="_blank" rel="noopener noreferrer"'));
 for(const page of [0,-1,1.5,'87','87&evil=1',10001]){
  const data=structuredClone(content);data.states.find(s=>s.id==='US-VT').mines[0].furtherReading[0].page=page;
  assert.throws(()=>validateContent(data),/archival link/);
 }
 const catalog=structuredClone(content);catalog.states.find(s=>s.id==='US-ME').mines[0].furtherReading[0].page=1;
 assert.throws(()=>validateContent(catalog),/archival link/);
});

test('panning destinations require appropriate access evidence and attributed trip facts',()=>{
 const destinations=content.states.flatMap(s=>s.destinations||[]);assert.equal(destinations.length,6);
 assert.deepEqual(new Set(destinations.map(d=>d.kind)),new Set(['public_hand_panning','operator_river_access','supervised_practice']));
 const mutate=fn=>{const data=structuredClone(content);fn(data.states.find(s=>s.id==='US-VT').destinations[0],data);assert.throws(()=>validateContent(data),/destination|Unattributed|Duplicate/);};
 for(const change of [d=>d.permissionSourceId='maine-gold',d=>d.status='reported_occurrence',d=>d.coordinates=[43,-72],d=>d.tripFacts[0].sourceIds=['fiction'],d=>d.tripFacts.pop(),d=>d.tripFacts[1].key=d.tripFacts[0].key,d=>d.tripFacts[0].locator='',d=>d.articleIds=['article:fictional'],d=>d.beforeYouGo=[]])mutate(change);
 const undated=structuredClone(content);undated.states.find(s=>s.id==='US-VT').destinations[0].reviewedAt='';assert.throws(()=>validateContent(undated),/Review/);
 mutate((d,data)=>{data.sources.find(s=>s.id===d.permissionSourceId).authority='operator';});
 mutate(d=>d.id='US-VT');
});

test('destination planning keeps training separate from river access and resolves every source anchor',()=>{
 const me=dashboard(assembleState(stateBySlug('maine'))),nh=dashboard(assembleState(stateBySlug('new-hampshire'))),vt=dashboard(assembleState(stateBySlug('vermont')));
 assert.match(me,/Supervised practice program checked/);assert.match(me,/not evidence of natural river yields/);assert.match(me,/not a river-access pass/);
 assert.match(nh,/Operator day-pass access checked/);assert.match(nh,/confirm current state requirements before bringing a sluice/);assert.match(nh,/current panning-pass price was not published/);
 assert.match(vt,/Park hand-panning policy checked/);assert.match(vt,/does not establish off-season brook access/);assert.match(vt,/\$5 ages 14\+/);
 assert.equal((vt.match(/data-record-id="US-VT:camp-plymouth-buffalo"/g)||[]).length,1);
 for(const html of [me,nh,vt]){
  assert.ok(html.indexOf('id="destinations"')<html.indexOf('id="access"'));if(html.includes('id="numbers"'))assert.ok(html.indexOf('id="destinations"')<html.indexOf('id="numbers"'));
  const ids=new Set([...html.matchAll(/id="(source-[^"]+)"/g)].map(m=>m[1]));
  for(const ref of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(ids.has(ref[1]),ref[1]);
  assert.match(html,/<details class="almanac-trip-details"><summary>/);
 }
 const sparse=dashboard(assembleState(stateBySlug('delaware')));assert.ok(!sparse.includes('id="destinations"'));assert.ok(!sparse.includes('href="#destinations"'));
});

test('destination output escapes content, opens operator links separately and only links existing lessons',()=>{
 const data=assembleState(stateBySlug('maine')),items=structuredClone(data.record.destinations);
 items[0].title='<img src=x onerror=evil()>';items[0].tripFacts[0].text='<script>evil()</script>';items[0].beforeYouGo=['<img src=x>'];
 const html=panningDestinations(items,data.articles);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>evil()'));assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;/);
 assert.match(html,/https:\/\/cooscanyonrockandgift.com\/gold-prospecting" target="_blank" rel="noopener noreferrer"/);
 for(const ref of html.matchAll(/href="(\/articles\/[^\"]+)"/g))assert.ok(data.articles.some(a=>a.url===ref[1]));
});

test('government-run practice has scoped authority and destination lessons must be visible',()=>{
 const nc=content.states.find(s=>s.id==='US-NC').destinations[0];
 assert.equal(nc.kind,'supervised_practice');assert.equal(content.sources.find(s=>s.id===nc.permissionSourceId).authority,'land_manager');
 assert.doesNotThrow(()=>validateContent(structuredClone(content)));
 const practiceAsRiver=structuredClone(content);practiceAsRiver.states.find(s=>s.id==='US-NC').destinations[0].kind='operator_river_access';assert.throws(()=>validateContent(practiceAsRiver),/destination access/);
 const operatorAsPublic=structuredClone(content);operatorAsPublic.states.find(s=>s.id==='US-GA').destinations[0].kind='public_hand_panning';assert.throws(()=>validateContent(operatorAsPublic),/destination access/);
 const hiddenLesson=structuredClone(content);hiddenLesson.states.find(s=>s.id==='US-NC').articleIds=[];assert.throws(()=>validateContent(hiddenLesson),/destination preparation/);
});

test('expanded panning visits retain price and seasonal qualifications and correct visitor links',()=>{
 const htmls=['california','north-carolina','georgia'].map(slug=>dashboard(assembleState(stateBySlug(slug))));
 const [ca,nc,ga]=htmls;
 assert.match(ca,/Park hand-panning policy checked/);assert.match(ca,/hands and pan only/);assert.match(ca,/\$10/);assert.match(ca,/\$12 per person/);assert.match(ca,/differing closing times/);
 assert.match(nc,/Supervised practice program checked/);assert.match(nc,/Site visitor information/);assert.ok(!nc.includes('Operator activity information'));assert.match(nc,/\$5 plus tax/);assert.match(nc,/Call before a winter visit/);assert.match(nc,/does not grant access/);
 assert.match(ga,/Operator activity information/);assert.match(ga,/Panning-only starts at \$60/);assert.match(ga,/\$24.95/);assert.match(ga,/Indoor panning/);assert.match(ga,/Cherokee Nation/);
 for(const html of htmls){
  assert.equal((html.match(/class="almanac-destination"/g)||[]).length,1);
  const ids=new Set([...html.matchAll(/id="(source-[^"]+)"/g)].map(m=>m[1]));for(const ref of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(ids.has(ref[1]),ref[1]);
  for(const link of html.matchAll(/<a href="https:[^"]+"([^>]+)>/g)){assert.match(link[1],/target="_blank"/);assert.match(link[1],/rel="noopener noreferrer"/);}
 }
});

test('discovery records distinguish reported events from authenticated finds and require inspected sources',()=>{
 const altered=()=>structuredClone(content),get=d=>d.states.find(s=>s.id==='US-GA');
 for(const change of [r=>r.discovery.sourceIds=[],r=>r.discovery.basis='first_known_to_humans',r=>r.discovery.dateText='',r=>r.discovery.status='draft',r=>r.discovery.reviewedAt='not-a-date']){
  const d=altered();change(get(d));assert.throws(()=>validateContent(d));
 }
 const d=altered(),r=get(d);r.discovery.sourceIds=[d.sources[0].id];d.sources[0].inspectionBasis='catalog_metadata';assert.throws(()=>validateContent(d),/discovery/);
 const nc=content.states.find(s=>s.id==='US-NC');get(d).discovery.sourceIds=['ga-dlg-gold-history'];get(d).facts.push({...nc.facts[0],id:'US-GA:duplicate-first',scope:'US-GA'});assert.throws(()=>validateContent(d),/discovery/);
 const ga=dashboard(assembleState(stateBySlug('georgia')));assert.match(ga,/August 1, 1829/);assert.match(ga,/remain unsettled/);assert.match(ga,/id="source-ga-dlg-gold-history"/);
 const nm=dashboard(assembleState(stateBySlug('new-mexico')));assert.match(nm,/1600s/);assert.match(nm,/not substituted/);
 const ca=dashboard(assembleState(stateBySlug('california')));assert.match(ca,/March 9, 1842/);assert.match(ca,/First authenticated discovery/);assert.match(ca,/January 24, 1848/);
 for(const state of content.states.filter(s=>s.discovery)){
  const html=dashboard(assembleState(states.find(s=>s.id===state.id)));
  for(const sourceId of state.discovery.sourceIds)assert.ok(html.includes(`id="source-${sourceId}"`),sourceId);
 }
});


test('all state guides omit empty fields and sections while preserving supported facts and navigation',()=>{
 for(const state of states){
  const data=assembleState(state),html=dashboard(data),record=data.record;
  assert.ok(!html.includes('almanac-missing'),state.name);
  assert.ok(!html.includes('Not yet researched'),state.name);
  assert.ok(!html.includes('almanac-pending'),state.name);assert.ok(!html.includes('almanac-picker'),state.name);assert.ok(!html.includes('Choose state'),state.name);
  assert.equal(html.includes('id="numbers"'),Boolean(record.discovery||record.facts.length),state.name);
  assert.equal(html.includes('id="creators"'),Boolean(data.creators.length),state.name);
  assert.equal(html.includes('id="history"'),Boolean(record.history.length||data.archives.length),state.name);
  for(const link of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${link[1]}"`),state.name+': '+link[1]);
  for(const fact of record.facts)assert.ok(html.includes(`data-record-id="${fact.id}"`),fact.id);
 }
 const tx=content.states.find(s=>s.id==='US-TX'),html=dashboard(assembleState(stateBySlug('texas')));
 assert.equal(tx.facts.find(f=>f.key==='historical-production').value,8277);
 assert.equal(tx.facts.find(f=>f.key==='historic-sites').value,37);
 assert.match(html,/through 1942/);assert.match(html,/not unique mines/);assert.match(html,/Sandy Creek drainage/);
 assert.ok(!tx.discovery);assert.ok(!tx.facts.some(f=>['first-discovery','annual-production','active-operations'].includes(f.key)));
 assert.ok(!html.includes('Current gold operations'));assert.ok(!html.includes('Recent annual production'));
});


test('the main Almanac opens with no selected state and no database lookup',async()=>{
 let lookups=0;
 await serve(createAlmanacHandler({members:{session:async()=>({effective_level:'subscriber'})},store:async()=>{lookups++;return {};}}),async root=>{
  const response=await fetch(root+'/gold-almanac/',{redirect:'manual'});assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);
  const html=await response.text();assert.equal((html.match(/data-state="/g)||[]).length,50);assert.ok(!html.includes('aria-pressed="true"'));assert.ok(!html.includes('almanac-picker'));assert.ok(!html.includes('id="state-heading"'));assert.match(html,/data-state-id="" hidden/);assert.match(html,/Selected: <strong id="selected-state">None/);assert.equal(lookups,0);const fresh=await fetch(root+'/gold-almanac/?view=map');assert.equal(fresh.status,200);assert.ok(!(await fresh.text()).includes('aria-pressed="true"'));
  const bare=await fetch(root+'/gold-almanac',{redirect:'manual'});assert.equal(bare.status,308);assert.equal(bare.headers.get('location'),'/gold-almanac/');
 });
});
