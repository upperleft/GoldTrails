import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {goldGames,goldGamesSummary} from '../app/gold-games/catalog.js';
import {renderGoldGamesPage} from '../app/gold-games/page.js';
import {gameFilters,gameFilterUrl,filterGames,initializeGoldGames,gameFormats,gamePlatforms,gameCosts,gameStatuses} from '../dist/gold-games.js';
import {siteNavigationMarkup,navigationLinks} from '../app/site-navigation.js';
import {createServer} from '../app/server.js';

const filter=params=>gameFilters(new URLSearchParams(params));
const all=()=>filter({older:'1'});

test('catalog keeps independent identities, cross-format editions, and explicit unknown fields',()=>{
 assert.equal(goldGames.length,56);
 assert.equal(new Set(goldGames.map(game=>game.id)).size,goldGames.length);
 assert.equal(goldGames.filter(game=>game.id==='D20').length,0,'Definitive Edition belongs to the D10 family');
 for(const game of goldGames){
  for(const format of game.formats)assert.ok(Object.hasOwn(gameFormats,format),game.id+' format');
  for(const platform of game.platforms)assert.ok(Object.hasOwn(gamePlatforms,platform),game.id+' platform');
  assert.ok(Object.hasOwn(gameCosts,game.cost),game.id+' cost');assert.ok(Object.hasOwn(gameStatuses,game.availability),game.id+' availability');
  assert.ok(game.sources.length>0,game.id+' evidence');
  for(const source of game.sources){assert.match(source.url,/^https:\/\//);assert.match(source.reviewedAt,/^\d{4}-\d{2}-\d{2}$/);assert.ok(source.note);}
  for(const group of [game.age,{minimum:game.players.min},{minimum:game.players.max},{minimum:game.minutes.min},{minimum:game.minutes.max}])assert.ok(group.minimum===null || Number.isFinite(group.minimum),game.id+' unknown numeric value');
 }
 for(const id of ['A11','A12','A13','A19'])assert.deepEqual(goldGames.find(game=>game.id===id).formats.slice().sort(),['board','browser']);
 assert.ok(Object.values(goldGamesSummary().formats).reduce((sum,count)=>sum+count,0)>goldGames.length,'Overlapping formats do not inflate total identities');
});

test('search recognizes aliases and keeps separate Gold Rush families distinct',()=>{
 assert.deepEqual(filterGames(goldGames,{...all(),query:'Gold Rush: The Game'}).map(game=>game.id),['D10']);
 assert.ok(filterGames(goldGames,{...all(),query:'Diamant'}).some(game=>game.id==='A19'));
 assert.ok(filterGames(goldGames,{...all(),query:'zz-no-such-game-zz'}).length===0);
});

test('filters preserve unknown ages, inclusive player ranges, multiple formats and archive opt-in',()=>{
 const unknown=filterGames(goldGames,{...all(),age:'unknown'});assert.ok(unknown.length);assert.ok(unknown.every(game=>game.age.minimum===null));
 const eight=filterGames(goldGames,{...all(),age:'8'});assert.ok(eight.length);assert.ok(eight.every(game=>game.age.minimum!==null&&game.age.minimum<=8));
 const solo=filterGames(goldGames,{...all(),players:'solo'});assert.ok(solo.length);assert.ok(solo.every(game=>game.players.min!==null&&game.players.min<=1&&game.players.max>=1));
 const boardBrowser=filterGames(goldGames,{...all(),formats:['board','browser']});assert.equal(new Set(boardBrowser.map(game=>game.id)).size,boardBrowser.length);
 const current=filterGames(goldGames,gameFilters());assert.ok(current.every(game=>!['upcoming','older','unavailable','delisted'].includes(game.availability)));
 assert.ok(!current.some(game=>game.id==='D19'));assert.ok(filterGames(goldGames,all()).some(game=>game.id==='D19'));
 assert.equal(filterGames(goldGames,{...all(),device:'ios',cost:'freemium'}).every(game=>game.platforms.includes('ios')&&game.cost==='freemium'),true);
});

test('URL parsing bounds inputs, validates options and round-trips state',()=>{
 const invalid=filter({q:'  gold  ',format:'made-up',device:'made-up',age:'0',players:'100',cost:'made-up',older:'true'});
 assert.deepEqual(invalid,{query:'gold',formats:[],device:'',age:'',players:'',cost:'',includeOlder:false});
 const params=new URLSearchParams('format=board&format=browser&format=board&q=gold&age=8&players=two&device=browser&cost=paid&older=1');
 const filters=gameFilters(params);assert.deepEqual(filters.formats,['board','browser']);
 assert.deepEqual(gameFilters(new URL(gameFilterUrl(filters),'https://goldtrails.org').searchParams),filters);
 assert.equal(filter({q:'x'.repeat(500)}).query.length,200);
});

test('rendered directory has honest archive actions, source dates, past events and readable fallback',()=>{
 const html=renderGoldGamesPage(),archived=renderGoldGamesPage(goldGames,new URLSearchParams({older:'1'}));
 assert.equal((html.match(/data-game-id=/g)||[]).length,goldGames.length);
 assert.match(html,/<link rel="canonical" href="https:\/\/goldtrails.org\/gold-games\/">/);
 assert.match(html,/<noscript>[\s\S]*All 56 researched entries/);assert.match(html,/U\.S\. Mint Gold Rush/);
 assert.ok(!archived.includes('>Play now<'));
 for(const id of ['D19','D21','D22'])assert.match(html,new RegExp('id="game-'+id+'"[^>]* hidden'));
 for(const id of ['R02','R03','R05']){
  const card=archived.match(new RegExp('<li class="games-card" id="game-'+id+'"[\\s\\S]*?<\\/li>'))?.[0];
  assert.ok(card?.includes('Past event example'),id+' past date label');assert.ok(card?.includes('Next edition not confirmed'),id+' no invented future date');
 }
 assert.match(html,/Store content rating/);assert.match(html,/Publisher age guidance/);
 const legacyMacCard=html.match(/<li class="games-card" id="game-D13"[\s\S]*?<\/li>/)[0];assert.ok(legacyMacCard.indexOf('Apple Silicon compatibility were not verified')<legacyMacCard.indexOf('<details'),'Legacy compatibility is visible before collapsed sources');
 assert.equal((html.match(/<h3>(Backyard Nugget Hunt|Paydirt Recovery Challenge|Team Panning Relay)<\/h3>/g)||[]).length,3);
 const json=JSON.parse(html.match(/id="gold-games-data">([\s\S]*?)<\/script>/)[1]);assert.equal(json.length,goldGames.length);
});

function element(value=''){
 const listeners=new Map();
 return {value,checked:false,hidden:false,textContent:'',dataset:{},focused:false,addEventListener(name,callback){listeners.set(name,callback);},fire(name,extra={}){const event={button:0,preventDefault(){this.prevented=true;},...extra};listeners.get(name)?.(event);return event;},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};
}
function browserFixture(initial='/gold-games/'){
 const controls=Object.fromEntries(['q','device','age','players','cost','older'].map(name=>[name,element()]));
 const formats=Object.keys(gameFormats).map(value=>Object.assign(element(value),{name:'format'}));
 const form=element();form.elements={namedItem:name=>controls[name]};form.querySelectorAll=selector=>selector.endsWith(':checked')?formats.filter(input=>input.checked):formats;
 const count=element(),empty=element(),resetEmpty=element(),print=element(),directory=element();
 const cards=goldGames.map(game=>Object.assign(element(),{dataset:{gameId:game.id}}));
 const links=Object.keys(gameFormats).map(value=>Object.assign(element(),{search:'?format='+value}));
 const nodes={'#games-filters':form,'#gold-games-data':{textContent:JSON.stringify(goldGames)},'#games-count':count,'#games-empty':empty,'#games-reset-empty':resetEmpty,'#games-print':print,'#games-directory':directory};
 const doc={querySelector:selector=>nodes[selector],querySelectorAll:selector=>selector==='[data-game-id]'?cards:links};
 let location=new URL(initial,'https://goldtrails.org');const events=new Map(),history=[];let printed=false;
 const view={get location(){return location;},history:{pushState(_state,_title,url){location=new URL(url,location);history.push(url);},replaceState(_state,_title,url){location=new URL(url,location);}},addEventListener(name,callback){events.set(name,callback);},print(){printed=true;}};
 initializeGoldGames(doc,view);
 return {controls,formats,form,count,empty,resetEmpty,print,cards,links,view,history,visible:()=>cards.filter(card=>!card.hidden).map(card=>card.dataset.gameId),visit(url,event='popstate'){location=new URL(url,location);events.get(event)?.();},printed:()=>printed};
}

test('actual browser handlers combine search, filters, reset, empty state, URL history and print',()=>{
 const f=browserFixture('/gold-games/?q=Gold+Rush%3A+The+Game');assert.deepEqual(f.visible(),['D10']);assert.equal(f.form.hidden,false);assert.equal(f.print.hidden,false);
 f.controls.q.value='no-such-game';f.form.fire('input',{target:{name:'q'}});assert.equal(f.empty.hidden,false);assert.equal(f.count.textContent,'0 entries of 56');
 f.resetEmpty.fire('click');assert.equal(f.controls.q.focused,true);assert.equal(f.empty.hidden,true);assert.ok(f.visible().length>0);assert.equal(f.view.location.search,'');
 f.formats.find(input=>input.value==='browser').checked=true;f.controls.cost.value='free';f.form.fire('change');
 assert.ok(f.visible().includes('D01'));assert.ok(!f.visible().includes('D10'));assert.equal(f.view.location.search,'?format=browser&cost=free');
 f.controls.older.checked=true;f.form.fire('change');f.controls.q.value='Gold Hunter';f.form.fire('input',{target:{name:'q'}});assert.equal(f.visible().length,0,'Other active filters remain in force');
 f.form.fire('reset');assert.equal(f.controls.older.checked,false);assert.equal(f.controls.cost.value,'');assert.ok(f.formats.every(input=>!input.checked));
 f.visit('/gold-games/?older=1&q=Gold+Hunter');assert.deepEqual(f.visible(),['D19']);assert.equal(f.controls.older.checked,true);
 f.print.fire('click');assert.equal(f.printed(),true);
});

test('format shortcuts, modifier clicks and direct hidden-entry anchors remain usable',()=>{
 const f=browserFixture();const board=f.links[0];assert.equal(board.fire('click',{metaKey:true}).prevented,undefined);
 assert.equal(board.fire('click').prevented,true);assert.deepEqual(f.formats.filter(input=>input.checked).map(input=>input.value),['board']);
 f.visit('/gold-games/?q=no-match#game-D19','hashchange');assert.equal(f.cards.find(card=>card.dataset.gameId==='D19').hidden,false);assert.equal(f.controls.older.checked,true);assert.equal(f.controls.q.value,'');
 assert.equal(f.view.location.hash,'#game-D19');f.controls.q.value='Saboteur';f.form.fire('input',{target:{name:'q'}});assert.equal(f.view.location.hash,'','New filtering clears a previous entry anchor so history can restore the filters');
});

test('secondary discovery links preserve primary menus and appear on article index and footer',()=>{
 const fixture='<!doctype html><html><head></head><body><main><aside class="left"><section class="panel trail-menu">Old links</section></aside><div class="center"><h1>Articles</h1></div></main><footer><p>Footer</p></footer></body></html>';
 const html=siteNavigationMarkup(fixture,{path:'/articles/'});
 assert.match(html,/<details class="site-resource-menu"><summary>Gold Fun &amp; Finds<\/summary><nav aria-label="Gold Fun &amp; Finds"><a href="\/gold-games\/">Gold Games<\/a>/);
 assert.match(html,/<p class="site-games-discovery">Learning together\?/);
 assert.ok(!navigationLinks('/articles/').includes('/gold-games/'),'No extra primary menu item');
 assert.equal(siteNavigationMarkup(html,{path:'/articles/'}),html,'Navigation stays idempotent');
});

test('free static route serves canonical HTML and HEAD without member or database access',async t=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'gold-games-http-')));await mkdir(join(root,'gold-games'));await writeFile(join(root,'gold-games/index.html'),renderGoldGamesPage());
 const server=createServer({root,goldPrice:async()=>({}),log:()=>{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 const redirect=await fetch(base+'/gold-games?q=gold',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/gold-games/?q=gold');
 const response=await fetch(base+'/gold-games/');assert.equal(response.status,200);assert.match(await response.text(),/<h1>Gold Games<\/h1>/);
 const head=await fetch(base+'/gold-games/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});
