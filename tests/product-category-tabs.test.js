import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeProductCatalog,productFilters,productFilterUrl} from '../dist/products.js';
import {productCatalog,renderProductsPage} from '../app/products-page.js';

function element(value=''){
 const listeners=new Map(),attributes=new Map();
 return {value,hidden:false,textContent:'',dataset:{},focused:false,
  addEventListener(name,callback){listeners.set(name,callback);},
  fire(name,extra={}){const event={button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};listeners.get(name)?.(event);return event;},
  setAttribute(name,value){attributes.set(name,value);},removeAttribute(name){attributes.delete(name);},getAttribute(name){return attributes.get(name)??null;},focus(){this.focused=true;}};
}
function fixture(initial='/products/'){
 const rows=[
  {id:'mug-1',dataset:{name:'Camp Mug',brand:'B',category:'Camp Kitchen',search:'camp mug steel'}},
  {id:'sluice',dataset:{name:'Mini Sluice',brand:'A',category:'Sluices',search:'goldhog mini sluice'}},
  {id:'mug-2',dataset:{name:'Enamel Mug',brand:'A',category:'Camp Kitchen',search:'blue enamel camp mug'}}
 ].map(item=>({...item,hidden:false,details:{open:false},querySelector(){return this.details;},scrollIntoView(){this.scrolled=true;}}));
 const list={children:[...rows],append(item){this.children.splice(this.children.indexOf(item),1);this.children.push(item);}};
 const search=element(),category=element(),sort=element('name'),count=element(),empty=element(),reset=element(),controls=element();
 const tabs=['','Camp Kitchen','Sluices'].map(name=>Object.assign(element(),{dataset:{productCategory:name}}));
 const elements={'#product-list':list,'#product-search':search,'#product-category':category,'#product-sort':sort,'#product-count':count,'#product-empty':empty,'#product-reset':reset,'.product-controls':controls};
 let location=new URL(initial,'https://goldtrails.org');const events=new Map(),history=[];
 const view={get location(){return location;},history:{pushState(_state,_title,url){location=new URL(url,location);history.push(url);},replaceState(_state,_title,url){location=new URL(url,location);}},addEventListener(name,callback){events.set(name,callback);}};
 const doc={querySelector:selector=>elements[selector],querySelectorAll:()=>tabs};
 initializeProductCatalog(doc,view);
 return {rows,list,search,category,sort,count,empty,reset,controls,tabs,view,history,visit(url,event='popstate'){location=new URL(url,location);events.get(event)?.();}};
}

test('native category pages retain all records while showing the selected category and search',()=>{
 const products=productCatalog(),params=new URLSearchParams({category:'Camp Kitchen',q:'mug',sort:'name-desc'});
 const html=renderProductsPage(products,'',params);
 const rows=[...html.matchAll(/<li class="product-row"[^>]+>/g)];
 assert.equal(rows.length,products.length);
 const visible=rows.filter(row=>!/\shidden[ >]/.test(row[0]));
 assert.deepEqual(visible.map(row=>row[0].match(/id="([^"]+)"/)[1]).sort(),['GT-P0062','GT-P0063']);
 assert.match(html,/data-product-category="Camp Kitchen" aria-current="page"/);
 assert.equal((html.match(/data-product-category=/g)||[]).length,new Set(products.map(p=>p.category)).size+1);
 assert.match(html,/value="Camp Kitchen" selected/);assert.match(html,/value="name-desc" selected/);assert.match(html,/value="mug"/);
 assert.match(html,/id="product-count"[^>]*>2 products of 63/);
 assert.ok(!html.includes('role="tab"'),'Links retain native keyboard navigation');
});

test('category navigation comes from researched records and ignores unknown category URLs',()=>{
 const products=productCatalog(),future={...products[0],product_id:'TEST-FOOD',product_name:'Fictional food fixture',category:'Gold Foods'};
 assert.ok(!renderProductsPage(products).includes('data-product-category="Gold Foods"'));
 assert.match(renderProductsPage([...products,future]),/data-product-category="Gold Foods"/);
 assert.equal(productFilters(new URLSearchParams({category:'Missing',sort:'invented'}),['Camp Kitchen']).category,'');
 assert.deepEqual(productFilters(new URLSearchParams({q:'  mug  ',sort:'invented'}),[]),{query:'mug',category:'',sort:'name'});
 assert.equal(productFilterUrl({query:' mug ',category:'Camp Kitchen',sort:'brand'}),'/products/?q=mug&category=Camp+Kitchen&sort=brand');
});

test('category links, search, sort, select and Clear share the same visible results and URL state',()=>{
 const f=fixture('/products/?category=Camp+Kitchen&q=mug&sort=name-desc');
 assert.equal(f.controls.hidden,false);assert.equal(f.category.value,'Camp Kitchen');assert.equal(f.sort.value,'name-desc');
 assert.deepEqual(f.list.children.filter(row=>!row.hidden).map(row=>row.id),['mug-2','mug-1']);
 assert.equal(f.tabs[1].getAttribute('aria-current'),'page');
 assert.equal(f.tabs[2].fire('click').defaultPrevented,true);
 assert.equal(f.category.value,'Sluices');assert.equal(f.search.value,'mug');assert.equal(f.empty.hidden,false);
 f.search.value='mini';f.search.fire('input');assert.deepEqual(f.rows.filter(row=>!row.hidden).map(row=>row.id),['sluice']);
 assert.equal(f.count.textContent,'1 product of 3');assert.equal(f.empty.hidden,true);
 assert.equal(f.view.location.search,'?q=mini&category=Sluices&sort=name-desc');
 f.category.value='Camp Kitchen';f.category.fire('change');assert.equal(f.tabs[1].getAttribute('aria-current'),'page');assert.equal(f.empty.hidden,false);
 f.reset.fire('click');assert.equal(f.view.location.href,'https://goldtrails.org/products/');assert.equal(f.tabs[0].getAttribute('aria-current'),'page');
 assert.ok(f.rows.every(row=>!row.hidden));assert.equal(f.sort.value,'name');assert.equal(f.search.focused,true);
});

test('history navigation restores filters and modified clicks keep native link behavior',()=>{
 const f=fixture();f.search.value='mug';f.search.fire('input');f.tabs[1].fire('click');
 const before=f.view.location.href,event=f.tabs[2].fire('click',{metaKey:true});
 assert.equal(event.defaultPrevented,false);assert.equal(f.view.location.href,before);
 assert.equal(f.tabs[2].getAttribute('href'),'/products/?q=mug&category=Sluices');
 f.visit('/products/?category=Sluices&q=goldhog&sort=brand');
 assert.equal(f.search.value,'goldhog');assert.equal(f.category.value,'Sluices');assert.equal(f.sort.value,'brand');
 assert.deepEqual(f.rows.filter(row=>!row.hidden).map(row=>row.id),['sluice']);
 f.visit('/products/?category=Camp+Kitchen#sluice','hashchange');
 assert.equal(f.category.value,'');assert.equal(f.search.value,'');assert.equal(f.rows[1].details.open,true);assert.equal(f.rows[1].hidden,false);
});
