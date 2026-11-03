import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGoldPriceFeed,normalizeGoldPrice,gramsPerTroyOunce} from '../app/gold-price.js';
import {createServer} from '../app/server.js';

const start=Date.parse('2026-10-11T00:00:00Z');
const data=(now=start)=>({name:'Gold',symbol:'XAU',currency:'USD',price:3100,updatedAt:new Date(now).toISOString()});
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('gold spot conversion uses a troy ounce and rejects invalid units, prices and timestamps',()=>{
 const q=normalizeGoldPrice(data(),start);
 assert.equal(q.currency,'USD');assert.equal(q.perTroyOunce,3100);assert.equal(q.perGram,3100/31.1034768);
 assert.equal(q.source,'Gold API');assert.equal(q.sourceUrl,'https://gold-api.com/');
 for(const invalid of [{...data(),currency:'EUR'},{...data(),symbol:'XAG'},{...data(),price:0},{...data(),price:'3100'},{...data(),price:Infinity},{...data(),gramsPerTroyOunce:28.3495},{...data(),updatedAt:'not a date'},data(start+600_000),data(start-73*3600_000)])assert.throws(()=>normalizeGoldPrice(invalid,start));
});
test('all visitors share a minute cache and concurrent requests use one upstream fetch',async()=>{
 let clock=start,calls=0,release;
 const feed=createGoldPriceFeed({now:()=>clock,fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://api.gold-api.com/price/XAU/USD');assert.deepEqual(Object.keys(options.headers),['Accept']);if(calls===1)await new Promise(r=>release=r);return response(data(clock));}});
 const one=feed(),two=feed();release();assert.deepEqual(await one,await two);assert.equal(calls,1);
 await feed();assert.equal(calls,1);clock+=60_000;assert.equal((await feed()).stale,false);assert.equal(calls,2);
});
test('an outage retains a real quote marked delayed, backs off, and recovers',async()=>{
 let clock=start,calls=0,fail=false;
 const feed=createGoldPriceFeed({now:()=>clock,fetchImpl:async()=>{calls++;if(fail)throw Error('Upstream failure');return response(data(clock));}});
 const first=await feed();fail=true;clock+=60_000;const stale=await feed();assert.equal(stale.stale,true);assert.equal(stale.asOf,first.asOf);assert.equal(stale.perGram,first.perGram);
 await feed();assert.equal(calls,2);fail=false;clock+=60_000;assert.equal((await feed()).stale,false);
});
test('unknown, malformed and expired prices stay unavailable instead of inventing a value',async()=>{
 let clock=start,calls=0;
 const empty=createGoldPriceFeed({now:()=>clock,fetchImpl:async()=>{calls++;return response({symbol:'XAU',currency:'USD',price:123});}});
 await assert.rejects(empty());await assert.rejects(empty());assert.equal(calls,1);
 const old=createGoldPriceFeed({now:()=>clock,fetchImpl:async()=>response(data(start))});await old();clock+=16*60_000;assert.equal((await old()).stale,true);clock+=73*3600_000;await assert.rejects(old());
});
test('public price endpoint serves attributed JSON without member sessions and refuses mutations',async()=>{
 let calls=0;const quote={...normalizeGoldPrice(data(),start),stale:false};
 const server=createServer({goldPrice:async()=>{calls++;return quote;},members:async()=>{throw Error('Must not load member data');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const res=await fetch(base+'/api/gold-price/');assert.equal(res.status,200);assert.deepEqual(await res.json(),quote);assert.equal(res.headers.get('set-cookie'),null);assert.match(res.headers.get('cache-control'),/public/);
  const head=await fetch(base+'/api/gold-price/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  const post=await fetch(base+'/api/gold-price/',{method:'POST'});assert.equal(post.status,405);assert.equal(calls,2);
 }finally{await new Promise(r=>server.close(r));}
});
test('feed failure returns a retryable JSON error without leaking upstream diagnostics',async()=>{
 const server=createServer({goldPrice:async()=>{throw Error('Private upstream diagnostic');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/gold-price/');assert.equal(res.status,503);assert.equal(res.headers.get('retry-after'),'60');assert.doesNotMatch(await res.text(),/Private upstream/);}finally{await new Promise(r=>server.close(r));}
});
test('static and server-rendered pages load the versioned price widget',()=>{
 for(const path of ['app/page-shell.html','dist/index.html','dist/articles/index.html','dist/glossary/index.html','dist/products/index.html'])assert.match(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/src="\/gold-price.js\?v=/);
});

function browserPriceFixture({wide=true,withSlot=true}={}){
 const classes=new Set(),windowEvents=new Map(),documentEvents=new Map();let mediaChange,bodyChange,creates=0,fetches=0;
 const container=()=>({children:[],append(node){if(node.parentNode){const siblings=node.parentNode.children;siblings.splice(siblings.indexOf(node),1);}this.children.push(node);node.parentNode=this;}});
 const menu=container(),slot=withSlot?container():null;
 const fields=Object.fromEntries(['[data-gold-ounce]','[data-gold-gram]','.gold-price-status','.gold-price-date','time'].map(selector=>[selector,{textContent:'',hidden:false}]));
 const box={parentNode:null,innerHTML:'',setAttribute(){},querySelector:selector=>fields[selector]};
 const body={classList:{contains:name=>classes.has(name)}};
 const media={matches:wide,addEventListener(name,callback){if(name==='change')mediaChange=callback;}};
 const doc={body,hidden:false,querySelector:selector=>selector==='.left .trail-menu'?menu:selector==='.home-gold-price-slot'?slot:null,createElement(){creates++;return box;},addEventListener(name,callback){documentEvents.set(name,callback);}};
 const win={matchMedia:()=>media,addEventListener(name,callback){windowEvents.set(name,callback);}};
 const quote={currency:'USD',perTroyOunce:3100,perGram:3100/gramsPerTroyOunce,asOf:new Date().toISOString(),stale:false};
 vm.runInNewContext(readFileSync(new URL('../dist/gold-price.js',import.meta.url),'utf8'),{document:doc,window:win,Date,Intl,AbortSignal,setTimeout:()=>1,clearTimeout:()=>{},MutationObserver:class{constructor(callback){bodyChange=callback;}observe(){}},fetch:async()=>{fetches++;return {ok:true,json:async()=>quote};}});
 return {menu,slot,box,fields,created:()=>creates,fetches:()=>fetches,setWide(value){media.matches=value;mediaChange?.();},setTextMode(value){if(value)classes.add('home-text-mode');else classes.delete('home-text-mode');bodyChange?.();},resize(){windowEvents.get('resize')?.();}};
}

test('one price widget moves between illustrated and classic home without another fetch or losing its quote',async()=>{
 const f=browserPriceFixture();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.box.parentNode,f.slot);assert.equal(f.created(),1);assert.equal(f.fetches(),1);assert.equal(f.fields['[data-gold-ounce]'].textContent,'$3,100.00');
 const rendered={ounce:f.fields['[data-gold-ounce]'].textContent,gram:f.fields['[data-gold-gram]'].textContent,time:f.fields.time.textContent};
 f.setTextMode(true);assert.equal(f.box.parentNode,f.menu);assert.equal(f.slot.children.length,0);
 f.setTextMode(false);assert.equal(f.box.parentNode,f.slot);assert.equal(f.menu.children.length,0);
 f.setWide(false);assert.equal(f.box.parentNode,f.menu);f.resize();assert.equal(f.menu.children.length,1);
 f.setWide(true);assert.equal(f.box.parentNode,f.slot);f.resize();assert.equal(f.slot.children.length,1);
 assert.equal(f.created(),1);assert.equal(f.fetches(),1);assert.deepEqual({ounce:f.fields['[data-gold-ounce]'].textContent,gram:f.fields['[data-gold-gram]'].textContent,time:f.fields.time.textContent},rendered);
 assert.equal((f.box.innerHTML.match(/<a\b/g)||[]).length,1,'The moved widget retains one source link');
});

test('narrow screens and pages without an illustrated slot retain the existing classic widget',async()=>{
 const narrow=browserPriceFixture({wide:false});await new Promise(resolve=>setImmediate(resolve));assert.equal(narrow.box.parentNode,narrow.menu);narrow.setWide(true);assert.equal(narrow.box.parentNode,narrow.slot);
 const ordinary=browserPriceFixture({withSlot:false});await new Promise(resolve=>setImmediate(resolve));assert.equal(ordinary.box.parentNode,ordinary.menu);ordinary.resize();assert.equal(ordinary.menu.children.length,1);assert.equal(ordinary.created(),1);assert.equal(ordinary.fetches(),1);
});
