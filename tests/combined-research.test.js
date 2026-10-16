import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{content,validateContent,stateBySlug,assembleState}from'../app/almanac/model.js';
import{panningDestinations,dashboard}from'../app/almanac/views.js';
import{communityCatalog}from'../app/community-catalog.js';
import{renderCommunitiesPage}from'../app/communities-page.js';
const read=name=>JSON.parse(readFileSync(new URL('../research/combined-archive/2026-10-15/'+name,import.meta.url),'utf8'));
const baseline=read('baseline.json'),manifest=read('manifest.json'),crosswalk=read('crosswalk.json');
test('research snapshot and full record crosswalk preserve provenance without counting the social index twice',()=>{
 const raw=readFileSync(new URL('../research/combined-archive/2026-10-15/original.json',import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.archiveSha256);
 assert.equal(raw.length,manifest.archiveBytes);assert.equal(crosswalk.records.length,221);assert.equal(new Set(crosswalk.records.map(r=>r.archivePath)).size,221);
 assert.equal(crosswalk.records.filter(r=>r.status==='selected_checked_fields').length,45);assert.equal(crosswalk.records.filter(r=>r.status==='existing_entry_preserved').length,9);assert.equal(crosswalk.records.filter(r=>r.status==='held_for_reverification').length,167);
 const gaps=read('research-gaps.json');assert.equal(gaps.unconfirmedLeads.destinations.length,50);assert.equal(gaps.unconfirmedLeads.community.length,33);assert.equal(read('source-database.json').observations.length,296);
});
test('all previous state research, sources and community entries survive the archive import unchanged',()=>{
 for(const old of baseline.almanac.states){const current=content.states.find(s=>s.id===old.id);assert.ok(current);for(const[key,value]of Object.entries(old)){if(key==='destinations'){for(const d of value)assert.deepEqual(current.destinations.find(n=>n.id===d.id),d);}else assert.deepEqual(current[key],value,old.id+' '+key);}}
 for(const old of baseline.almanac.sources)assert.deepEqual(content.sources.find(s=>s.id===old.id),old);
 assert.deepEqual(content.archives,baseline.almanac.archives);
 for(const old of baseline.community.entries)assert.deepEqual(communityCatalog.entries.find(e=>e.id===old.id),old);
});
test('selected public fields resolve archive records and dated permission citations; unselected details stay internal',()=>{
 const archive=read('original.json');
 for(const r of crosswalk.records.filter(r=>r.status==='selected_checked_fields')){
  const record=r.id.startsWith('destination')?content.states.flatMap(s=>s.destinations||[]).find(d=>d.id===r.targetId):communityCatalog.entries.find(e=>e.id===r.targetId);
  assert.equal(record.researchProvenance.archiveSha256,manifest.archiveSha256);assert.equal(record.researchProvenance.recordPath,r.archivePath);assert.equal(r.verifiedAt,'2026-10-15');
  assert.equal(record.conflicts,undefined);assert.equal(record.unresolvedQuestions,undefined);
  assert.ok(r.sourceObservationIds.length);
 }
 const wpma=communityCatalog.entries.find(e=>e.name==='Washington Prospectors Mining Association');assert.match(wpma.accessNote,/membership notices/);
 assert.ok(!communityCatalog.entries.some(e=>e.name==='Hi Desert Gold Diggers'));
 const quartz=content.states.flatMap(s=>s.destinations||[]).find(d=>d.id==='US-OR:archive-2');assert.equal(quartz.tripFacts.find(f=>f.key==='fees').text.includes('day-use'),true);
 const cache=content.states.flatMap(s=>s.destinations||[]).find(d=>d.id==='US-CO:archive-0');assert.ok(!cache.tripFacts.some(f=>f.key==='fees'));assert.ok(cache.tripFacts.find(f=>f.key==='entry').sourceIds.includes('combined-archive-cache-creek-map'));
 const html=panningDestinations([cache],[]);assert.match(html,/Land-manager visitor information/);assert.match(html,/Visit notes/);assert.doesNotMatch(html,/<dt>Fees|opening dates/);
 const clubs=renderCommunitiesPage();assert.match(clubs,/<time datetime="2026-10-13">October 13, 2026<\/time>/);assert.match(clubs,/<time datetime="2026-10-15">October 15, 2026<\/time>/);
 for(const state of content.states.filter(s=>(s.destinations||[]).some(d=>d.researchProvenance))){const html=dashboard(assembleState(stateBySlug(state.id==='US-CO'?'colorado':state.id==='US-CA'?'california':state.id==='US-OR'?'oregon':state.id==='US-ID'?'idaho':'alaska')));for(const ref of html.matchAll(/href="#(source-[^"]+)"/g))assert.ok(html.includes('id="'+ref[1]+'"'));}
});
test('optional trip facts cannot remove core permission fields or weaken source validation',()=>{
 for(const mutate of [d=>d.tripFacts=d.tripFacts.filter(f=>f.key!=='entry'),d=>d.tripFacts.push(d.tripFacts[0]),d=>d.tripFactsScope='anything',d=>d.tripFacts[0].sourceIds=['unknown-source'],d=>d.tripFacts[0].key='invented',d=>d.permissionSourceId='maine-gold']){
  const copy=structuredClone(content),d=copy.states.flatMap(s=>s.destinations||[]).find(d=>d.id==='US-CO:archive-0');mutate(d);assert.throws(()=>validateContent(copy));
 }
});
