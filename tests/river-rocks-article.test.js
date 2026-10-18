import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {createServer} from '../app/server.js';
import {publishedArticles} from '../app/compass/content.js';

const route='/articles/identifying-river-rocks/';
const title='Identifying River Rocks by Color, Pattern, and Density';
const dist=new URL('../dist/',import.meta.url);
const html=readFileSync(new URL('.'+route+'index.html',dist),'utf8');
const article=html.match(/<article\b[\s\S]*?<\/article>/)?.[0]||'';
const listing=readFileSync(new URL('articles/index.html',dist),'utf8');
const manifest=JSON.parse(readFileSync(new URL('assets/articles/river-rocks/credits.json',dist),'utf8'));
const materials=['Granite','Diorite','Basalt','Sandstone','Limestone','Gneiss','Mica schist','Quartzite','Marble','Quartz','Chert','Greenstone'];
const plain=value=>String(value).replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const escaped=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const attribute=(tag,name)=>tag.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1];
const anchors=value=>[...value.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)].map(m=>({attrs:m[1],href:attribute(m[1],'href'),label:plain(m[2])}));
const section=id=>article.match(new RegExp('<section id="'+id+'"[^>]*>([\\s\\S]*?)<\\/section>'))?.[1]||'';

// These checks protect the visual evidence and its per-image permissions, not just file existence.
test('river-rock photographs cover every requested material with individual reusable provenance',async()=>{
 assert.equal(manifest.checkedTimezone,'America/New_York');
 assert.deepEqual([...new Set(manifest.images.map(p=>p.material))].sort(),[...materials].sort());
 assert.equal(new Set(manifest.images.map(p=>p.id)).size,manifest.images.length);
 const figures=[...article.matchAll(/<figure\b[^>]*data-material="([^"]+)"[^>]*>[\s\S]*?<\/figure>/g)];
 assert.equal(figures.length,manifest.images.length);
 assert.ok(manifest.images.length>=materials.length);
 assert.equal(figures.filter(m=>m[1]==='Limestone').length,2,'The two limestone appearances remain separately identified');
 for(const photo of manifest.images){
  assert.match(photo.sourceUrl,/^https:\/\//,photo.id);assert.match(photo.directSourceUrl,/^https:\/\//,photo.id);
  assert.match(photo.license,/CC0|Public domain/i,photo.id);assert.match(photo.licenseUrl,/^https:\/\//,photo.id);
  assert.ok(photo.licenseEvidence.length>70,photo.id+' retains image-specific rights evidence');
  assert.ok(photo.credit.length>5&&photo.context.length>20,photo.id+' retains author and specimen context');
  assert.equal(photo.checkedAt,manifest.checkedAt,photo.id);
  for(const [url,width,height,hash]of [[photo.src,photo.width,photo.height,photo.sha256],[photo.thumb,photo.thumbWidth,photo.thumbHeight,photo.thumbSha256]]){
   assert.match(url,/^\/assets\/articles\/river-rocks\/[a-z0-9-]+\.(?:jpg|webp)$/);
   assert.ok(!url.includes('..'));
   const bytes=readFileSync(new URL('.'+url,dist)),metadata=await sharp(bytes).metadata();
   assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,photo.id+' asset matches its rights record');
   assert.deepEqual([metadata.width,metadata.height],[width,height],photo.id+' declared dimensions match the image');
   assert.ok(bytes.length>1000&&width>100&&height>100,photo.id+' is an actual usable image');
  }
  assert.ok(photo.width<=1400&&photo.thumbWidth<=560,photo.id+' optimized without large page thumbnails');
 }
});

test('each enlargement is beside its identified rock with useful alt text, caption, credit and fallback link',()=>{
 for(const photo of manifest.images){
  const rock=section(photo.material.toLowerCase().replace(/ /g,'-'));
  assert.ok(rock.includes('id="photo-'+photo.id+'"'),photo.material+' has its own nearby explanation and photograph');
  const figure=[...rock.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)].map(m=>m[0]).find(f=>f.includes('id="photo-'+photo.id+'"'));
  assert.ok(figure,photo.id);
  assert.ok(figure.includes('data-material="'+escaped(photo.material)+'"'));
  assert.ok(figure.includes('href="'+photo.src+'"'));
  assert.match(figure,/data-article-photo\b/);assert.match(figure,/aria-haspopup="dialog"/);
  assert.match(figure,/target="_blank" rel="noopener noreferrer"/);
  const img=figure.match(/<img\b[^>]+>/)?.[0]||'';
  assert.equal(attribute(img,'src'),photo.thumb);assert.equal(attribute(img,'alt'),escaped(photo.alt));
  assert.equal(Number(attribute(img,'width')),photo.thumbWidth);assert.equal(Number(attribute(img,'height')),photo.thumbHeight);
  assert.match(img,/loading="lazy"/);assert.match(img,/decoding="async"/);
  assert.ok(photo.alt.length>40&&photo.caption.length>60);
  const caption=figure.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1]||'';
  assert.ok(plain(caption).startsWith(photo.caption),photo.id+' caption matches the reviewed identity');
  assert.ok(caption.includes('href="'+escaped(photo.sourceUrl)+'"'));
  assert.ok(caption.includes('href="'+escaped(photo.licenseUrl)+'"'));
  assert.ok(caption.includes(escaped(photo.credit)));
 }
 const limestone=section('limestone');assert.match(limestone,/A different limestone example/);
 assert.match(article,/not proof that identical bedrock lies immediately beneath/);
 assert.match(article,/not every appearance of granite/);assert.match(article,/Different photographed examples do not share a common scale/);
 assert.match(section('greenstone'),/different locality from Shenandoah/);
});

