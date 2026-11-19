import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {creatorYoutubeDestination,creatorYoutubeLink,youtubeDestination} from '../app/creator-channel-links.js';
import {catalogProfile,creatorCatalog} from '../app/creator-catalog.js';
import {videoLibraryFor} from '../app/creator-video-library.js';
const canadaReview=JSON.parse(readFileSync(new URL('../docs/research/canadian-creator-locations-2026-10-18.json',import.meta.url),'utf8'));
const canadianAdditions=new Set(canadaReview.creators.filter(c=>c.verification?.videos?.length).map(c=>c.slug));
const discoveryBaseline=JSON.parse(readFileSync(new URL('../research/creator-discovery/2026-10-16/baseline.json',import.meta.url),'utf8'));
const discoveryAdditions=JSON.parse(readFileSync(new URL('../research/creator-discovery/2026-10-16/new-creators.json',import.meta.url),'utf8'));
const originalProfiles=[...discoveryBaseline.catalog,...discoveryAdditions];

test('YouTube links reject unsafe, unrelated and incomplete destinations',()=>{
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.example/@name','https://user:pass@youtube.com/@name','https://youtube.com:123/@name','https://youtube.com/results?search_query=gold','https://youtu.be/not-valid'])assert.equal(youtubeDestination(url),null,url);
 assert.equal(creatorYoutubeLink({slug:'unknown'}),'');
 assert.equal(youtubeDestination('https://www.youtube.com/watch?v=Abcd_123-XY').isChannel,false);
});
test('published database channels take precedence over supplemental and curated links',()=>{
 const url='https://www.youtube.com/@PublishedChannel';
 assert.equal(creatorYoutubeDestination({slug:'bill-southern',channels:[{canonical_url:url}]}).url,url);
 assert.equal(creatorYoutubeDestination({slug:'dan-hurd'}).url,videoLibraryFor('dan-hurd').channelUrl);
 assert.equal(creatorYoutubeDestination({official_url:'https://youtu.be/Abcd_123-XY'}).isChannel,false);
});
test('a verified successor replaces only the exact retired channel URL',()=>{
 const slug='adventure-gold';
 const retired='https://www.youtube.com/user/19andrew72/';
 const current='https://www.youtube.com/channel/UC9Agr2fHbCNmu3Fjx9umPkQ';
 const independentlyPublished='https://www.youtube.com/@AnotherReviewedChannel';
 assert.equal(creatorYoutubeDestination({slug,channels:[{canonical_url:retired}]}).url,current);
 assert.equal(creatorYoutubeDestination({slug,videoUrl:retired,channels:[{canonical_url:independentlyPublished}]}).url,independentlyPublished);
});

test('six new checked channels are shown prominently without replacing existing research',()=>{
 for(const slug of ['bill-southern','x4prospecting','rob-parsons','outback-gold-fever','mbmmllc','michigan-prospectors']){
  const p=creatorCatalog().find(p=>p.slug===slug),link=creatorYoutubeDestination(p),html=catalogProfile(p);
  assert.equal(link.isChannel,true,slug);assert.ok(html.includes('class="gold-button small creator-youtube-link"'),slug);
  assert.ok(html.includes(link.url),slug);assert.ok(html.includes(p.official_url),slug);
  assert.match(creatorYoutubeLink(p),/target="_blank" rel="noopener noreferrer"/);
 }
});
test('prominent links distinguish source videos from channels and preserve the original 84 profiles alongside Canadian additions',()=>{
 const roster=creatorCatalog(),previous=originalProfiles.map(old=>roster.find(p=>p.slug===old.slug));
 assert.equal(previous.filter(Boolean).length,originalProfiles.length);
 for(const old of originalProfiles)assert.equal(previous.find(p=>p.slug===old.slug).official_url,old.official_url,old.slug+' retains its original source');
 // The historical 79 links remain available; verified later evidence may also
 // resolve one of the previously unlinked historical profiles.
 assert.ok(previous.filter(p=>creatorYoutubeDestination(p)).length>=79);
 for(const slug of canadianAdditions)assert.equal(creatorYoutubeDestination(roster.find(p=>p.slug===slug)).isChannel,true,slug);
 assert.match(creatorYoutubeLink({official_url:'https://www.youtube.com/watch?v=Abcd_123-XY'}),/Related video on YouTube/);
 for(const p of roster.filter(p=>creatorYoutubeDestination(p)))assert.ok(catalogProfile(p).includes('creator-youtube-link'));
});
