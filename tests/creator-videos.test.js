import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from '../app/server.js';
import {validateVideoLibrary,videoLibraryFor,videoLibraryCount,videoLibraryLink,videoLibraryCards,videoLibraryBody} from '../app/creator-video-library.js';

const catalog=JSON.parse(readFileSync(new URL('../app/creator-catalog.json',import.meta.url),'utf8'));
const libraryData=JSON.parse(readFileSync(new URL('../app/creator-video-library.json',import.meta.url),'utf8'));
const channelId='UC'+'A'.repeat(22);
const fixture=()=>({version:1,checkedAt:'2026-10-12',creators:[{slug:'test-creator',name:'Test creator',channelId,channelUrl:'https://www.youtube.com/channel/'+channelId,videos:[{id:'Abcd_123-XY',title:'A panning lesson',url:'https://www.youtube.com/watch?v=Abcd_123-XY',channelId,ownershipStatus:'source_checked',checkedAt:'2026-10-12',subject:'Beginner panning',tags:['panning']}]}]});
const picked=()=>{
  const creator=libraryData.creators.find(c=>c.slug==='dan-hurd')||libraryData.creators[0];
  assert.ok(creator,'The checked video catalog must be populated before running these tests.');
  return creator;
};

test('video metadata rejects spoofed owners, unsafe destinations and duplicate identities',()=>{
  assert.doesNotThrow(()=>validateVideoLibrary(fixture()));
  const invalid=[
    data=>{data.creators[0].videos[0].channelId='UC'+'B'.repeat(22);},
    data=>{data.creators[0].videos[0].url='https://www.youtube.com.evil.example/watch?v=Abcd_123-XY';},
    data=>{data.creators[0].videos[0].url='javascript:alert(1)';},
    data=>{data.creators[0].channelUrl='https://www.youtube.com/@unverified-alias';},
    data=>{data.creators[0].channelId='not-a-channel-id';},
    data=>{data.creators[0].videos[0].id='../not-safe';},
    data=>{data.creators[0].videos[0].ownershipStatus='Needs content review';},
    data=>{data.creators[0].videos[0].checkedAt=null;},
    data=>{data.creators[0].videos.push(structuredClone(data.creators[0].videos[0]));},
    data=>{data.creators.push(structuredClone(data.creators[0]));},
    data=>{data.creators.push({...structuredClone(data.creators[0]),slug:'other-creator'});},
    data=>{data.creators[0].slug='../../private';},
    data=>{data.creators[0].name={private:'field'};},
    data=>{data.creators[0].videos[0].title={private:'field'};},
    data=>{data.creators[0].videos[0].subject={private:'field'};},
    data=>{data.creators[0].videos[0].tags=[{private:'field'}];},
  ];
  for(const mutate of invalid){const data=fixture();mutate(data);assert.throws(()=>validateVideoLibrary(data),String(mutate));}
});

test('the shipped library contains roster matches and public link metadata without unreviewed research fields',()=>{
  assert.equal(libraryData.creators.length,17);
  assert.equal(libraryData.creators.reduce((count,c)=>count+c.videos.length,0),97);
  const roster=new Set(catalog.map(c=>c.slug));
  const forbidden=['description_excerpt','research_notes','published_label_or_date','views_at_scan','duration_minutes','region','discovery_method','transcript_verified','claim_verified','originalRecord','private_notes','reviewer_note'];
  for(const creator of libraryData.creators){
    assert.ok(roster.has(creator.slug),creator.slug+' must match an existing creator profile');
    assert.ok(creator.videos.length>0);
    const publicLibrary=videoLibraryFor(creator.slug);
    for(const field of forbidden){assert.ok(!Object.hasOwn(publicLibrary,field),field);for(const video of publicLibrary.videos)assert.ok(!Object.hasOwn(video,field),field);}
    for(const video of publicLibrary.videos){assert.equal(video.ownershipStatus,'source_checked');assert.equal(video.channelId,creator.channelId);}
  }
  assert.doesNotThrow(()=>validateVideoLibrary(libraryData));
});

test('library lookups do not let callers mutate the shared catalog and missing creators have no button',()=>{
  const creator=picked(),original=videoLibraryFor(creator.slug);
  const changed=videoLibraryFor(creator.slug);changed.videos[0].title='Changed by caller';changed.videos.length=0;
  assert.deepEqual(videoLibraryFor(creator.slug),original);
  assert.equal(videoLibraryCount(creator.slug),original.videos.length);
  assert.equal(videoLibraryFor('missing-creator'),null);
  assert.equal(videoLibraryCount('missing-creator'),0);
  assert.equal(videoLibraryLink('missing-creator','Missing'), '');
  const link=videoLibraryLink(creator.slug,'Name <script> & "quoted"');
  assert.match(link,/aria-haspopup="dialog"/);
  assert.ok(link.includes('/prospectors/'+creator.slug+'/videos/'));
  assert.ok(link.includes('Name &lt;script&gt; &amp; &quot;quoted&quot;'));
  assert.ok(!link.includes('<script>'));
});

