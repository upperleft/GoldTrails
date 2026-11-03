export function matchesProduct(item,query,category){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return (!category||item.category===category)&&words.every(word=>item.search.toLocaleLowerCase().includes(word));
}
export function compareProducts(a,b,mode){
 const name=()=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
 if(mode==='name-desc')return -name();
 if(mode==='brand'||mode==='category')return a[mode].localeCompare(b[mode],undefined,{sensitivity:'base'})||name();
 return name();
}
export function productFilters(params,categories){
 const requested=params.get('category')||'',mode=params.get('sort')||'name';
 return {query:(params.get('q')||'').slice(0,200).trim(),category:categories.includes(requested)?requested:'',sort:['name','name-desc','brand','category'].includes(mode)?mode:'name'};
}
export function productFilterUrl({query='',category='',sort='name'}={}){
 const params=new URLSearchParams();if(query.trim())params.set('q',query.trim());if(category)params.set('category',category);if(sort!=='name')params.set('sort',sort);
 return '/products/'+(params.size?'?'+params.toString():'');
}
export function initializeProductCatalog(doc,view){
 const list=doc.querySelector('#product-list');if(!list)return;
 const items=[...list.children],search=doc.querySelector('#product-search'),category=doc.querySelector('#product-category'),sort=doc.querySelector('#product-sort'),tabs=[...doc.querySelectorAll('[data-product-category]')];
 const categories=[...new Set(items.map(item=>item.dataset.category))];
 doc.querySelector('.product-controls').hidden=false;
 const state=()=>({query:search.value,category:category.value,sort:sort.value});
 function update(historyMode){
  let count=0;
  for(const item of items){item.hidden=!matchesProduct(item.dataset,search.value,category.value);if(!item.hidden)count++;}
  doc.querySelector('#product-count').textContent=`${count} product${count===1?'':'s'}${count!==items.length?' of '+items.length:''}`;
  doc.querySelector('#product-empty').hidden=count!==0;
  items.sort((a,b)=>compareProducts(a.dataset,b.dataset,sort.value));items.forEach(item=>list.append(item));
  for(const tab of tabs){const selected=tab.dataset.productCategory===category.value;if(selected)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');tab.setAttribute('href',productFilterUrl({...state(),category:tab.dataset.productCategory}));}
  if(historyMode){const next=productFilterUrl(state());if(next!==view.location.pathname+view.location.search+view.location.hash)view.history[historyMode+'State'](null,'',next);}
 }
 function restore(){const filters=productFilters(new URLSearchParams(view.location.search),categories);search.value=filters.query;category.value=filters.category;sort.value=filters.sort;update();}
 search.addEventListener('input',()=>update('replace'));category.addEventListener('change',()=>update('push'));sort.addEventListener('change',()=>update('push'));
 for(const tab of tabs)tab.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();category.value=tab.dataset.productCategory;update('push');});
 doc.querySelector('#product-reset').addEventListener('click',()=>{search.value='';category.value='';sort.value='name';update('push');search.focus();});
 function revealHash(){let id;try{id=decodeURIComponent(view.location.hash.slice(1));}catch{return;}const item=items.find(row=>row.id===id);if(!item)return;search.value='';category.value='';update();item.querySelector('details').open=true;item.scrollIntoView({block:'start'});}
 view.addEventListener('popstate',()=>{restore();if(view.location.hash)revealHash();});view.addEventListener('hashchange',revealHash);restore();if(view.location.hash)revealHash();
}
if(typeof document!=='undefined')initializeProductCatalog(document,window);
