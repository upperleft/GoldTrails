// The same word book works with country names, English equivalents and accents omitted.
(()=>{
 const body=document.querySelector('.glossary tbody');if(!body)return;
 const rows=[...body.rows],search=document.querySelector('#term-search'),category=document.querySelector('#term-category');
 const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let column=0,direction=1;
 function filter(){
  let count=0;const query=normalized(search.value.trim());
  for(const row of rows){
   const match=(!category.value||row.cells[1].textContent===category.value)&&normalized(row.textContent+' '+(row.dataset.search||'')).includes(query);
   row.hidden=!match;if(match)count++;
  }
  document.querySelector('#term-count').textContent=count+' of '+rows.length+' terms';
  document.querySelector('#no-terms').hidden=count!==0;
 }
 const initial=new URLSearchParams(location.search).get('q');if(initial)search.value=initial;
 filter();search.addEventListener('input',filter);category.addEventListener('change',filter);
 document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
  const next=Number(button.dataset.sort);direction=column===next?-direction:1;column=next;
  const value=row=>column===0?row.cells[0].querySelector('button').textContent:row.cells[1].textContent;
  rows.sort((a,b)=>direction*value(a).localeCompare(value(b),'en',{sensitivity:'base'}));
  rows.forEach(row=>body.append(row));
  document.querySelectorAll('[data-sort]').forEach(b=>{
   b.parentElement.setAttribute('aria-sort',b===button?(direction===1?'ascending':'descending'):'none');
   b.querySelector('span').textContent=b===button?(direction===1?'↑':'↓'):'↕';
  });
 }));
 document.querySelectorAll('.term').forEach(button=>{
  button.addEventListener('click',()=>{
   const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.closest('th').querySelector('.definition').hidden=!open;
  });
  button.addEventListener('keydown',event=>{
   if(event.key==='Escape'){
    button.setAttribute('aria-expanded','false');button.closest('th').querySelector('.definition').hidden=true;button.blur();
   }
  });
 });
})();
