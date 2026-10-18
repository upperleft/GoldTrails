import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {once} from 'node:events';import {hotspots,sections,canvas} from '../app/homepage/hotspots.js';import {homepageMarkup,createHomepageHandler,homeHotspots,graphicalHome} from '../app/homepage/handler.js';import {createServer} from '../app/server.js';
test('artwork coordinates fit the canvas and keep help buttons separate from links',()=>{assert.equal(new Set(hotspots.map(p=>p.id)).size,hotspots.length);for(const p of hotspots){const[x,y,w,h]=p.rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=canvas.width&&y+h<=canvas.height,p.id);assert.ok(sections.some(s=>s.id===p.section));if(p.type==='help')assert.ok(p.text.length>10);if(p.type==='link')assert.ok(p.href.startsWith('/'));}for(const help of hotspots.filter(p=>p.type==='help'))for(const link of hotspots.filter(p=>p.type==='link')){const[a,b,c,d]=help.rect,[e,f,g,h]=link.rect;assert.ok(!(a<e+g&&a+c>e&&b<f+h&&b+d>f),help.id+' overlaps '+link.id);}});
test('existing mobile markup stays intact; raster source selection excludes phones; calibration defaults off',async()=>{const original=await readFile('dist/index.html','utf8'),html=homepageMarkup(original,{});assert.ok(html.includes(original.match(/<section class="hero">[\s\S]*?<\/section>/)[0]));assert.ok(html.includes('media="(min-width: 1280px) and (hover: hover) and (pointer: fine)"'));assert.ok(html.includes('data:image/gif'));assert.equal(html.includes('LOCAL CALIBRATION'),false);assert.equal(homepageMarkup(html,{}),html);assert.ok(homepageMarkup(original,{calibration:true}).includes('LOCAL CALIBRATION'));});
test('the actual homepage route keeps authentication and does not leak account data',async t=>{let requested;const handler=createHomepageHandler({members:{session:async raw=>{requested=raw;return{id:'private-account',email:'private@example.invalid'};}},config:{origin:'https://goldtrails.org'}});const server=createServer({homepage:handler,goldPrice:async()=>({}),log:()=>{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const origin='http://127.0.0.1:'+server.address().port;let r=await fetch(origin),body=await r.text();assert.equal(r.status,200);assert.ok(body.includes('href="/login/" data-home-account'));assert.ok(!body.includes('home-calibration'));r=await fetch(origin,{headers:{cookie:'__Host-gold-member='+'a'.repeat(64)}});body=await r.text();assert.equal(requested,'a'.repeat(64));assert.ok(body.includes('href="/account/" data-home-account'));assert.ok(!body.includes('private@example.invalid'));assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.headers.get('vary'),'Cookie');});
test('upcoming community events remain in both responsive homepage views',async t=>{const {createConnectionsHandler}=await import('../app/connections/handler.js');const event={id:'a'.repeat(8)+'-aaaa-4aaa-8aaa-'+'a'.repeat(12),title:'Public gathering',status:'published',visibility:'public',state:'CA',mode:'in-person',category:'panning',experience:'all',start:'2026-11-07T16:00:00Z',end:'2026-11-07T18:00:00Z',timezone:'America/Los_Angeles',description:'Public gathering',summary:'A community event',location:'California'};const connections=createConnectionsHandler({store:{ready:async()=>true,list:async()=>({events:[event]})},log:()=>{}});const server=createServer({homepage:createHomepageHandler(),connections,goldPrice:async()=>({}),log:()=>{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const body=await(await fetch('http://127.0.0.1:'+server.address().port)).text();assert.equal((body.match(/class="connections connections-home"/g)||[]).length,2);});

test('illustrated homepage preserves equivalent hero text and promotes the public creator library',()=>{
 const html=graphicalHome();
 assert.match(html,/<h1 id="home-welcome">Explore\. Learn\. Connect\.<\/h1>/);
 assert.match(html,/class="home-sr home-hero-copy"/);
 assert.match(html,/Gold prospecting knowledge, stories, and tools — all in one place\./);
 assert.match(html,/Practical how-tos, destination guides, gear advice, real-world experience, and a supportive community of gold prospecting enthusiasts\./);
 assert.match(html,/<h2 id="home-live-creators">Creators &amp; Videos<\/h2>/);
 assert.match(html,/<strong>\$5<\/strong><span>\/ month<\/span>/);
 assert.match(html,/<strong>50-state Almanac<\/strong>/);assert.match(html,/<strong>Gold Connections<\/strong>/);
 const primary=html.match(/<nav aria-label="Explore Gold Trails">([\s\S]*?)<\/nav>/)?.[1]||'';
 assert.match(primary,/^<a class="home-creators-first" href="\/prospectors\/">Creators &amp; Videos<\/a>/);
 assert.match(primary,/<a href="\/products\/">Products<\/a>/);
 assert.doesNotMatch(primary,/href="\/plus\/"|Gold Trails Plus/,'Utility navigation does not duplicate Plus marketing');
 assert.ok(html.indexOf('home-art-tools')<html.indexOf('class="home-full"'),'Primary live choices precede the artwork');
 const creatorLinks=homeHotspots().filter(p=>p.id==='nav-destinations'||p.id.startsWith('panel-destinations'));
 for(const item of creatorLinks){
  if(item.type==='link')assert.equal(item.href,'/prospectors/');
  assert.equal(item.premium===true,false);
  assert.ok(!/Destinations|Find Gold/.test(item.name));
 }
 assert.ok(!html.includes('Explore Destinations'));
 assert.match(html,/srcset="\/assets\/homepage\/full-menu-v2\.webp"/);
});

test('public and free artwork links describe the one Almanac Plus feature without exposing premium discovery',()=>{
 for(const options of [{},{member:{effective_level:'free',plan:'plus'}},{member:{plan:'plus'}},{member:{effective_level:'expired'}}]){
  const items=homeHotspots(options),html=graphicalHome(options);
  assert.equal(items.find(p=>p.id==='nav-almanac').href,'/plus/');
  assert.equal(items.find(p=>p.id==='nav-almanac').name,'Almanac');
  assert.equal(items.find(p=>p.id==='nav-connections').href,'/clubs-groups/');
  assert.equal(items.find(p=>p.id==='nav-connections').name,'Clubs & Groups');
  assert.match(html,/<span class="home-nav-label">Clubs &amp; Groups<\/span>/);
  assert.ok(!/href="\/(?:gold-almanac|connections)\//.test(html),'Premium routes are absent from public illustrated navigation and search');
  assert.match(html,/data-home-id="nav-almanac-help"[^>]*data-home-premium="plus"/);
  assert.ok(!/data-home-id="nav-connections-help"[^>]*data-home-premium/.test(html),'Public clubs are not advertised as premium');
 }
});

test('effective subscribers and guest readers keep one direct Almanac link and paid Connections discovery',()=>{
 for(const options of [{member:{effective_level:'subscriber'}},{guest:true}]){
  const items=homeHotspots(options),html=graphicalHome(options);
  assert.equal(items.find(p=>p.id==='nav-almanac').href,'/gold-almanac/');
  assert.equal(items.find(p=>p.id==='nav-connections').href,'/connections/');
  assert.match(html,/<span class="home-nav-label">Gold Connections<\/span>/);
  assert.match(html,/data-home-id="nav-almanac-help"[^>]*data-home-premium="plus"/);
 }
});

test('every viewer gets Products, a named sidebar landmark, a Plus badge and public creators',()=>{
 for(const options of [{},{member:{effective_level:'free'}},{member:{effective_level:'expired',plan:'plus'}},{member:{plan:'plus'}},{member:{effective_level:'subscriber'}},{guest:true}]){
  const items=homeHotspots(options),html=graphicalHome(options);
  const products=items.find(p=>p.id==='nav-products'),help=items.find(p=>p.id==='nav-products-help');
  assert.equal(products.href,'/products/');assert.equal(products.name,'Products');assert.equal(products.rect[1],499);
  assert.equal(help.premium===true,false);assert.ok(help.text.length>10);
  assert.equal(items.filter(p=>p.id==='nav-products').length,1);
  assert.ok(!items.some(p=>p.id==='nav-plus'||p.id==='nav-plus-help'),'Separate Plus navigation was replaced');
  assert.ok(!html.includes('data-home-id="nav-plus'),'No obsolete Plus hotspot is rendered');
  const sidebar=[...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)].find(m=>m[2].includes('data-home-id="nav-home"'));
  assert.ok(sidebar,'Illustrated sidebar is a semantic navigation landmark');assert.match(sidebar[1],/aria-label="[^"]+"/);
  assert.match(sidebar[2],/<a\b[^>]*data-home-id="nav-home"[^>]*aria-current="page"/);
  const almanac=sidebar[2].match(/<a\b[^>]*data-home-id="nav-almanac"[^>]*>([\s\S]*?)<\/a>/)?.[1]||'';
  assert.match(almanac,/Almanac/);assert.match(almanac,/class="home-nav-plus-badge"[^>]*>[^<]*Plus/);
  assert.equal((sidebar[2].match(/data-home-id="nav-almanac"/g)||[]).length,1,'Only one Almanac sidebar entry');
  for(const item of items.filter(p=>p.id==='nav-destinations'||p.id==='nav-destinations-help'||p.id.startsWith('panel-destinations'))){
   if(item.type==='link')assert.equal(item.href,'/prospectors/');
   assert.equal(item.premium===true,false);assert.ok(!/Destinations|Find Gold|Almanac/.test(item.name));
  }
 }
 assert.deepEqual(homeHotspots().map(p=>p.id),hotspots.map(p=>p.id),'Hotspot identifiers do not vary by entitlement');
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
 assert.match(illustrated,/href="\/login\/" data-home-account/);
 assert.ok(!illustrated.includes('Private fixture label'));assert.ok(!illustrated.includes('fixture-pass'));
 const publicHtml=await(await fetch(origin)).text();
 assert.match(publicHtml,/data-home-id="nav-almanac"[^>]*href="\/plus\/"/);
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
