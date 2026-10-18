import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {navigationLinks,siteNavigationMarkup} from '../app/site-navigation.js';
import {createServer} from '../app/server.js';
import {createGuestPlusAccess} from '../app/plus/guest-access.js';

const paid='a'.repeat(64),free='b'.repeat(64),expired='c'.repeat(64),rawOnly='d'.repeat(64),offline='e'.repeat(64),unknown='f'.repeat(64),guestToken='12'.repeat(32);
const staticHTML='<!doctype html><html><head><title>Navigation fixture</title></head><body><header><div class="header-tools"></div></header><main><aside class="left"><section class="panel trail-menu"><h2>Old menu</h2><nav><a href="/destinations/">Destinations</a><a href="/creators-experts/">Creators &amp; Experts</a></nav></section></aside><section><h1>Public page</h1><p>Learn about our <a href="/gold-almanac/">premium Almanac</a> and <a href="/connections/">Connections</a>.</p></section></main></body></html>';
const publicHrefs=['/','/articles/','/prospectors/','/glossary/','/products/','/clubs-groups/','/calendar/','/plus/','/about-the-camp/'];
const premiumHrefs=['/gold-almanac/','/connections/'];
const mainMenus=html=>[...html.matchAll(/<nav\b[^>]*aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/g)].map(m=>m[1]);
const hrefs=markup=>[...markup.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m=>m[1]);
function assertMenus(html,premium){
 const menus=mainMenus(html);assert.equal(menus.length,2,'Desktop and mobile main navigation both exist');
 assert.deepEqual(menus[0],menus[1],'Desktop and mobile links and current-page state agree');
 for(const menu of menus){
  const links=hrefs(menu);assert.equal(new Set(links).size,links.length);
  assert.deepEqual(links.filter(href=>!premiumHrefs.includes(href)),publicHrefs);
  for(const href of premiumHrefs)assert.equal(links.includes(href),premium,href);
  assert.match(menu,/>Creators &amp; Videos<\/a>/);assert.doesNotMatch(menu,/Destinations|Creators &amp; Experts|Return to My Gold Trail/);
 }
 assert.match(html,/<details class="site-mobile-menu"><summary>Menu<\/summary>/);
 assert.doesNotMatch(html,/<details\b[^>]*class="site-mobile-menu"[^>]*\bopen\b/);
}
async function fixture(t,{brokenGuest=false}={}){
 const root=await realpath(await mkdtemp(join(tmpdir(),'gold-navigation-')));
 await mkdir(join(root,'navigation-fixture'));await writeFile(join(root,'navigation-fixture/index.html'),staticHTML);
 await writeFile(join(root,'index.html'),staticHTML);
 const css='.trail-menu{color:gold} /* original stylesheet */',js='const markup = "trail-menu"; // original script\n';
 await writeFile(join(root,'probe.css'),css);await writeFile(join(root,'probe.js'),js);
 let sessionCalls=0;
 const sessions={session:async token=>{sessionCalls++;if(token===offline)throw Error('PRIVATE_SESSION_FAILURE');return token===paid?{level:'free',effective_level:'subscriber'}:token===free?{level:'free',effective_level:'free'}:token===expired?{level:'subscriber',effective_level:'free'}:token===rawOnly?{level:'subscriber'}:null;}};
 const guest=createGuestPlusAccess({passes:[{id:'navigation-test',label:'Test guests',tokenHash:createHash('sha256').update(guestToken).digest('hex'),expiresAt:'2026-10-25T00:00:00Z'}],now:()=>Date.parse('2026-10-17T12:00:00Z')});
 const guests=brokenGuest?{handle:async()=>false,attach(){},read(){throw Error('PRIVATE_GUEST_FAILURE');}}:guest;
 const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
 const server=createServer({root,directory,memberSessions:sessions,guests,goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 const request=(path,cookie='',options={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...options,headers:{...(cookie?{Cookie:cookie}:{}),...options.headers}});
 return {request,sessionCalls:()=>sessionCalls,css,js};
}
const memberCookie=token=>'__Host-gold-member='+token;
const guestCookie='__Host-gold-plus-guest='+guestToken;

test('shared navigation has consistent public labels and premium links only when explicitly entitled',()=>{
 const freeMenu=navigationLinks('/prospectors/dan-hurd/'),paidMenu=navigationLinks('/gold-almanac/california/',{premium:true});
 assert.deepEqual(hrefs(freeMenu),publicHrefs);
 for(const href of premiumHrefs)assert.ok(hrefs(paidMenu).includes(href));
 assert.match(freeMenu,/<a href="\/prospectors\/" aria-current="page">Creators &amp; Videos<\/a>/);
 assert.match(paidMenu,/<a href="\/gold-almanac\/" aria-current="page">Almanac<\/a>/);
 assert.doesNotMatch(navigationLinks('/articles/'),/<a href="\/" aria-current/);
 assert.match(navigationLinks('/'),/<a href="\/" aria-current="page"/);
});

function assertHomeMenus(html,premium){
 const menus=mainMenus(html);assert.equal(menus.length,2,'Homepage sidebar and compact mobile menu both exist');
 assert.equal(menus[0],menus[1],'Homepage menus use the same member-aware destinations');
 for(const menu of menus){
  const links=hrefs(menu);assert.equal(new Set(links).size,links.length,'Every destination occurs once');
  assert.equal(links.filter(href=>href==='/products/').length,1,'Products stays available to every viewer');
  assert.equal(links.filter(href=>href==='/prospectors/').length,1,'Creators and videos remain public');
  assert.match(menu,/<a href="\/prospectors\/">Creators &amp; Videos<\/a>/);
  assert.match(menu,new RegExp('<a href="'+(premium?'/gold-almanac/':'/plus/')+'">Almanac · Plus</a>'));
  assert.equal((menu.match(/Almanac/g)||[]).length,1,'One clear Almanac entry');
  assert.equal(links.includes('/gold-almanac/'),premium,'Only entitled viewers link directly to the Almanac');
  assert.equal(links.includes('/plus/'),!premium,'Public Almanac description replaces separate Plus navigation');
  assert.equal(links.includes('/connections/'),premium,'Connections retains its existing entitlement rule');
  assert.doesNotMatch(menu,/>Gold Trails Plus<\/a>|Destinations|Creators &amp; Experts/);
  assert.match(menu,/<a href="\/" aria-current="page">Gold Trails home<\/a>/);
 }
}

test('homepage navigation has one Almanac Plus entry and Products without changing other pages',()=>{
 for(const premium of [false,true]){
  const html=siteNavigationMarkup(staticHTML,{path:'/',premium});assertHomeMenus(html,premium);
  assert.equal(siteNavigationMarkup(html,{path:'/',premium}),html,'Homepage decoration remains idempotent');
  for(const path of ['/articles/','/prospectors/','/plus/']){
   const other=siteNavigationMarkup(staticHTML,{path,premium});assertMenus(other,premium);
   for(const menu of mainMenus(other))assert.match(menu,/<a href="\/plus\/"(?: aria-current="page")?>Gold Trails Plus<\/a>/,'Other pages keep their Plus navigation');
  }
 }
});

test('homepage marketing and premium links follow verified membership or guest access',async t=>{
 const f=await fixture(t);
 for(const [cookie,premium]of [['',false],[memberCookie(free),false],[memberCookie(expired),false],[memberCookie(rawOnly),false],[memberCookie(offline),false],[memberCookie(paid),true],[guestCookie,true],['__Host-gold-plus-guest='+unknown,false]]){
  const response=await f.request('/?premium=true&level=subscriber',cookie),html=await response.text();
  assert.equal(response.status,200);assertHomeMenus(html,premium);
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/);
  assert.doesNotMatch(html,/PRIVATE_SESSION_FAILURE/);
 }
});

test('markup replaces obsolete sidebar links and adds a collapsed native mobile menu once',()=>{
 for(const premium of [false,true]){
  const html=siteNavigationMarkup(staticHTML,{path:'/articles/',premium});assertMenus(html,premium);
  assert.equal(siteNavigationMarkup(html,{path:'/articles/',premium}),html,'Applying the decorator twice is idempotent');
  assert.equal((html.match(/data-site-navigation/g)||[]).length,1);
  assert.equal((html.match(/href="\/design-refinements\.css\?v=[a-f0-9]{12}"/g)||[]).length,1);
  assert.match(html,/<a href="\/gold-almanac\/">premium Almanac<\/a>/,'Public marketing links are preserved outside main navigation');
 }
 for(const input of [null,'plain text','<html><head></head><body><main>No sidebar</main></body></html>'])assert.equal(siteNavigationMarkup(input),input);
});

test('static and dynamic HTML resolve effective membership per request and never trust raw plan or query flags',async t=>{
 const f=await fixture(t);
 const cases=[['',false],[memberCookie(free),false],[memberCookie(expired),false],[memberCookie(rawOnly),false],[memberCookie(unknown),false],[memberCookie(offline),false],['__Host-gold-admin='+paid,false],[memberCookie(paid),true],['',false]];
 for(const path of ['/navigation-fixture/','/navigation-fixture/index.html','/prospectors/'])for(const [cookie,premium]of cases){
  const response=await f.request(path+'?level=subscriber&premium=true',cookie),html=await response.text();assert.equal(response.status,200,path);assertMenus(html,premium);
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/(?:^|,\s*)Cookie(?:,|$)/);
  assert.doesNotMatch(html,/PRIVATE_SESSION_FAILURE/);
 }
});

