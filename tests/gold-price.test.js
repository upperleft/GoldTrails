import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGoldPriceFeed,normalizeGoldPrice,gramsPerTroyOunce} from '../app/gold-price.js';
import {createServer} from '../app/server.js';

const start=Date.parse('2026-10-11T00:00:00Z');
const data=(now=start)=>({base:'USD',metals:{gold:3100},updated:new Date(now).toISOString(),gramsPerTroyOunce});
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('gold spot conversion uses a troy ounce and rejects invalid units, prices and timestamps',()=>{
 const q=normalizeGoldPrice(data(),start);
 assert.equal(q.currency,'USD');assert.equal(q.perTroyOunce,3100);assert.equal(q.perGram,3100/31.1034768);
 for(const invalid of [{...data(),base:'EUR'},{...data(),metals:{gold:0}},{...data(),metals:{gold:'3100'}},{...data(),metals:{gold:Infinity}},{...data(),gramsPerTroyOunce:28.3495},{...data(),updated:'not a date'},data(start+600_000),data(start-73*3600_000)])assert.throws(()=>normalizeGoldPrice(invalid,start));
});
test('all visitors share a minute cache and concurrent requests use one upstream fetch',async()=>{
 let clock=start,calls=0,release;
 const feed=createGoldPriceFeed({now:()=>clock,fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://goldpricezone.com/api/public/widget-data');assert.deepEqual(Object.keys(options.headers),['Accept']);if(calls===1)await new Promise(r=>release=r);return response(data(clock));}});
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
 const empty=createGoldPriceFeed({now:()=>clock,fetchImpl:async()=>{calls++;return response({base:'USD',metals:{gold:123}});}});
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
