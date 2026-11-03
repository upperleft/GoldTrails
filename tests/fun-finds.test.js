import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {foodFinds,giftFinds,diyIdeas,snackBreak,unverifiedConcepts,findPages,findSummary} from '../app/fun-finds/catalog.js';
import {renderFunFindsPage} from '../app/fun-finds/page.js';
import {navigationLinks,siteNavigationMarkup,funFindsNavigation} from '../app/site-navigation.js';
import {createServer} from '../app/server.js';

const cards=html=>[...html.matchAll(/<li class="find-card" id="([^"]+)"/g)].map(match=>match[1]);
const hrefs=html=>[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&'));

test('a manageable sourced collection keeps food, gifts, original ideas and concepts separate',()=>{
 const all=[...foodFinds,...giftFinds];assert.ok(foodFinds.length>0&&giftFinds.length>0);assert.equal(new Set(all.map(find=>find.id)).size,all.length);
 assert.deepEqual(findSummary(),{food:foodFinds.length,gifts:giftFinds.length,originalIdeas:3,concepts:1});
 assert.equal(new Set(all.map(find=>find.url)).size,all.length,'A source product is not duplicated across cards');
 for(const find of all){
  assert.ok(find.classification&&find.availabilityNote,find.id);assert.match(find.url,/^https:\/\//);assert.ok(find.sources.length);
  for(const source of find.sources){assert.match(source.url,/^https:\/\//);assert.equal(source.checkedAt,'2026-11-03');assert.ok(source.note);}
  if(find.price){assert.ok(Number.isFinite(find.price.amount));assert.match(find.price.currency,/^[A-Z]{3}$/);assert.equal(find.price.checkedAt,'2026-11-03');}
 }
 assert.equal(diyIdeas.length,3);assert.equal(unverifiedConcepts.length,1);assert.equal(unverifiedConcepts[0].status,'unverified concept');
 assert.ok(!('url' in unverifiedConcepts[0]),'An unverified cushion idea has no purchase destination');assert.match(snackBreak.summary,/no gold/i);
});

test('food cards explicitly classify real edible gold, gold-colored treats and removable wrappers',()=>{
 const html=renderFunFindsPage('food');assert.deepEqual(cards(html).sort(),foodFinds.map(find=>find.id).sort());
 assert.match(html,/<h1>Gold You Can Eat<\/h1>/);assert.match(html,/thin leaf or flakes/);assert.match(html,/craft leaf and wrappers are different/);
 assert.match(html,/foil/i);assert.match(html,/remove/i);assert.match(html,/edible gold/i);
 assert.match(html,/Keep real soil, paydirt, gold pans, and other prospecting equipment away from food preparation/);
 assert.equal((html.match(/<section class="finds-kitchen"/g)||[]).length,1);assert.equal((html.match(/<aside class="finds-snack"/g)||[]).length,1);
 for(const idea of diyIdeas)assert.ok(html.includes(idea.name));
 const experience=foodFinds.find(find=>find.section==='experiences');assert.ok(experience?.location);assert.ok(html.includes(experience.location));
});

test('gifts distinguish verified listings from an original nugget cushion concept',()=>{
 const html=renderFunFindsPage('gifts');assert.deepEqual(cards(html).sort(),giftFinds.map(find=>find.id).sort());
 assert.match(html,/<h1>Gold Gifts &amp; Oddities<\/h1>/);assert.match(html,/Original concept · No verified product listing/);
 for(const concept of unverifiedConcepts){assert.ok(html.includes(concept.name));assert.ok(!cards(html).includes(concept.name));}
 assert.match(html,/A pillow shaped like a bar is different from an irregular nugget cushion/);
 assert.ok(!html.includes('class="finds-kitchen"'));assert.ok(!html.includes('class="finds-snack"'));
});

test('section links, source dates, outbound destinations and accessible details remain usable without scripts',()=>{
 for(const kind of Object.keys(findPages)){
  const html=renderFunFindsPage(kind);const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
  assert.match(html,new RegExp('<link rel="canonical" href="https://goldtrails.org'+findPages[kind].route+'">'));
  for(const href of hrefs(html).filter(href=>href.startsWith('#')))assert.ok(ids.has(href.slice(1)),href+' has a target');
  for(const find of kind==='food'?foodFinds:giftFinds){assert.ok(hrefs(html).includes(find.url));assert.ok(html.includes('Last checked Nov 3, 2026'));}
  assert.match(html,/<details class="find-sources"><summary>Sources &amp; details<\/summary>/);
  assert.ok(!html.includes('<img'),'Neutral symbols avoid invented or unlicensed product photography');
  assert.ok(!html.includes('63 verified'));assert.ok(!html.includes('href="/paydirt/"'));assert.ok(!html.includes('href="/paydirts/"'));
  assert.ok(hrefs(html).includes('/gold-games/'));assert.ok(hrefs(html).includes('/products/'));
 }
});

test('secondary Fun & Finds navigation reuses Games and preserves the primary menu',()=>{
 const fixture='<!doctype html><html><head></head><body><main><aside class="left"><section class="panel trail-menu">Old menu</section></aside><div class="center"><h2>Existing content</h2></div></main><footer></footer></body></html>';
 for(const path of ['/gold-games/','/gold-you-can-eat/','/gold-gifts-oddities/']){
  const html=siteNavigationMarkup(fixture,{path});
  const footer=html.match(/<details class="site-resource-menu">[\s\S]*?<\/details>/)[0];assert.match(footer,/<summary>Gold Fun &amp; Finds<\/summary>/);
  assert.deepEqual(hrefs(footer),['/gold-games/','/gold-you-can-eat/','/gold-gifts-oddities/']);assert.ok(footer.includes('href="'+path+'" aria-current="page"'));
  assert.equal((html.match(/data-fun-finds-navigation/g)||[]).length,1);assert.equal(siteNavigationMarkup(html,{path}),html);
  assert.ok(!navigationLinks(path).includes('/gold-you-can-eat/'));assert.ok(!navigationLinks(path).includes('/gold-gifts-oddities/'));
 }
 const rendered=renderFunFindsPage('food'),decorated=siteNavigationMarkup(rendered,{path:'/gold-you-can-eat/'});assert.equal((decorated.match(/data-fun-finds-navigation/g)||[]).length,1,'Pre-rendered secondary navigation is not duplicated');
 assert.match(funFindsNavigation('/gold-gifts-oddities/'),/href="\/gold-gifts-oddities\/" aria-current="page"/);
});

test('new free pages resolve canonically, support HEAD and preserve secondary links over HTTP',async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'gold-finds-http-')));
 for(const [kind,page] of Object.entries(findPages)){await mkdir(join(root,page.route));await writeFile(join(root,page.route,'index.html'),renderFunFindsPage(kind));}
 const server=createServer({root,goldPrice:async()=>({}),log:()=>{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port;
 for(const page of Object.values(findPages)){
  const redirect=await fetch(origin+page.route.slice(0,-1),{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),page.route);
  const response=await fetch(origin+page.route);assert.equal(response.status,200);const html=await response.text();assert.match(html,/<summary>Gold Fun &amp; Finds<\/summary>/);assert.equal((html.match(/data-fun-finds-navigation/g)||[]).length,1);
  const head=await fetch(origin+page.route,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }
});
