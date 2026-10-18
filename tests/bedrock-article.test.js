import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from '../app/server.js';
import {publishedArticles} from '../app/compass/content.js';

const slug='how-deep-is-bedrock',path='/articles/'+slug+'/';
const title='How Deep Is Bedrock? Maps That Help Gold Prospectors Read the Ground';
const html=readFileSync(new URL('../dist'+path+'index.html',import.meta.url),'utf8');
const listing=readFileSync(new URL('../dist/articles/index.html',import.meta.url),'utf8');
const article=html.match(/<article\b[\s\S]*?<\/article>/)?.[0];
const text=value=>String(value).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const anchors=[...html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/g)].map(m=>({attrs:m[1],href:m[1].match(/\bhref="([^"]+)"/)?.[1],label:text(m[2])}));
const section=id=>article.match(new RegExp('<section id="'+id+'">([\\s\\S]*?)<\\/section>'))?.[1]||'';
const resources=[
 'https://websoilsurvey.sc.egov.usda.gov/App/',
 'https://www.usgs.gov/maps/quaternary-sediment-thickness-and-bedrock-topography-glaciated-united-states-east-rocky',
 'https://www.usgs.gov/data/preliminary-digital-data-a-3-layer-geologic-model-conterminous-united-states-using-land'
];

test('bedrock article follows published metadata and separates checked date from source dates',()=>{
 assert.ok(article);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.ok(html.includes('<title>'+title+' — Gold Trails</title>'));
 assert.ok(html.includes('<h1 id="article-title">'+title+'</h1>'));
 assert.match(html,/<meta name="description" content="[^"]{40,}"/);
 assert.match(article,/By the Old-Timer · Published <time datetime="2026-10-17">October 17, 2026<\/time>/);
 assert.match(article,/editorial voice/);assert.match(article,/assistance from ChatGPT/);
 assert.match(section('sources'),/Sources and interface checked <time datetime="2026-10-17">October 17, 2026<\/time>/);
 assert.match(section('sources'),/2018/);assert.match(section('sources'),/2024; version 1\.1, April 2025/);
 const body=article.split('<section id="sources">')[0];
 const words=text(body).split(/\s+/).length;
 assert.ok(words>=900&&words<=1250,'Approximately 900–1,200 words before the reference list; actual '+words);
 assert.ok(article.indexOf('<h1')<article.indexOf('class="article-contents'),'Title precedes compact contents');
});

test('requested resources have descriptive safe links beside explanations and in sources',()=>{
 for(const url of resources){
  const links=anchors.filter(a=>a.href===url);
  assert.ok(links.length>=2,'Resource appears in the article and sources: '+url);
  for(const a of links){assert.ok(a.label.length>8);assert.ok(!/^https?:/i.test(a.label));assert.match(a.attrs,/target="_blank"/);assert.match(a.attrs,/rel="noopener noreferrer"/);}
  assert.ok(section('sources').includes(url));
 }
 for(const a of anchors.filter(a=>/^https?:/.test(a.href||''))){assert.ok(a.href.startsWith('https://'));assert.match(a.attrs,/rel="noopener noreferrer"/);}
 const excerpts=[...article.matchAll(/<q>([\s\S]*?)<\/q>/g)];
 assert.ok(excerpts.length>=1&&excerpts.length<=2,'One or two short attributed excerpts');
 for(const q of excerpts)assert.ok(text(q[1]).split(/\s+/).length<=25);
});

test('map comparison exposes three resources and geographic/format limits accessibly',()=>{
 const comparison=section('map-comparison'),table=comparison.match(/<table\b[\s\S]*?<\/table>/)?.[0];
 assert.ok(table);assert.match(table,/<caption>[^<]+<\/caption>/);
 const head=table.match(/<thead>([\s\S]*?)<\/thead>/)?.[1]||'';
 const body=table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'';
 assert.equal((head.match(/<th scope="col">/g)||[]).length,3);
 const rows=[...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];assert.equal(rows.length,3);
 for(const row of rows){assert.match(row[1],/<th scope="row">/);assert.equal((row[1].match(/<td>/g)||[]).length,2);}
 assert.match(comparison,/role="region" aria-label="Map resource comparison" tabindex="0"/);
 assert.match(text(comparison),/Interactive soil maps/);assert.match(text(comparison),/Downloadable/);
 assert.match(text(comparison),/east of the Rock/i);assert.match(text(comparison),/conterminous|contiguous/i);
 assert.match(text(comparison),/1:5,000,000/);assert.match(text(comparison),/2\.5-km/);
 assert.match(text(comparison),/not map layers currently offered inside Gold Trails/);
});

test('article preserves distinctions, a clearly hypothetical example, and evidence limits',()=>{
 const depths=text(section('three-depths'));assert.match(depths,/Topsoil/);assert.match(depths,/Depth to bedrock/);assert.match(depths,/overburden/);assert.match(depths,/false bedrock/);assert.match(depths,/Compact material is not automatically solid rock/);
 const traps=text(section('placer-traps'));assert.match(traps,/Cracks, crevices/);assert.match(traps,/Shallow bedrock alone does not indicate gold/);
 const example=text(section('hypothetical'));
 assert.match(example,/hypothetical example/i);assert.match(example,/Illustration only/);assert.match(example,/No actual location or measured depth is being asserted/);assert.match(example,/Our interpretation/);
 assert.match(example,/land-soil depth does not measure an adjacent stream/);assert.match(example,/neither a regional color patch|Neither a regional color patch/);assert.match(example,/permission/);
 const time=text(section('geological-time'));assert.match(time,/million years ago/);assert.match(time,/recent earthquake counts do not establish/i);
});

test('walkthrough retains verified menu labels and all page anchors resolve without duplicate IDs',()=>{
 const walkthrough=text(section('soil-survey'));
 for(const label of ['Start Web Soil Survey (WSS)','Area of Interest (AOI)','Quick Navigation','Define AOI by Rectangle','Soil Data Explorer','Soil Properties and Qualities','Soil Qualities and Features','Depth to Bedrock','View Description','View Rating','Soil Map'])assert.ok(walkthrough.includes(label),'Menu label retained: '+label);
 assert.match(walkthrough,/lithic bedrock/);assert.match(walkthrough,/paralithic bedrock/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const a of anchors.filter(a=>a.href?.startsWith('#')))assert.ok(ids.includes(decodeURIComponent(a.href.slice(1))),'Anchor target exists: '+a.href);
});

test('article is discoverable through the existing listing and published catalog without duplicate records',()=>{
 const row=[...listing.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(m=>m[0]).find(row=>row.includes('href="'+path+'"'));
 assert.ok(row);assert.ok(row.includes('data-title="'+title+'"'));assert.match(row,/data-date="2026-10-17"/);assert.ok(row.includes('<h2><a href="'+path+'">'+title+'</a></h2>'));
 assert.match(listing,/id="article-search"/);assert.match(listing,/id="article-sort"/);
 const catalog=publishedArticles(),entry=catalog.find(a=>a.id==='article:'+slug);
 assert.ok(entry);assert.equal(entry.title,title);assert.equal(entry.url,path);assert.equal(entry.kind,'article');assert.ok(entry.tags.includes('geology'));assert.ok(entry.tags.includes('locations'));
 assert.equal(new Set(catalog.map(a=>a.id)).size,catalog.length);
 assert.equal((listing.match(/<li data-date=/g)||[]).length,catalog.length);
 assert.ok(listing.includes('id="article-count" role="status">'+catalog.length+' articles'));
});

test('anonymous visitors can load the article and listing with existing reading options',async t=>{
 const server=createServer({root:fileURLToPath(new URL('../dist/',import.meta.url)),guests:null,goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 for(const route of [path,'/articles/']){
  const r=await fetch('http://127.0.0.1:'+server.address().port+route,{redirect:'manual'});
  assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);
  const body=await r.text();assert.ok(body.includes(title));assert.equal((body.match(/data-reading-options hidden/g)||[]).length,1);
 }
});
