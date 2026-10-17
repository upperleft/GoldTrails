import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from '../app/server.js';
import {videoLibraryFor,videoLibraryBody,validateVideoLibrary} from '../app/creator-video-library.js';
import {creatorYoutubeDestination} from '../app/creator-channel-links.js';
const data=JSON.parse(readFileSync(new URL('../app/creator-video-library.json',import.meta.url))),evidence=JSON.parse(readFileSync(new URL('../database/map-data/creator-video-expansion-2026-10-17.json',import.meta.url)));
test('all added videos have an uploader and individually connected primary metadata evidence; original libraries are intact',()=>{
 assert.doesNotThrow(()=>validateVideoLibrary(data));assert.equal(evidence.addedCreators,44);assert.equal(evidence.addedVideos,129);
 const addedSlugs=new Set(evidence.libraries.map(r=>r.slug)),old=data.creators.filter(c=>!addedSlugs.has(c.slug));
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),evidence.preservedLibrariesSha256);
 for(const source of evidence.libraries){const library=videoLibraryFor(source.slug);assert.equal(library.channelId,source.channelId);assert.equal(library.uploaderName,source.channelTitle);assert.equal(library.checkedAt,'2026-10-17');for(const v of library.videos){const fact=source.selectedVideos.find(x=>x.id===v.id);assert.ok(fact,v.id);assert.equal(fact.title,v.title);assert.equal(fact.channelId,v.channelId);assert.ok(fact.metadataSource.startsWith('https://www.youtube.com/'));}}
 assert.equal(videoLibraryFor('dan-hurd').checkedAt,'2026-10-12');assert.match(videoLibraryBody(videoLibraryFor('gold-cube')),/Channel ownership checked 2026-10-17/);
});
test('uncertain rebrands and unrelated uploads do not produce new video libraries',()=>{
 for(const slug of ['michigan-prospectors','rookie-gold-prospector','al-gold-prospecting','out-bush-gold-hunter']){assert.equal(videoLibraryFor(slug),null);assert.ok(evidence.gaps.some(g=>g.slug===slug));}
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
