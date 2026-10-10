import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesProduct,compareProducts} from '../dist/products.js';
import {createServer} from '../app/server.js';

test('product search combines words, category and creator evidence; sorting is stable by name',()=>{
 const a={name:'Sluice 2',brand:'B',category:'Sluices',search:'Sluice 2 Brand B Klesh river'};
 const b={name:'Sluice 10',brand:'A',category:'Sluices',search:'Sluice 10 Brand A'};
 assert.ok(matchesProduct(a,'  KLESH sluice ','Sluices'));
 assert.ok(!matchesProduct(a,'Klesh shovel',''));
 assert.ok(!matchesProduct(a,'sluice','Detectors'));
 assert.ok(matchesProduct(a,'',''));
 assert.ok(compareProducts(a,b,'name')<0);
 assert.ok(compareProducts(a,b,'name-desc')>0);
 assert.ok(compareProducts(a,b,'brand')>0);
 assert.ok(compareProducts(a,b,'category')<0);
});
test('all supplied products render without a database, with unique anchors and offsite links protected',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../app/product-catalog.json',import.meta.url)));
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const response=await fetch(origin+'/products/');assert.equal(response.status,200);
  const html=await response.text();
  const ids=[...html.matchAll(/class="product-row" id="([^"]+)"/g)].map(m=>m[1]);
  const reports=[...html.matchAll(/href="\/products\/report\/\?product=(GT-P\d+)"/g)].map(m=>m[1]);
  assert.equal(reports.length,57);assert.deepEqual(reports.sort(),catalog.tables.products.map(p=>p.product_id).sort());
  assert.doesNotMatch(html,/mailto:/);
  assert.equal(ids.length,57);assert.equal(new Set(ids).size,57);
  assert.deepEqual(ids.sort(),catalog.tables.products.map(p=>p.product_id).sort());
  for(const match of html.matchAll(/<a\b[^>]*href="https?:[^>]*>/g)){
   assert.match(match[0],/target="_blank"/);assert.match(match[0],/rel="noopener noreferrer"/);
  }
  assert.match(html,/Currency not confirmed/);assert.match(html,/Purchase suggestion only/);
  assert.equal((html.match(/href="\/products\/"/g)||[]).length,1);
  assert.match(html,/href="\/">Gold Trails home/);
  assert.equal((await fetch(origin+'/products',{redirect:'manual'})).status,308);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