test('a valid read-only guest receives premium navigation, while invalid or failed guest checks fail closed',async t=>{
 const f=await fixture(t);
 for(const path of ['/navigation-fixture/','/prospectors/']){
  for(const [cookie,premium]of [[guestCookie,true],[guestCookie+'; '+memberCookie(free),true],['__Host-gold-plus-guest='+unknown,false],[guestCookie+'; '+guestCookie,false]]){
   const response=await f.request(path,cookie),html=await response.text();assert.equal(response.status,200);assertMenus(html,premium);
   assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/);
   assert.ok(!html.includes(guestToken),'The navigation never publishes the guest bearer');
  }
 }
 const broken=await fixture(t,{brokenGuest:true});
 for(const [cookie,premium]of [[guestCookie,false],[guestCookie+'; '+memberCookie(free),false],[guestCookie+'; '+memberCookie(paid),true]]){
  const response=await broken.request('/navigation-fixture/',cookie),html=await response.text();assert.equal(response.status,200);assertMenus(html,premium);assert.doesNotMatch(html,/PRIVATE_GUEST_FAILURE/);
 }
});

test('HEAD HTML keeps personalized cache protection while CSS and scripts retain their exact content and skip session lookup',async t=>{
 const f=await fixture(t);
 for(const path of ['/navigation-fixture/','/prospectors/']){
  const response=await f.request(path,memberCookie(paid),{method:'HEAD'});assert.equal(response.status,200);assert.equal(await response.text(),'');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/);
 }
 const before=f.sessionCalls();
 for(const [path,body,type]of [['/probe.css',f.css,'text/css'],['/probe.js',f.js,'text/javascript']]){
  const response=await f.request(path,memberCookie(paid));assert.equal(response.status,200);assert.equal(await response.text(),body);assert.match(response.headers.get('content-type'),new RegExp(type));assert.equal(response.headers.get('vary'),null);assert.notEqual(response.headers.get('cache-control'),'private, no-store');
 }
 assert.equal(f.sessionCalls(),before);
});

