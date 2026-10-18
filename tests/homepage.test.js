import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {once} from 'node:events';import {hotspots,sections,canvas} from '../app/homepage/hotspots.js';import {homepageMarkup,createHomepageHandler,homeHotspots,graphicalHome} from '../app/homepage/handler.js';import {createServer} from '../app/server.js';
test('artwork coordinates fit the canvas and keep help buttons separate from links',()=>{assert.equal(new Set(hotspots.map(p=>p.id)).size,hotspots.length);for(const p of hotspots){const[x,y,w,h]=p.rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=canvas.width&&y+h<=canvas.height,p.id);assert.ok(sections.some(s=>s.id===p.section));if(p.type==='help')assert.ok(p.text.length>10);if(p.type==='link')assert.ok(p.href.startsWith('/'));}for(const help of hotspots.filter(p=>p.type==='help'))for(const link of hotspots.filter(p=>p.type==='link')){const[a,b,c,d]=help.rect,[e,f,g,h]=link.rect;assert.ok(!(a<e+g&&a+c>e&&b<f+h&&b+d>f),help.id+' overlaps '+link.id);}});
test('existing mobile markup stays intact; raster source selection excludes phones; calibration defaults off',async()=>{const original=await readFile('dist/index.html','utf8'),html=homepageMarkup(original,{});assert.ok(html.includes(original.match(/<section class="hero">[\s\S]*?<\/section>/)[0]));assert.ok(html.includes('media="(min-width: 1280px) and (hover: hover) and (pointer: fine)"'));assert.ok(html.includes('data:image/gif'));assert.equal(html.includes('LOCAL CALIBRATION'),false);assert.equal(homepageMarkup(html,{}),html);assert.ok(homepageMarkup(original,{calibration:true}).includes('LOCAL CALIBRATION'));});
test('the actual homepage route keeps authentication and does not leak account data',async t=>{let requested;const handler=createHomepageHandler({members:{session:async raw=>{requested=raw;return{id:'private-account',email:'private@example.invalid'};}},config:{origin:'https://goldtrails.org'}});const server=createServer({homepage:handler,goldPrice:async()=>({}),log:()=>{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const origin='http://127.0.0.1:'+server.address().port;let r=await fetch(origin),body=await r.text();assert.equal(r.status,200);assert.ok(body.includes('href="/login/" data-home-account'));assert.ok(!body.includes('home-calibration'));r=await fetch(origin,{headers:{cookie:'__Host-gold-member='+'a'.repeat(64)}});body=await r.text();assert.equal(requested,'a'.repeat(64));assert.ok(body.includes('href="/account/" data-home-account'));assert.ok(!body.includes('private@example.invalid'));assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.headers.get('vary'),'Cookie');});
test('upcoming community events remain in both responsive homepage views',async t=>{const {createConnectionsHandler}=await import('../app/connections/handler.js');const event={id:'a'.repeat(8)+'-aaaa-4aaa-8aaa-'+'a'.repeat(12),title:'Public gathering',status:'published',visibility:'public',state:'CA',mode:'in-person',category:'panning',experience:'all',start:'2026-11-07T16:00:00Z',end:'2026-11-07T18:00:00Z',timezone:'America/Los_Angeles',description:'Public gathering',summary:'A community event',location:'California'};const connections=createConnectionsHandler({store:{ready:async()=>true,list:async()=>({events:[event]})},log:()=>{}});const server=createServer({homepage:createHomepageHandler(),connections,goldPrice:async()=>({}),log:()=>{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const body=await(await fetch('http://127.0.0.1:'+server.address().port)).text();assert.equal((body.match(/class="connections connections-home"/g)||[]).length,2);});

test('illustrated homepage preserves equivalent hero text and promotes the public creator library',()=>{
 const html=graphicalHome();
 assert.match(html,/<h1 id="home-welcome">Explore\. Learn\. Connect\.<\/h1>/);
 assert.match(html,/class="home-sr home-hero-copy"/);
 const hero=html.match(/<section class="home-sr home-hero-copy"[\s\S]*?<\/section>/)?.[0]||'';
 assert.equal((hero.match(/<p>/g)||[]).length,1,'One concise introduction accompanies the hero title');
 assert.match(hero,/<p>Gold prospecting knowledge, real-world experience, and a supportive community of gold prospecting enthusiasts\.<\/p>/);
 const creators=html.match(/<section class="home-live-copy home-live-panel"[^>]*aria-labelledby="home-live-creators">[\s\S]*?<\/section>/)?.[0]||'';
 assert.match(creators,/<h2 id="home-live-creators">Creators &amp; Videos<\/h2>/);
 assert.match(creators,/<p>Explore linked videos from gold prospecting creators\.<\/p>/);
 assert.doesNotMatch(creators,/home-panel-subtitle|Free to explore/,'Creator card uses the requested single description');
 assert.match(html,/<p class="home-panel-subtitle">Practical guides and stories<\/p><p>Practical how-tos, geology, and mineral science\.<\/p>/);
 assert.match(html,/<p class="home-panel-subtitle">Words from the gold trail<\/p><p>Clear definitions, tool names, and regional words\.<\/p>/);
 assert.match(html,/<strong>\$5<\/strong><span>\/ month<\/span>/);
 const features=html.match(/<section class="home-live-copy home-live-plus"[\s\S]*?<\/section>/)?.[0]||'';
 for(const text of ['50 state guides','Gold geology &amp; history','Access research &amp; source links','Creator map'])assert.ok(features.includes('<li>'+text+'</li>'));
 assert.doesNotMatch(features,/Connections|RSVP|events/,'Almanac card describes only the Almanac');
 const utilities=html.match(/<div class="home-sidebar-tools"[\s\S]*?<\/button><\/div>/)?.[0]||'';
 assert.match(utilities,/class="header-tools"/);assert.match(utilities,/data-home-text-view/);
 assert.doesNotMatch(utilities,/<a\b|<nav\b|site-help/,'Sidebar utilities contain only the reading target and text-view button');
 assert.doesNotMatch(html,/home-art-tools|home-libraries/,'No top utility strip remains');
 assert.ok(html.indexOf('data-home-id="nav-about"')<html.indexOf('class="home-sidebar-tools"'),'Reading utilities follow About outside the navigation landmark');
 const creatorLinks=homeHotspots().filter(p=>p.id==='nav-destinations'||p.id.startsWith('panel-destinations'));
 for(const item of creatorLinks){
  if(item.type==='link')assert.equal(item.href,'/prospectors/');
  assert.equal(item.premium===true,false);
  assert.ok(!/Destinations|Find Gold/.test(item.name));
 }
 assert.ok(!html.includes('Explore Destinations'));
 assert.match(html,/srcset="\/assets\/homepage\/full-home-critique-v4\.webp"/);
 assert.ok(!hotspots.some(p=>/^hero-(?:articles|glossary)(?:-help)?$/.test(p.id)),'Removed hero buttons and help have no invisible hit areas');
 assert.doesNotMatch(html,/data-home-id="hero-(?:articles|glossary)(?:-help)?"/);
 assert.match(html,/data-home-id="old-timer"[^>]*href="\/"/,'The Old-Timer still links home');
 for(const [id,href]of [['articles','/articles/'],['glossary','/glossary/']]){
  assert.match(html,new RegExp('data-home-id="panel-'+id+'-button"[^>]*href="'+href+'"'),'Lower panel navigation is retained');
  assert.match(html,new RegExp('data-home-id="panel-'+id+'-button-help"'),'Lower panel help is retained');
 }
});

test('public, free, expired and raw-plan artwork links describe premium features without granting access',()=>{
 for(const options of [{},{member:{effective_level:'free',plan:'plus'}},{member:{plan:'plus'}},{member:{level:'subscriber'}},{member:{effective_level:'expired'}},{member:{effective_level:'free',level:'subscriber'}}]){
  const items=homeHotspots(options),html=graphicalHome(options);
  assert.equal(items.find(p=>p.id==='nav-almanac').href,'/plus/');
  assert.equal(items.find(p=>p.id==='nav-almanac').name,'Almanac');
  assert.equal(items.find(p=>p.id==='nav-connections').href,'/plus/');
  assert.equal(items.find(p=>p.id==='nav-connections').name,'Gold Connections');
  assert.match(html,/<span class="home-nav-label">Gold Connections<\/span>/);
  assert.ok(!/href="\/(?:gold-almanac|connections)\//.test(html),'Premium routes are absent from public illustrated navigation and search');
  assert.match(html,/data-home-id="nav-almanac-help"[^>]*data-home-premium="plus"/);
  assert.match(html,/data-home-id="nav-connections-help"[^>]*data-home-premium="plus"/);
  assert.match(html,/<span class="home-card-plus-badge">Plus<\/span>/);
  assert.equal(items.find(p=>p.id==='panel-plus-button').href,'/plus/');
  assert.match(html,/Explore Almanac →/);
 }
});

test('effective subscribers and guest readers keep one direct Almanac link and paid Connections discovery',()=>{
 for(const options of [{member:{effective_level:'subscriber'}},{guest:true}]){
  const items=homeHotspots(options),html=graphicalHome(options);
  assert.equal(items.find(p=>p.id==='nav-almanac').href,'/gold-almanac/');
  assert.equal(items.find(p=>p.id==='nav-connections').href,'/connections/');
  assert.match(html,/<span class="home-nav-label">Gold Connections<\/span>/);
  assert.doesNotMatch(html,/data-home-premium="plus"|home-nav-plus-badge|home-card-plus-badge/,'Entitled visitors see no upgrade badges');
  assert.equal(items.find(p=>p.id==='nav-almanac').label,'Almanac');
  assert.doesNotMatch(html,/Gold Trails Plus|\$5|\/ month|href="\/plus\/"/,'Existing card welcomes entitled visitors without an upgrade offer');
  assert.match(html,/<strong>Welcome<\/strong><span>back<\/span>/);
  assert.match(html,/data-home-id="panel-member-map"[^>]*href="\/gold-almanac\/"/);
  assert.match(html,/data-home-id="panel-member-almanac"[^>]*href="\/gold-almanac\/"/);
  assert.doesNotMatch(html,/data-home-id="panel-member-connections"/,'Connections is discovered through its sidebar, not the Almanac card');
  assert.match(html,/data-home-id="panel-plus-button"[^>]*href="\/gold-almanac\/"/);
  assert.match(html,/Open Almanac →/);
  for(const item of items.filter(p=>p.section==='plus')){
   assert.doesNotMatch(item.name+' '+(item.text||''),/Connections/);
   if(item.type==='link')assert.equal(item.href,'/gold-almanac/');
  }
  assert.doesNotMatch(html,/data-home-id="panel-plus"/);
  for(const help of items.filter(p=>p.type==='help'))for(const link of items.filter(p=>p.type==='link')){
   const[a,b,c,d]=help.rect,[e,f,g,h]=link.rect;assert.ok(!(a<e+g&&a+c>e&&b<f+h&&b+d>f),help.id+' overlaps '+link.id);
  }
 }
});

test('every viewer gets the same nine ordered sidebar choices with public creators and reading tools below About',()=>{
 for(const options of [{},{member:{effective_level:'free'}},{member:{effective_level:'expired',plan:'plus'}},{member:{plan:'plus'}},{member:{effective_level:'subscriber'}},{guest:true}]){
  const items=homeHotspots(options),html=graphicalHome(options);
  const products=items.find(p=>p.id==='nav-products'),help=items.find(p=>p.id==='nav-products-help');
  assert.equal(products.href,'/products/');assert.equal(products.name,'Products');
  assert.equal(help.premium===true,false);assert.ok(help.text.length>10);
  assert.equal(items.filter(p=>p.id==='nav-products').length,1);
  assert.ok(!items.some(p=>p.id==='nav-plus'||p.id==='nav-plus-help'),'Separate Plus navigation was replaced');
  assert.ok(!html.includes('data-home-id="nav-plus'),'No obsolete Plus hotspot is rendered');
  const sidebar=[...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)].find(m=>m[1].includes('aria-label="Homepage navigation"'));
  assert.ok(sidebar,'Illustrated sidebar is a semantic navigation landmark');assert.match(sidebar[1],/aria-label="[^"]+"/);
  const nav=items.filter(p=>p.id.startsWith('nav-')&&p.type!=='help');
  assert.deepEqual(nav.map(p=>p.id),['nav-signin','nav-articles','nav-almanac','nav-destinations','nav-glossary','nav-connections','nav-products','nav-search','nav-about']);
  for(const [i,item]of nav.entries()){
   assert.deepEqual(item.rect,[34,210+43*i,204,39]);
   const help=items.find(p=>p.id===item.id+'-help');assert.deepEqual(help.rect,[241,214+43*i,28,28]);
  }
  assert.ok(!items.some(p=>p.id==='nav-home'||p.id==='nav-home-help'));
  assert.doesNotMatch(sidebar[2],/data-home-id="nav-home/);
  assert.match(sidebar[2],/data-home-id="nav-destinations"[^>]*href="\/prospectors\/"[^>]*><span class="home-nav-label">Creators<\/span>/);
  assert.ok(sidebar.index+sidebar[0].length<html.indexOf('class="home-sidebar-tools"'),'Utilities sit outside and after the navigation');
  const almanac=sidebar[2].match(/<a\b[^>]*data-home-id="nav-almanac"[^>]*>([\s\S]*?)<\/a>/)?.[1]||'';
  assert.match(almanac,/Almanac/);
  assert.equal(/class="home-nav-plus-badge"/.test(almanac),options.member?.effective_level!=='subscriber'&&options.guest!==true);
  assert.equal((sidebar[2].match(/data-home-id="nav-almanac"/g)||[]).length,1,'Only one Almanac sidebar entry');
  for(const item of items.filter(p=>p.id==='nav-destinations'||p.id==='nav-destinations-help'||p.id.startsWith('panel-destinations'))){
   if(item.type==='link')assert.equal(item.href,'/prospectors/');
   assert.equal(item.premium===true,false);assert.ok(!/Destinations|Find Gold|Almanac/.test(item.name));
  }
 }
 assert.deepEqual(homeHotspots().map(p=>p.id),hotspots.map(p=>p.id),'Public controls retain their configured identifiers');
});

test('a validated guest reader receives premium discovery without an account identity',async t=>{
 let reads=0;
 const homepage=createHomepageHandler({guests:{read:req=>{reads++;return req.headers.cookie==='fixture-guest=yes'?{id:'fixture-pass',label:'Private fixture label'}:null;}}});
 const server=createServer({homepage,guests:null,goldPrice:async()=>({}),log:()=>{}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port;
 const html=await(await fetch(origin,{headers:{cookie:'fixture-guest=yes'}})).text();
 const illustrated=html.match(/<main class="home-graphical[\s\S]*?<\/main>/)?.[0]||'';
 assert.equal(reads,1);assert.match(illustrated,/data-home-id="nav-almanac"[^>]*href="\/gold-almanac\/"/);
 assert.match(illustrated,/data-home-id="nav-connections"[^>]*href="\/connections\/"/);
 assert.match(illustrated,/href="\/login\/" data-home-account/);
 assert.ok(!illustrated.includes('Private fixture label'));assert.ok(!illustrated.includes('fixture-pass'));
 const publicHtml=await(await fetch(origin)).text();
 assert.match(publicHtml,/data-home-id="nav-almanac"[^>]*href="\/plus\/"/);
 assert.match(publicHtml,/data-home-id="nav-connections"[^>]*href="\/plus\/"/);
 assert.match(publicHtml,/data-home-id="nav-products"[^>]*href="\/products\/"/);
});

test('larger scene help targets remain separate from links and readable fallback is retained',async()=>{
 const roomy=hotspots.filter(p=>p.type==='help'&&p.section!=='sidebar');
 assert.ok(roomy.length>0);for(const item of roomy)assert.ok(item.rect[2]>=40&&item.rect[3]>=40,item.id);
 const html=graphicalHome();
 assert.match(html,/home-help-roomy/);assert.match(html,/class="home-help-mark" aria-hidden="true">\?<\/span>/);
 const script=await readFile('dist/home-art.js','utf8'),css=await readFile('dist/home-art.css','utf8');
 assert.ok(script.includes("e.key==='Escape'"));assert.ok(script.includes("closeButton.addEventListener('click'"));assert.ok(script.includes('data-reading-dark'));
 assert.ok(script.includes('Return to illustrated homepage'));assert.ok(script.includes('home-text-mode'));
 assert.match(css,/\.home-help-roomy\{min-width:40px;min-height:40px\}/);
 assert.match(css,/\.home-hotspot\{[^}]*background:transparent!important/);
});
