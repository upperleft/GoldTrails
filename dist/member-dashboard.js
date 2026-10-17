(() => {
 const root=document.querySelector('[data-member-dashboard]');if(!root)return;
 const form=root.querySelector('[data-layout-form]'),grid=root.querySelector('.dashboard-module-grid'),status=root.querySelector('[data-layout-status]'),demo=root.dataset.demo==='true',key='gold-trails-dashboard-demo-v1';
 const ids=root.dataset.defaultOrder.split(','),cards=new Map([...grid.children].map(c=>[c.dataset.module,c])),field=name=>form.elements.namedItem(name);
 const sections=root.querySelector('[data-desk-sections]'),sectionButtons=[...sections.querySelectorAll('[data-desk-section]')],empty=root.querySelector('[data-desk-empty]'),sectionStatus=root.querySelector('[data-section-status]');let activeGroup='personal';
 const shown=value=>value.order.filter(id=>!value.hidden.includes(id)&&(activeGroup==='all'||cards.get(id).dataset.group===activeGroup));
 function filterSections(value){
  const visible=shown(value);
  for(const [id,card] of cards){card.toggleAttribute('data-group-hidden',activeGroup!=='all'&&card.dataset.group!==activeGroup);card.querySelector('[data-move="up"]').disabled=visible.indexOf(id)<=0;card.querySelector('[data-move="down"]').disabled=visible.indexOf(id)===visible.length-1;}
  for(const button of sectionButtons){const group=button.dataset.deskSection;button.setAttribute('aria-pressed',String(group===activeGroup));button.querySelector('[data-section-count]').textContent=String(value.order.filter(id=>!value.hidden.includes(id)&&(group==='all'||cards.get(id).dataset.group===group)).length);}
  empty.hidden=visible.length>0;
 }
 const valid=v=>v&&v.version===1&&Array.isArray(v.order)&&v.order.length===ids.length&&new Set(v.order).size===ids.length&&v.order.every(id=>ids.includes(id))&&Array.isArray(v.hidden)&&new Set(v.hidden).size===v.hidden.length&&v.hidden.every(id=>ids.includes(id));
 const read=()=>({version:1,order:ids.slice().sort((a,b)=>Number(field('position_'+a).value)-Number(field('position_'+b).value)),hidden:ids.filter(id=>!field('visible_'+id).checked)});
 function apply(value){if(!valid(value))return;value.order.forEach((id,i)=>{field('position_'+id).value=String(i+1);field('visible_'+id).checked=!value.hidden.includes(id);const c=cards.get(id);c.hidden=value.hidden.includes(id);grid.append(c);});filterSections(value);}
 const changed=()=>{apply(read());status.textContent='Desk rearranged. Choose Save layout to keep these changes.';};
 root.querySelectorAll('.dashboard-move-controls,[data-show-all]').forEach(el=>el.hidden=false);
 root.querySelectorAll('[data-demo-action]').forEach(el=>el.disabled=false);
 if(demo){try{const saved=JSON.parse(localStorage.getItem(key));if(valid(saved))apply(saved);else apply(read());}catch{apply(read());}}else apply(read());
 form.addEventListener('change',event=>{if(event.target.name.startsWith('position_')){const id=event.target.name.slice(9),value={version:1,order:[...grid.children].map(c=>c.dataset.module),hidden:ids.filter(x=>!field('visible_'+x).checked)},index=Number(event.target.value)-1;value.order.splice(value.order.indexOf(id),1);value.order.splice(index,0,id);apply(value);}changed();});
 root.querySelector('[data-show-all]').addEventListener('click',()=>{ids.forEach(id=>field('visible_'+id).checked=true);changed();});
 sections.hidden=false;
 for(const button of sectionButtons)button.addEventListener('click',()=>{activeGroup=button.dataset.deskSection;filterSections(read());sectionStatus.textContent='Showing '+button.textContent.trim().replace(/\s+\d+$/,'')+'. Open a heading to explore.';});
 root.querySelectorAll('a[href="#dashboard-customize"]').forEach(a=>a.addEventListener('click',()=>{root.querySelector('#dashboard-customize').open=true;}));
 grid.addEventListener('click',event=>{const button=event.target.closest('button[data-move],button[data-hide]');if(!button)return;const id=button.closest('[data-module]').dataset.module,value=read(),visible=shown(value),index=visible.indexOf(id);
  if(button.hasAttribute('data-hide')){value.hidden.push(id);apply(value);const next=visible[index+1]||visible[index-1];if(next)cards.get(next).querySelector('summary').focus();else sections.querySelector('[aria-pressed="true"]').focus();status.textContent='Module hidden. Restore it in Customize my desk, then save your layout.';return;}
  const other=visible[index+(button.dataset.move==='up'?-1:1)];if(!other)return;const a=value.order.indexOf(id),b=value.order.indexOf(other);[value.order[a],value.order[b]]=[value.order[b],value.order[a]];apply(value);const target=cards.get(id).querySelector(`[data-move="${button.dataset.move}"]`);(target.disabled?cards.get(id).querySelector('[data-hide]'):target).focus();status.textContent='Module moved. Choose Save layout to keep this order.';
 });
 form.addEventListener('submit',event=>{if(!demo){status.textContent='Saving your desk to your account…';return;}event.preventDefault();const value=event.submitter?.value==='defaults'?{version:1,order:ids,hidden:ids.filter(id=>!root.dataset.defaultVisible.split(',').includes(id))}:read();apply(value);try{localStorage.setItem(key,JSON.stringify(value));status.textContent='Example layout saved in this browser. No member profile data is stored here.';}catch{status.textContent='Layout changed for this visit. This browser could not save the example preferences.';}});
})();
