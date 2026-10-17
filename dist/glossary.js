// The same word book works with country names, English equivalents and accents omitted.
(()=>{
 const body=document.querySelector('.glossary tbody');if(!body)return;
 const rows=[...body.rows],search=document.querySelector('#term-search'),category=document.querySelector('#term-category');
 const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const searchable=new Map(rows.map(row=>[row,row.textContent+' '+(row.dataset.search||'')]));
 let column=0,direction=1,active=null;
 function closeDefinition(returnFocus=false){
  if(!active)return;
  const entry=active;active=null;entry.dismissed=true;entry.pinned=false;
  entry.button.setAttribute('aria-expanded','false');entry.definition.hidden=true;
  if(returnFocus)entry.button.focus();
 }
 function openDefinition(entry,pinned=false){
  if(active!==entry)closeDefinition();
  active=entry;entry.dismissed=false;entry.pinned=pinned;
  entry.button.setAttribute('aria-expanded','true');entry.definition.hidden=false;
 }
 document.querySelector('.glossary').classList.add('glossary-interactive');
 document.querySelectorAll('.term').forEach(button=>{
  const cell=button.closest('th'),definition=cell.querySelector('.definition');
  const entry={button,cell,definition,pinned:false,dismissed:false};
  const close=document.createElement('button');close.type='button';close.className='definition-close';close.textContent='Close ×';
  close.setAttribute('aria-label','Close definition for '+button.textContent.trim());
  definition.prepend(close);
  close.addEventListener('click',()=>closeDefinition(true));
  button.addEventListener('click',()=>{
   if(active===entry&&entry.pinned)closeDefinition();else openDefinition(entry,true);
  });
  cell.addEventListener('pointerenter',event=>{
   if(event.pointerType==='mouse'&&!active?.pinned)openDefinition(entry);
  });
  cell.addEventListener('pointerleave',()=>{
   if(active===entry&&!entry.pinned&&!cell.contains(document.activeElement))closeDefinition();
   entry.dismissed=false;
  });
  cell.addEventListener('focusin',()=>{if(!entry.dismissed&&active!==entry)openDefinition(entry);});
  cell.addEventListener('focusout',event=>{
   if(!cell.contains(event.relatedTarget)){
    if(active===entry&&!entry.pinned)closeDefinition();entry.dismissed=false;
   }
  });
 });
 document.addEventListener('pointerdown',event=>{
  if(active&&!active.cell.contains(event.target))closeDefinition();
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&active){const returnFocus=active.cell.contains(document.activeElement);event.preventDefault();closeDefinition(returnFocus);}
 });
 function filter(){
  closeDefinition();
  let count=0;const query=normalized(search.value.trim());
  for(const row of rows){
   const match=(!category.value||row.cells[1].textContent===category.value)&&normalized(searchable.get(row)).includes(query);
   row.hidden=!match;if(match)count++;
  }
  document.querySelector('#term-count').textContent=count+' of '+rows.length+' terms';
  document.querySelector('#no-terms').hidden=count!==0;
 }
 const initial=new URLSearchParams(location.search).get('q');if(initial)search.value=initial;
 filter();search.addEventListener('input',filter);category.addEventListener('change',filter);
 document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
  closeDefinition();
  const next=Number(button.dataset.sort);direction=column===next?-direction:1;column=next;
  const value=row=>column===0?row.cells[0].querySelector('button').textContent:row.cells[1].textContent;
  rows.sort((a,b)=>direction*value(a).localeCompare(value(b),'en',{sensitivity:'base'}));
  rows.forEach(row=>body.append(row));
  document.querySelectorAll('[data-sort]').forEach(b=>{
   b.parentElement.setAttribute('aria-sort',b===button?(direction===1?'ascending':'descending'):'none');
   b.querySelector('span').textContent=b===button?(direction===1?'↑':'↓'):'↕';
  });
 }));
})();
