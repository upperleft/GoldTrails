import {matchesCreator,sortCreators} from './prospectors-data.js';
const people=JSON.parse(document.querySelector('#map-data').textContent),form=document.querySelector('.explorer-form'),cards=document.querySelector('#map-people');
const filters=()=>Object.fromEntries(new FormData(form));
function update(sync=true){const values=filters(),visible=people.filter(p=>matchesCreator(p,values)),slugs=new Set(visible.map(p=>p.slug));
 document.querySelector('#map-status').textContent=visible.length+' prospectors · profiles and video links are free';
 const bySlug=new Map([...cards.children].map(c=>[c.dataset.slug,c]));for(const p of sortCreators(people,values.sort)){const c=bySlug.get(p.slug);if(c){c.hidden=!slugs.has(p.slug);cards.append(c);}}
 document.querySelector('#creator-empty').hidden=visible.length>0;
 if(sync){const params=new URLSearchParams(Object.entries(values).filter(([,v])=>v));history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));}
}
form.addEventListener('submit',event=>{event.preventDefault();if(event.submitter?.value==='map'){const params=new URLSearchParams(Object.entries(filters()).filter(([,v])=>v));location.href='/gold-almanac/'+(params.size?'?'+params:'');return;}update();});
form.addEventListener('input',()=>update());form.addEventListener('change',()=>update());
window.addEventListener('popstate',()=>{const params=new URLSearchParams(location.search);for(const field of form.querySelectorAll('input,select'))field.value=params.get(field.name)||(field.name==='sort'?'az':'');update(false);});update(false);
