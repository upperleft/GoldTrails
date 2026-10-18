import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {creatorCatalog,mergeCatalog} from '../app/creator-catalog.js';
import {planCatalog,channelKey,CatalogConflict} from '../app/catalog-import.js';
import {createServer} from '../app/server.js';
import {unifiedCreatorRecords} from '../app/almanac/creators.js';
import {mapRecords} from '../app/creator-map.js';
import {matchesCreator} from '../dist/prospectors-data.js';

const root=new URL('../research/creator-discovery/2026-10-16/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const baseline=read('baseline.json'),additions=read('new-creators.json'),manifest=read('manifest.json');
const canadaReview=JSON.parse(readFileSync(new URL('../docs/research/canadian-creator-locations-2026-10-18.json',import.meta.url),'utf8'));
const canadianAdditions=new Set(canadaReview.creators.filter(c=>c.verification?.videos?.length).map(c=>c.slug));
const regionalFields=['region','region_source','region_checked_at','region_type'];

test('discovery import accounts for every submitted record and preserves all existing research',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('original.json',root))).digest('hex'),manifest.source_sha256);
 const crosswalk=read('crosswalk.json'),leads=read('lead-crosswalk.json');
 assert.equal(crosswalk.length,27);assert.equal(leads.length,15);
 assert.equal(crosswalk.filter(r=>r.decision==='add').length,14);
 assert.equal(crosswalk.filter(r=>r.decision==='preserve_existing').length,12);
 assert.equal(crosswalk.filter(r=>r.decision==='hold_identity_conflict').length,1);
 assert.equal(leads.filter(r=>r.decision==='preserve_existing').length,4);
 const catalog=creatorCatalog(),previous=catalog.filter(p=>!canadianAdditions.has(p.slug));assert.equal(previous.length,baseline.catalog.length+14);assert.equal(catalog.length,previous.length+canadianAdditions.size);
 for(const old of baseline.catalog){
  const current=catalog.find(p=>p.slug===old.slug),historical=structuredClone(current),review=canadaReview.creators.find(p=>p.slug===old.slug);
  if(review){
   assert.ok([old.region,review.region].includes(current.region),old.slug+' retains its original region label or the dated reviewed refinement');assert.equal(current.region_type,review.region_type);assert.equal(current.region_checked_at,canadaReview.checked_at);
   const sourceUrls=review.source_ids.map(id=>canadaReview.sources.find(s=>s.id===id)?.url);assert.ok(sourceUrls.includes(current.region_source),old.slug+' region source is retained in the review');
   for(const key of regionalFields){if(Object.hasOwn(old,key))historical[key]=old[key];else delete historical[key];}
  }
  assert.deepEqual(historical,old,old.slug+' preserves its original research apart from explicitly reviewed regional fields');
 }
 for(const row of additions){assert.deepEqual(catalog.find(p=>p.slug===row.slug),row);assert.equal(new URL(row.official_url).pathname,'/channel/'+row.youtube_channel_id);assert.ok(row.biography.every(f=>f.source_url&&f.verified_at==='2026-10-16'));}
 assert.equal(new Set(additions.map(r=>r.youtube_channel_id)).size,14);
 assert.ok(!catalog.some(p=>p.youtube_channel_id==='UC0fuMC2COaYUWyl1jZM6DuA'));
});

test('full roster remains importable and reviewed channel aliases prevent duplicate ownership',()=>{
 const catalog=creatorCatalog(),previous=catalog.filter(p=>!canadianAdditions.has(p.slug));
 assert.equal(planCatalog(previous,[],[]).add,baseline.catalog.length+additions.length);
 assert.equal(planCatalog(catalog,[],[]).add,catalog.length);
 const row=additions.find(p=>p.slug==='gold-putz');
 assert.equal(planCatalog([row],[],[{canonical_url:'https://m.youtube.com/@GOLDPUTZ/videos',archived_at:'2026-10-01'}]).conflicts,1);
 assert.equal(planCatalog([row],[{slug:row.slug,archived_at:'2026-10-01'}],[]).preserve,1);
 assert.equal(planCatalog(additions,additions.map(p=>({slug:p.slug})),[]).add,0);
 assert.notEqual(channelKey('https://youtube.com/channel/UCAbcdefghijklmnopqrstuv'),channelKey('https://youtube.com/channel/UCabcdefghijklmnopqrstuv'));
 assert.throws(()=>planCatalog([{...row,slug:'second',official_url:'https://youtube.com/@goldputz'},row],[],[]),CatalogConflict);
 assert.throws(()=>planCatalog([{...row,channel_aliases:['javascript:alert(1)']}],[],[]),CatalogConflict);
});

test('renamed channels remain searchable and geographic discovery preserves international and unknown coverage',()=>{
 const merged=mergeCatalog({people:[],regions:[],topics:[]}),records=mapRecords(merged.people,merged.regions,merged.topics);
 for(const[slug,q]of[['jprad-prospecting','J & S Prospecting'],['out-bush-gold-hunter','Gold Prospecting Out Bush with Marky'],['shaneoz-gold-rush',"Shan'Oz GOLD RUSH"]])assert.ok(matchesCreator(records.find(p=>p.slug===slug),{q}),q);
 const unified=unifiedCreatorRecords({people:[],regions:[],topics:[]});assert.ok(unified.find(p=>p.slug==='jprad-prospecting').mapPoint);
 for(const slug of ['shaneoz-gold-rush','petes-gold-adventures','out-bush-gold-hunter','nuggethunting','colorado-gold-camp'])assert.equal(unified.find(p=>p.slug===slug).mapPoint,null,slug);
});

test('every imported profile and YouTube link is public while raw research remains private',async t=>{
 const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
 const server=createServer({directory,goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 for(const row of additions){const response=await fetch(base+'/prospectors/'+row.slug+'/');assert.equal(response.status,200,row.slug);const html=await response.text();assert.ok(html.includes(row.official_url),row.slug);assert.match(html,/Watch on YouTube/);assert.ok(html.includes(row.biography[0].source_url));}
 assert.equal((await fetch(base+'/research/creator-discovery/2026-10-16/original.json')).status,404);
 assert.equal((await fetch(base+'/api/gold-almanac/creators/')).status,403);
});
