// The same word book works with country names, English equivalents and accents omitted.
(()=>{
 const body=document.querySelector('.glossary tbody');if(!body)return;
 const rows=[...body.rows],search=document.querySelector('#term-search'),category=document.querySelector('#term-category');
 const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const searchable=new Map(rows.map(row=>[row,row.textContent+' '+(row.dataset.search||'')]));
 let column=0,direction=1,active=null;
 const overlay=document.createElement('dialog');overlay.id='glossary-definition-dialog';overlay.className='glossary-definition-dialog';
 overlay.setAttribute('aria-labelledby','glossary-definition-title');
 const header=document.createElement('div');header.className='glossary-definition-header';
 const title=document.createElement('h2');title.id='glossary-definition-title';
 const close=document.createElement('button');close.type='button';close.className='glossary-definition-close';close.textContent='Close ×';close.autofocus=true;
 const content=document.createElement('div');content.className='glossary-definition-content';
 header.append(title,close);overlay.append(header,content);document.body.append(overlay);
 function closeDefinition(){if(overlay.open)overlay.close();}
 function openDefinition(entry){
  if(active===entry&&overlay.open){closeDefinition();return;}
  if(active)active.button.setAttribute('aria-expanded','false');
  active=entry;title.textContent=entry.button.textContent.trim();
  close.setAttribute('aria-label','Close definition for '+title.textContent);
  // Copy the existing authored definition, including its citations; keep the table unchanged.
  content.replaceChildren(...[...entry.definition.childNodes].map(node=>node.cloneNode(true)));
  entry.button.setAttribute('aria-expanded','true');
  document.documentElement.classList.add('glossary-dialog-open');
  if(!overlay.open)overlay.showModal();
  close.focus({preventScroll:true});
 }
 close.addEventListener('click',closeDefinition);
 overlay.addEventListener('close',()=>{
  document.documentElement.classList.remove('glossary-dialog-open');
  if(!active)return;
  const previous=active;active=null;previous.button.setAttribute('aria-expanded','false');
  previous.button.focus({preventScroll:true});
 });
 // Keep Tab cycling through this definition; Escape uses native dialog dismissal.
 overlay.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...overlay.querySelectorAll('button:not([disabled]),a[href]')];
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 overlay.addEventListener('click',event=>{
  if(event.target!==overlay)return;
  const bounds=overlay.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDefinition();
 });
 document.querySelector('.glossary').classList.add('glossary-interactive');
 document.querySelectorAll('.term').forEach(button=>{
  const definition=button.closest('th').querySelector('.definition');
  button.setAttribute('aria-controls',overlay.id);button.setAttribute('aria-haspopup','dialog');
  const entry={button,definition};
  button.addEventListener('click',()=>openDefinition(entry));
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
