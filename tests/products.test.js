import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesProduct,compareProducts} from '../dist/products.js';
import {createServer} from '../app/server.js';
import {approvedProductPhotos,productPhotoLinks} from '../app/product-photos.js';

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
  assert.equal(reports.length,catalog.tables.products.length);assert.deepEqual(reports.sort(),catalog.tables.products.map(p=>p.product_id).sort());
  assert.doesNotMatch(html,/mailto:/);
  assert.equal(ids.length,catalog.tables.products.length);assert.equal(new Set(ids).size,catalog.tables.products.length);
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
test('camp kitchen records retain unique manufacturer relationships and matching blue pieces',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../app/product-catalog.json',import.meta.url))),products=catalog.tables.products,ids=new Set(products.map(p=>p.product_id)),makers=new Set(catalog.tables.manufacturers.map(m=>m.manufacturer_id));
 assert.equal(ids.size,products.length);
 const kitchen=products.filter(p=>p.category==='Camp Kitchen');assert.equal(kitchen.length,6);
 assert.ok(kitchen.every(p=>makers.has(p.manufacturer_id)&&p.date_researched==='2026-10-16'&&p.source_urls===p.official_product_url));
 const mug=products.find(p=>p.product_id==='GT-P0062'),set=products.find(p=>p.product_id==='GT-P0063');
 assert.match(mug.short_description,/Sold individually/);assert.match(set.short_description,/four mugs and an 8-cup coffee percolator/);assert.match(set.official_product_url,/variant=43788007669992/);
});
test('reviewed product photographs use local files, source credits and at most two links per product',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../app/product-photos.json',import.meta.url)));
 assert.equal(approvedProductPhotos('not-a-product').length,0);
 for(const [id,records]of Object.entries(manifest)){
  assert.ok(records.length>=1&&records.length<=2);assert.equal(approvedProductPhotos(id).length,records.length);
  for(const photo of records){assert.match(photo.url,/^\/images\/products\/GT-P\d+-\d+\.webp$/);assert.ok((await readFile(new URL('../dist'+photo.url,import.meta.url))).length>0);assert.match(photo.source_url,/^https:\/\//);assert.ok(photo.credit&&photo.alt);}
 }
 const html=productPhotoLinks({product_id:'GT-P0063',product_name:'<script>bad()</script>'});assert.doesNotMatch(html,/<script>bad/);assert.match(html,/&lt;script&gt;/);assert.match(html,/aria-haspopup="dialog"/);
});
