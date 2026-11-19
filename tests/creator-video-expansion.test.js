import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from '../app/server.js';
import {videoLibraryFor,videoLibraryBody,validateVideoLibrary} from '../app/creator-video-library.js';
import {creatorYoutubeDestination} from '../app/creator-channel-links.js';
const data=JSON.parse(readFileSync(new URL('../app/creator-video-library.json',import.meta.url))),evidence=JSON.parse(readFileSync(new URL('../database/map-data/creator-video-expansion-2026-10-17.json',import.meta.url)));
// Keep the original 17-library hash scoped to those identities as later,
// independently sourced additions are imported into the same public library.
const originalSlugs=new Set(['ask-jeff-williams','busted-knuckles-prospecting','chris-ralph','dan-hurd','dave-mccracken','flour-gold-wizards','gold-hog','hip-bee-explorer','internal-compass-of-nc','klesh','miller-prospecting','misha-boylan','pioneer-pauly','sluice-goose','the-sluicers','two-toes','vo-gus-prospecting']);
const originalEvidence=JSON.parse(readFileSync(new URL('../database/map-data/creator-video-library-inspection-2026-10-12.json',import.meta.url)));
const originalIds=new Set(originalEvidence.videos.map(v=>v.id));
const discoveryRoot=new URL('../research/creator-discovery/',import.meta.url);
const metadata=readdirSync(discoveryRoot,{withFileTypes:true}).filter(d=>d.isDirectory()).flatMap(d=>{
 const path=new URL(d.name+'/metadata-provenance.json',discoveryRoot);
 return existsSync(path)?JSON.parse(readFileSync(path,'utf8')).videos:[];
});
function assertCheckedDate(library,originalDate){
 assert.ok(library.checkedAt>=originalDate,library.slug+' retains its dated ownership check');
 const raw=data.creators.find(c=>c.slug===library.slug);
 if(!Object.hasOwn(raw,'checkedAt')){
  // The public projection falls back to the whole-catalog date for historical
  // rows. Individual original video checks are protected by the hash below.
  assert.equal(library.checkedAt,data.checkedAt);return;
 }
 if(library.checkedAt!==originalDate)assert.ok(library.videos.some(v=>metadata.some(m=>m.id===v.id&&m.title===v.title&&m.channelId===library.channelId&&m.checkedAt===library.checkedAt)),library.slug+' later ownership check has matching primary metadata provenance');
}
test('all added videos have an uploader and individually connected primary metadata evidence; original libraries are intact',()=>{
 assert.doesNotThrow(()=>validateVideoLibrary(data));assert.equal(evidence.addedCreators,44);assert.equal(evidence.addedVideos,129);
 const old=data.creators.filter(c=>originalSlugs.has(c.slug)).map(c=>{
  assertCheckedDate(videoLibraryFor(c.slug),originalEvidence.checkedAt);
  // Hash exactly the immutable original selection, including its title, browse
  // fields and individual check dates, apart from the sourced library recheck.
  const historical={...c,videos:c.videos.filter(v=>originalIds.has(v.id))};delete historical.checkedAt;return historical;
 });assert.equal(old.length,evidence.previousLibraryCreators);
 assert.equal(old.reduce((count,c)=>count+c.videos.length,0),originalEvidence.counts.publishedSelection);
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),evidence.preservedLibrariesSha256);
 for(const source of evidence.libraries){const library=videoLibraryFor(source.slug);assert.equal(library.channelId,source.channelId);assert.equal(library.uploaderName,source.channelTitle);assertCheckedDate(library,evidence.checkedAt);for(const fact of source.selectedVideos){const v=library.videos.find(x=>x.id===fact.id);assert.ok(v,fact.id);assert.equal(fact.title,v.title);assert.equal(fact.channelId,v.channelId);assert.ok(fact.metadataSource.startsWith('https://www.youtube.com/'));}}
 assertCheckedDate(videoLibraryFor('dan-hurd'),originalEvidence.checkedAt);assert.match(videoLibraryBody(videoLibraryFor('gold-cube')),/Channel ownership checked 2026-10-17/);
});
test('historically uncertain rebrands require individual source evidence before gaining video libraries',()=>{
 for(const slug of ['michigan-prospectors','rookie-gold-prospector','al-gold-prospecting','out-bush-gold-hunter']){
  assert.ok(evidence.gaps.some(g=>g.slug===slug));const library=videoLibraryFor(slug);
  if(library)for(const video of library.videos){
   assert.ok(metadata.some(m=>m.id===video.id&&m.title===video.title&&m.channelId===library.channelId&&m.checkedAt===video.checkedAt),slug+' cannot resolve a historical identity gap without exact current metadata');
   assert.equal(video.channelId,library.channelId);assert.equal(video.ownershipStatus,'source_checked');
  }
 }
 for(const slug of ['glacial-gold-hunter','flash-in-your-pan','gold-cube','goldbay','golden-submarine','lxr-postal-prospecting'])assert.equal(creatorYoutubeDestination({slug}).isChannel,true);
});
test('new creator libraries and profile video buttons stay public without a paid membership',async t=>{
 const server=createServer({directory:{profile:async()=>null,catalogAllowed:async()=>true},goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 for(const slug of ['utmost-outdoors','ghost-town-living','gold-cube','glacial-gold-hunter']){
  const profile=await fetch(base+'/prospectors/'+slug+'/');assert.equal(profile.status,200);assert.match(await profile.text(),/data-video-library/);
  const response=await fetch(base+'/api/prospectors/'+slug+'/videos/');assert.equal(response.status,200);const library=await response.json();assert.ok(library.videos.length);assert.equal(library.channelId,videoLibraryFor(slug).channelId);
 }
});