test('content moves ahead of the sidebar without changing nested article, form or dialog content',()=>{
 const article='<article id="reading-article"><h1>Read the river</h1><div class="reading-copy"><p>A source-linked introduction.</p><details><summary>In this article</summary><div><a href="#sampling">Sampling</a></div></details><section id="sampling"><h2>Sampling</h2><div class="nested-example"><form method="post" action="/suggestions/"><div class="form-fields"><label>Your note<input name="message" value="Gold &amp; gravel"></label><input name="csrf" type="hidden" value="fixture-token"></div><button type="submit">Send note</button></form></div></section></div><dialog id="specimen-dialog" aria-labelledby="specimen-title"><div class="dialog-frame"><div><h2 id="specimen-title">Reference specimen</h2><img src="/images/reference.webp" alt="A documented specimen" width="560" height="400"></div><button type="button" data-dialog-close>Close</button></div></dialog></article>';
 const center='<div class="center" id="main-content">'+article+'</div>';
 const sidebar='<aside class="left"><section class="panel trail-menu"><h2>Old navigation</h2><nav><a href="/articles/">Articles</a></nav></section><section class="gold-price-box"><h2>Gold price</h2><div><p>Price display retained.</p></div></section></aside>';
 const right='<aside class="right"><section><h2>Related reading</h2><div>Related content retained.</div></section></aside>';
 const before='<!doctype html><html><head><title>Reading fixture</title></head><body><main><div class="layout">',after='</div></main></body></html>';
 const html=siteNavigationMarkup(before+sidebar+center+right+after,{path:'/articles/'});
 assert.ok(html.includes(center),'The complete center subtree is preserved byte for byte');
 assert.ok(html.indexOf('id="main-content"')<html.indexOf('<aside class="left">'),'Screen readers encounter the main content before the sidebar');
 assert.ok(html.indexOf('<aside class="left">')<html.indexOf('<aside class="right">'));
 assert.ok(html.includes('<section class="gold-price-box"><h2>Gold price</h2><div><p>Price display retained.</p></div></section>'));
 assert.ok(html.includes(right));
 for(const id of ['reading-article','main-content','specimen-dialog','specimen-title'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' retained once');
 assert.equal(siteNavigationMarkup(html,{path:'/articles/'}),html,'Decorated output is idempotent');
 assert.equal(siteNavigationMarkup(before+center+sidebar+right+after,{path:'/articles/'}),html,'An already content-first layout keeps the same subtree order');
});

test('legacy Creators & Experts URLs permanently redirect to the canonical directory with their query intact',async t=>{
 const f=await fixture(t),query='?q=river%20gold&region=maine&sort=za&topic=river';
 for(const path of ['/creators-experts','/creators-experts/','/creators-experts/index.html'])for(const method of ['GET','HEAD']){
  const response=await f.request(path+query,'',{method});assert.equal(response.status,308,path);assert.equal(response.headers.get('location'),'/prospectors/'+query);assert.equal(await response.text(),'');
 }
});
