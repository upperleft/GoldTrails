import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorYoutubeDestination,creatorYoutubeLink,youtubeDestination} from '../app/creator-channel-links.js';
import {catalogProfile,creatorCatalog} from '../app/creator-catalog.js';
import {videoLibraryFor} from '../app/creator-video-library.js';

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
test('six new checked channels are shown prominently without replacing existing research',()=>{
 for(const slug of ['bill-southern','x4prospecting','rob-parsons','outback-gold-fever','mbmmllc','michigan-prospectors']){
  const p=creatorCatalog().find(p=>p.slug===slug),link=creatorYoutubeDestination(p),html=catalogProfile(p);
  assert.equal(link.isChannel,true,slug);assert.ok(html.includes('class="gold-button small creator-youtube-link"'),slug);
  assert.ok(html.includes(link.url),slug);assert.ok(html.includes(p.official_url),slug);
  assert.match(creatorYoutubeLink(p),/target="_blank" rel="noopener noreferrer"/);
 }
});
test('prominent links distinguish source videos from channels and preserve all 84 profiles',()=>{
 const roster=creatorCatalog();assert.equal(roster.length,84);
 assert.equal(roster.filter(p=>creatorYoutubeDestination(p)).length,75);
 assert.match(creatorYoutubeLink({official_url:'https://www.youtube.com/watch?v=Abcd_123-XY'}),/Related video on YouTube/);
 for(const p of roster.filter(p=>creatorYoutubeDestination(p)))assert.ok(catalogProfile(p).includes('creator-youtube-link'));
});