test('river-rock article retains source context, density qualifications, podcast identity and authorship',()=>{
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.ok(html.includes('<title>'+title+' — Gold Trails</title>'));
 assert.ok(html.includes('<h1 id="article-title">'+title+'</h1>'));
 assert.match(html,/<meta name="description" content="Learn to recognize common river rocks/);
 assert.match(article,/probably granite/);assert.match(article,/No single clue identifies every stone/);
 assert.match(article,/does not establish that gold is present/);
 const density=section('density');assert.match(density,/g\/cm³/);assert.match(density,/comparison values, not identification boundaries/);
 const expected={'Sandstone':'2.2–2.8','Limestone':'2.3–2.7','Marble':'2.4–2.7','Mica schist':'2.5–2.9','Granite':'2.6–2.7','Gneiss':'2.6–2.9','Quartzite':'2.6–2.8','Basalt':'2.8–3.0','Diorite':'2.8–3.0','Quartz mineral':'About 2.65','Pure gold':'About 19.3'};
 const rows=[...density.matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><\/tr>/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(Object.fromEntries(rows),expected);
 assert.match(density,/100 cm³/);assert.match(density,/265 grams for quartz/);assert.match(density,/1,930 grams for pure gold/);assert.match(density,/7\.3/);
 assert.match(density,/Natural gold commonly contains other metals/);assert.match(density,/Density also differs from hardness/);
 const experiment=plain(section('examine'));assert.match(experiment,/One milliliter equals one cubic centimeter/);assert.match(experiment,/Trapped bubbles, water absorption/);
 const podcast=anchors(section('examine')).find(a=>a.href.includes('nickzentner.com/'));
 assert.ok(podcast);assert.equal(podcast.label,'Rock Identification podcast episode');assert.ok(!/video/i.test(podcast.label));
 const sourceText=plain(section('sources'));
 assert.match(sourceText,/Sources checked: October 17, 2026/);
 assert.match(sourceText,/Copyright 2026 Paul Shoemaker – Upperleft Design/);assert.match(sourceText,/assistance from ChatGPT/);
 const sources=['arxiv.org/abs/1311.6574','bgs.ac.uk/discovering-geology/rocks-and-minerals/','nps.gov/subjects/geology/igneous.htm','nps.gov/subjects/geology/sedimentary.htm','nps.gov/subjects/geology/metamorphic.htm','courses.ems.psu.edu/mng230/node/869','open.edu/openlearn/','pubs.usgs.gov/bul/b1693/html/bull7kdv.htm'];
 for(const url of sources)assert.ok(anchors(article).some(a=>a.href.includes(url)),url+' retains a contextual link');
 for(const a of anchors(article).filter(a=>a.href?.startsWith('https://'))){assert.ok(a.label.length>3&&!/^https?:/.test(a.label),'descriptive link: '+a.href);assert.match(a.attrs,/target="_blank"/);assert.match(a.attrs,/rel="noopener noreferrer"/);}
});

test('article contents, internal links and comparison tables have valid accessible destinations',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const a of anchors(article).filter(a=>a.href?.startsWith('#')))assert.ok(ids.includes(a.href.slice(1)),a.href);
 const internal=anchors(article).filter(a=>a.href?.startsWith('/articles/'));
 assert.ok(internal.some(a=>a.href==='/articles/how-deep-is-bedrock/'));
 assert.ok(internal.some(a=>a.href==='/articles/compare-test-pans/'));
 for(const a of internal)assert.ok(existsSync(new URL('.'+a.href+'index.html',dist)),a.href+' exists');
 const tables=[...article.matchAll(/<div class="rock-table-wrap[^>]*>[\s\S]*?<\/table><\/div>/g)].map(m=>m[0]);
 assert.equal(tables.length,2);
 for(const table of tables){assert.match(table,/role="region" aria-label="[^"]+" tabindex="0"/);assert.match(table,/<caption>[^<]+<\/caption>/);assert.equal((table.match(/<th scope="col">/g)||[]).length,2);assert.match(table,/<th scope="row">/);}
 assert.match(html,/<dialog[^>]+aria-labelledby="article-photo-title"[^>]+data-article-photo-dialog/);
 assert.match(html,/data-article-photo-close>Close/);assert.match(html,/data-article-photo-shrink/);assert.match(html,/press Escape/);
 assert.match(html,/<script src="\/article-photo-viewer\.js(?:\?[^"<>]*)?" defer><\/script>/);
});

test('new geology article appears once in the searchable listing and published catalog',()=>{
 const catalog=publishedArticles(),entries=catalog.filter(a=>a.url===route);
 assert.equal(entries.length,1);assert.equal(entries[0].title,title);assert.equal(entries[0].id,'article:identifying-river-rocks');
 assert.ok(entries[0].tags.includes('geology'));assert.ok(entries[0].tags.includes('river'));
 assert.equal(new Set(catalog.map(a=>a.id)).size,catalog.length);
 const row=[...listing.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(m=>m[0]).filter(r=>r.includes('href="'+route+'"'));
 assert.equal(row.length,1);assert.ok(row[0].includes('data-title="'+title+'"'));assert.match(row[0],/data-date="2026-10-17"/);
 assert.match(listing,/id="article-search"/);assert.match(listing,/id="article-sort"/);
 assert.equal((listing.match(/<li data-date=/g)||[]).length,catalog.length);
 assert.ok(listing.includes('id="article-count" role="status">'+catalog.length+' articles'));
});

test('anonymous HTTP serves the article, viewer assets and every credited full image and thumbnail',async t=>{
 const server=createServer({root:fileURLToPath(dist),guests:null,goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const path of [route,'/articles/']){
  const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/text\/html/);
  const body=await response.text();assert.ok(body.includes(title));assert.equal((body.match(/data-reading-options hidden/g)||[]).length,1);
 }
 for(const path of ['/article-photo-viewer.js','/river-rocks.css','/article-photos.css',...manifest.images.flatMap(p=>[p.src,p.thumb])]){
  const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,200,path);
  if(/\.(?:jpg|webp)$/.test(path)){assert.match(response.headers.get('content-type'),/^image\//);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),createHash('sha256').update(readFileSync(new URL('.'+path,dist))).digest('hex'),path+' is served intact');}
  else{assert.match(response.headers.get('content-type'),/javascript|css/);assert.ok((await response.text()).length>100);}
 }
});