test('video cards escape metadata and provide safe new-tab links plus channel and content context',()=>{
  const creator=fixture().creators[0];
  creator.videos[0].title='</script><img src=x onerror=alert(1)> & a lesson';
  creator.videos[0].subject='Topic <svg onload=alert(1)>';
  const cards=videoLibraryCards(creator),body=videoLibraryBody(creator);
  assert.ok(cards.includes('&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt; &amp; a lesson'));
  assert.ok(cards.includes('Topic &lt;svg onload=alert(1)&gt;'));
  assert.ok(!cards.includes('<img src=x'));
  assert.ok(!cards.includes('<svg'));
  assert.match(cards,/href="https:\/\/www\.youtube\.com\/watch\?v=Abcd_123-XY" target="_blank" rel="noopener noreferrer"/);
  assert.match(cards,/loading="lazy"/);
  assert.match(body,/data-video-search/);assert.match(body,/data-video-topic/);assert.match(body,/data-video-sort/);
  assert.match(body,/video content has not been independently reviewed/);
  assert.match(body,/Browse the full channel/);
  assert.match(body,/aria-live="polite"/);
});

async function withServer(directory,fn){
  const server=createServer({directory,almanac:async()=>false,log:()=>{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}

test('public video API and HTML fallback share checked metadata, navigation and empty HEAD responses',async()=>{
  const creator=picked();
  const privateProfile={slug:creator.slug,display_name:creator.name,id:'private-profile-id',reviewer_note:'Private retained research'};
  await withServer({profile:async slug=>slug===creator.slug?privateProfile:null,catalogAllowed:async()=>false},async base=>{
    const api=await fetch(`${base}/api/prospectors/${creator.slug}/videos/`);
    assert.equal(api.status,200);assert.match(api.headers.get('content-type'),/application\/json/);assert.equal(api.headers.get('x-content-type-options'),'nosniff');
    const publicLibrary=await api.json();assert.deepEqual(publicLibrary,videoLibraryFor(creator.slug));
    assert.match(publicLibrary.checkedAt,/^\d{4}-\d{2}-\d{2}$/);
    const detail=await fetch(`${base}/prospectors/${creator.slug}/videos/`),html=await detail.text();
    assert.equal(detail.status,200);assert.match(html,/data-video-page/);assert.ok(html.includes('/prospectors/'+creator.slug+'/'));
    assert.match(html,/creator-videos\.js\?v=/);assert.match(html,/creator-videos\.css\?v=/);
    const embedded=html.match(/<script id="creator-video-page-data" type="application\/json">([\s\S]*?)<\/script>/);
    assert.ok(embedded,'The full-page fallback must contain filter data');assert.ok(!embedded[1].includes('<'));assert.deepEqual(JSON.parse(embedded[1]),publicLibrary);
    assert.ok(!html.includes('private-profile-id'));assert.ok(!html.includes('Private retained research'));
    for(const prefix of ['/api','']){const head=await fetch(`${base}${prefix}/prospectors/${creator.slug}/videos/`,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');}
    const redirect=await fetch(`${base}/prospectors/${creator.slug}/videos?q=gold`,{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),`/prospectors/${creator.slug}/videos/?q=gold`);
    for(const prefix of ['/api','']){const post=await fetch(`${base}${prefix}/prospectors/${creator.slug}/videos/`,{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');}
  });
});

test('roster fallback works only when allowed and never overrides draft, excluded or archived profiles',async()=>{
  const creator=picked(),paths=[`/api/prospectors/${creator.slug}/videos/`,`/prospectors/${creator.slug}/videos/`];
  for(const [directory,status] of [
    [{profile:async()=>null,catalogAllowed:async()=>true},200],
    [{profile:async()=>null,catalogAllowed:async()=>false},404],
    [{profile:async()=>null},404],
    [{profile:async()=>({archived:true,display_name:'Private archived name'}),catalogAllowed:async()=>true},410],
  ])await withServer(directory,async base=>{for(const path of paths){const response=await fetch(base+path);assert.equal(response.status,status);if(status!==200){const body=await response.text();assert.ok(!body.includes(creator.videos[0].id));assert.ok(!body.includes('Private archived name'));}}});
});

test('missing libraries, invalid slugs and outages stay private and do not serve invented videos',async()=>{
  const creator=picked(),withoutVideos=catalog.find(c=>!videoLibraryCount(c.slug));
  assert.ok(withoutVideos);
  let lookups=0;
  await withServer({profile:async()=>{lookups++;return null;},catalogAllowed:async()=>true},async base=>{
    for(const prefix of ['/api',''])for(const slug of [withoutVideos.slug,'missing-creator','Bad-Slug','%3Cscript%3E','a'.repeat(161)]){
      const response=await fetch(`${base}${prefix}/prospectors/${slug}/videos/`);assert.equal(response.status,404);assert.ok(!(await response.text()).includes(creator.videos[0].id));
    }
  });
  assert.equal(lookups,0,'Unavailable libraries must stop before requesting profile data');
  for(const directory of [null,{profile:async()=>{throw new Error('password=secret host=private');}},{profile:async()=>null,catalogAllowed:async()=>{throw new Error('password=secret');}}]){
    await withServer(directory,async base=>{for(const prefix of ['/api','']){const response=await fetch(`${base}${prefix}/prospectors/${creator.slug}/videos/`);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret'));const head=await fetch(`${base}${prefix}/prospectors/${creator.slug}/videos/`,{method:'HEAD'});assert.equal(head.status,503);assert.equal(await head.text(),'');}});
  }
});
