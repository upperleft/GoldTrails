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
if(typeof document!=='undefined'){
 const list=document.querySelector('#product-list'),items=[...list.children],search=document.querySelector('#product-search'),category=document.querySelector('#product-category'),sort=document.querySelector('#product-sort');
 document.querySelector('.product-controls').hidden=false;
 function update(){
  let count=0;
  for(const item of items){item.hidden=!matchesProduct(item.dataset,search.value,category.value);if(!item.hidden)count++;}
  document.querySelector('#product-count').textContent=`${count} product${count===1?'':'s'}${count!==items.length?' of '+items.length:''}`;
  document.querySelector('#product-empty').hidden=count!==0;
  items.sort((a,b)=>compareProducts(a.dataset,b.dataset,sort.value));items.forEach(item=>list.append(item));
 }
 search.addEventListener('input',update);category.addEventListener('change',update);sort.addEventListener('change',update);
 document.querySelector('#product-reset').addEventListener('click',()=>{search.value='';category.value='';sort.value='name';update();search.focus();});
 function revealHash(){const id=decodeURIComponent(location.hash.slice(1));const item=items.find(row=>row.id===id);if(!item)return;search.value='';category.value='';update();item.querySelector('details').open=true;item.scrollIntoView({block:'start'});}
 window.addEventListener('hashchange',revealHash);if(location.hash)revealHash();update();
}
