const normalize=text=>String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function matchesCommunity(entry,{query='',region='',kind='',platform=''}={}){
 return normalize(query).trim().split(/\s+/).every(word=>normalize(entry.search).includes(word))&&(!region||entry.region===region)&&(!kind||entry.kind===kind)&&(!platform||entry.platforms.split('|').includes(platform));
}
if(typeof document!=='undefined'){
 const list=document.querySelector('#community-list');
 if(list){
  const cards=[...list.children],form=document.querySelector('.community-controls'),search=document.querySelector('#community-search'),region=document.querySelector('#community-region'),kind=document.querySelector('#community-kind'),platform=document.querySelector('#community-platform'),count=document.querySelector('#community-count');
  const records=new Map(cards.map(card=>[card,{...card.dataset,search:card.querySelector('article').textContent}]));
  function update(){
   for(const card of cards)card.hidden=!matchesCommunity(records.get(card),{query:search.value,region:region.value,kind:kind.value,platform:platform.value});
   const visible=cards.filter(c=>!c.hidden),archives=visible.filter(c=>c.dataset.kind==='Historical archive').length,communities=visible.length-archives;
   count.textContent=`${communities} community ${communities===1?'listing':'listings'} · ${archives} historical ${archives===1?'archive':'archives'}`;
   document.querySelector('#community-empty').hidden=visible.length!==0;
  }
  function clear(){search.value='';region.value='';kind.value='';platform.value='';update();}
  function openLinkedEntry(){const card=cards.find(c=>c.id===location.hash.slice(1));if(!card)return;clear();card.querySelector('details').open=true;card.scrollIntoView({block:'start',behavior:'instant'});card.querySelector('h2').focus({preventScroll:true});}
  form.hidden=false;form.addEventListener('submit',e=>e.preventDefault());search.addEventListener('input',update);
  for(const control of [region,kind,platform])control.addEventListener('change',update);
  form.addEventListener('reset',e=>{e.preventDefault();clear();});addEventListener('hashchange',openLinkedEntry);update();openLinkedEntry();
 }
 const aside=document.querySelector('.left');
 if(aside&&!document.querySelector('.site-mobile-menu')){const menu=document.createElement('details');menu.className='culture-site-nav';menu.open=!matchMedia('(max-width:760px)').matches;const summary=document.createElement('summary');summary.textContent='Explore Gold Trails';menu.append(summary);while(aside.firstChild)menu.append(aside.firstChild);aside.append(menu);}
}
