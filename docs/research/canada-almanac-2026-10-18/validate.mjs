import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const data=read('research.json'),catalog=read('sources.json'),rubric=read('report-card-rubric.json');
const map=JSON.parse(fs.readFileSync(path.join(root,'app/almanac/canada-provinces.json'),'utf8'));
const checks=[];
function check(name,fn){fn();checks.push(name);}
const ids=new Set();
function unique(id){assert.equal(typeof id,'string');assert(id.length>0);assert(!ids.has(id),`Duplicate identifier: ${id}`);ids.add(id);}
const sources=new Map(catalog.sources.map(s=>[s.id,s]));
const categories=['geology','production','seasons','access','minerals','discoveries','resources'];
const dimensions=['goldPotential','publicAccessibility','beginnerFriendliness','typicalGoldSize','overallOpportunity'];
check('Exactly 10 provinces and 3 territories matching canonical map IDs and slugs',()=>{
assert.equal(data.regions.length,13);assert.equal(data.regions.filter(r=>r.type==='province').length,10);assert.equal(data.regions.filter(r=>r.type==='territory').length,3);
assert.deepEqual(data.regions.map(r=>r.id).sort(),map.map(r=>r.slug).sort());
for(const r of data.regions)assert.equal(r.iso,map.find(m=>m.slug===r.id).id);
});
check('All sources have unique IDs, descriptive titles, HTTPS URLs and inspected evidence scope',()=>{
for(const s of catalog.sources){unique(s.id);assert(s.title&&s.publisher&&s.scope&&s.inspection);assert.equal(new URL(s.url).protocol,'https:');assert.equal(s.checkedAt,data.checkedAt);assert(s.publicationDate===null||/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(s.publicationDate));}
assert.equal(sources.size,catalog.sources.length);
});
check('Every claim has a valid source, locator, category, date and evidence classification',()=>{
for(const r of data.regions){unique(r.id);for(const c of r.claims){unique(c.id);assert(categories.includes(c.category));assert(c.text&&c.locator);assert.equal(c.reviewedAt,data.checkedAt);assert(c.sourceIds.length>0);for(const id of c.sourceIds)assert(sources.has(id),`Unknown source ${id}`);assert(['documented','evidence_scope','planning_interpretation'].includes(c.classification));assert(['source_checked','editorial_review_required'].includes(c.status));if(c.classification==='planning_interpretation')assert.equal(c.status,'editorial_review_required');}}
});
check('All 7 categories accounted for without orphan claims or silently discarded gaps',()=>{
for(const r of data.regions){assert.deepEqual(Object.keys(r.categories).sort(),categories.toSorted());
const localClaims=new Map(r.claims.map(c=>[c.id,c]));const localGaps=new Map(r.gaps.map(g=>[g.id,g]));
for(const g of r.gaps){unique(g.id);assert(['open','partly_resolved'].includes(g.status));assert(categories.includes(g.category));if(g.status==='partly_resolved')assert(g.resolution);}
const seenClaims=new Set(),seenGaps=new Set();
for(const [cat,value] of Object.entries(r.categories)){assert(value.claimIds.length+value.gapIds.length>0);for(const id of value.claimIds){assert.equal(localClaims.get(id)?.category,cat);assert(!seenClaims.has(id));seenClaims.add(id);}for(const id of value.gapIds){assert.equal(localGaps.get(id)?.category,cat);assert(!seenGaps.has(id));seenGaps.add(id);}}
assert.equal(seenClaims.size,r.claims.length);assert.equal(seenGaps.size,r.gaps.length);
}
});
check('Statistics retain units, period, geographic scope, qualifiers and production fact links',()=>{
for(const r of data.regions)for(const s of r.statistics){unique(s.id);assert(Number.isFinite(s.value)&&s.value>0);assert(s.unit&&s.period&&s.geographicScope&&s.definition&&s.qualifier&&s.locator);assert.equal(s.checkedAt,data.checkedAt);const c=r.claims.find(c=>c.id===s.claimId);assert(c&&c.category==='production');assert.deepEqual(s.sourceIds,c.sourceIds);}
});
check('All five ratings deliberately null; five complete rubric levels; unknowns never zero',()=>{
assert.equal(rubric.status,'defined_not_scored');for(const k of dimensions){assert(rubric.dimensions[k]);assert.deepEqual(Object.keys(rubric.dimensions[k].scale),['1','2','3','4','5']);assert(rubric.dimensions[k].withholdIf);}
for(const r of data.regions){assert.equal(r.ratings.status,'withheld');assert(r.ratings.reason);for(const k of dimensions)assert.equal(r.ratings[k],null);}
});
check('Conflicts preserve unresolved candidates without claiming verified sources',()=>{
for(const c of data.conflicts){unique(c.id);assert(data.regions.some(r=>r.id===c.regionId));assert(c.issue&&c.treatment);for(const s of c.sourceIds)assert(sources.has(s));for(const u of c.candidateUrls??[])assert.equal(new URL(u).protocol,'https:');}
});
check('Research remains unpublished and shared seasonal guidance remains interpretation',()=>{
assert.equal(data.publicationStatus,'research_only_not_imported_or_deployed');assert(data.regions.every(r=>r.websiteImportStatus==='not_imported'));assert.equal(data.sharedSeasonMethod.classification,'planning_interpretation');for(const s of data.sharedSeasonMethod.sourceIds)assert(sources.has(s));
});
check('Every source is used by a fact, conflict or shared method',()=>{
const used=new Set([...data.regions.flatMap(r=>r.claims.flatMap(c=>c.sourceIds)),...data.conflicts.flatMap(c=>c.sourceIds),...data.sharedSeasonMethod.sourceIds]);for(const id of sources.keys())assert(used.has(id),`Orphan source: ${id}`);
});
const report={status:'passed',checkedAt:data.checkedAt,checks,counts:{jurisdictions:data.regions.length,sourceRecords:sources.size,findingsAndNotes:data.regions.flatMap(r=>r.claims).length,productionStatistics:data.regions.flatMap(r=>r.statistics).length,openGaps:data.regions.flatMap(r=>r.gaps).filter(g=>g.status==='open').length,partlyResolvedGaps:data.regions.flatMap(r=>r.gaps).filter(g=>g.status==='partly_resolved').length,conflictsAndExclusions:data.conflicts.length},limits:'Structural validation only; not independent factual peer review, a live interactive map test, or site-specific access approval.'};
fs.writeFileSync(path.join(dir,'validation-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
