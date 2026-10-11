(() => {
 const panel=document.getElementById('state-details'),picker=document.getElementById('almanac-state'),form=picker?.form;
 if(!panel||!form)return;
 const map=document.querySelector('.almanac-map'),markers=[...map.querySelectorAll('[data-state]')],status=document.getElementById('almanac-status'),retry=document.getElementById('almanac-retry'),share=document.getElementById('almanac-share');
 let selected=picker.value,pending=null,controller=null,serial=0;
 const urlFor=slug=>'/gold-almanac/'+slug+'/';
 const setFocusStop=slug=>markers.forEach(m=>m.setAttribute('tabindex',m.dataset.state===slug?'0':'-1'));
 setFocusStop(selected);share.hidden=false;
 window.goldTrailsMineMap?.mount(panel);
 async function select(slug,{historyMode='push'}={}){
  if(slug===selected&&!pending){picker.value=selected;return;}
  controller?.abort();controller=new AbortController();const request=++serial;pending=slug;retry.hidden=true;share.disabled=true;
  let timedOut=false;const requestController=controller;const timeout=setTimeout(()=>{timedOut=true;requestController.abort();},15000);
  panel.setAttribute('aria-busy','true');status.textContent='Loading '+picker.querySelector(`option[value="${slug}"]`)?.textContent+' field notes…';
  try{
   const response=await fetch('/api/gold-almanac/'+slug+'/',{signal:controller.signal,headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('Unavailable');
   const result=await response.json();if(request!==serial)return;
   if(result.state?.slug!==slug||result.url!==urlFor(slug)||typeof result.html!=='string')throw new Error('Unexpected response');
   window.goldTrailsMineMap?.destroy();panel.innerHTML=result.html;window.goldTrailsMineMap?.mount(panel);panel.dataset.stateId=result.state.id;selected=slug;picker.value=slug;
   markers.forEach(m=>{const active=m.dataset.state===slug;m.classList.toggle('is-selected',active);m.setAttribute('aria-pressed',String(active));});
   setFocusStop(slug);document.getElementById('selected-state').textContent=result.state.name;
   document.title='Gold Almanac · '+result.state.name+' — Gold Trails';document.querySelector('link[rel="canonical"]').href=result.url;
   if(historyMode==='push')history.pushState({state:slug},'',result.url+location.hash);
   status.textContent=result.state.name+' selected. Field notes are below the map.';pending=null;
  }catch(error){
   if((error.name==='AbortError'&&!timedOut)||request!==serial)return;
   picker.value=selected;status.textContent='Could not load that state. Your previous selection is still here. Try again, or open the state link.';retry.hidden=false;
   if(historyMode==='pop')history.replaceState({state:selected},'',urlFor(selected)+location.hash);
  }finally{clearTimeout(timeout);if(request===serial){panel.removeAttribute('aria-busy');share.disabled=false;}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();select(picker.value);});
 picker.addEventListener('change',()=>select(picker.value));
 map.addEventListener('click',e=>{const marker=e.target.closest('[data-state]');if(!marker||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();select(marker.dataset.state);});
 map.addEventListener('keydown',e=>{
  const marker=e.target.closest('[data-state]');if(!marker)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();select(marker.dataset.state);return;}
  let index=markers.indexOf(marker);
  if(['ArrowRight','ArrowDown'].includes(e.key))index=(index+1)%markers.length;
  else if(['ArrowLeft','ArrowUp'].includes(e.key))index=(index+markers.length-1)%markers.length;
  else if(e.key==='Home')index=0;else if(e.key==='End')index=markers.length-1;else return;
  e.preventDefault();setFocusStop(markers[index].dataset.state);markers[index].focus();
 });
 retry.addEventListener('click',()=>{if(pending)select(pending);});
 share.addEventListener('click',async()=>{
  const url=new URL(urlFor(selected),location.origin).href;
  try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(url);status.textContent='State link copied.';}
  catch{status.textContent='State link: '+url;const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','Copy this state link');status.append(input);input.focus();input.select();}
 });
 document.getElementById('almanac-details').addEventListener('click',()=>requestAnimationFrame(()=>document.getElementById('state-heading')?.focus({preventScroll:true})));
 window.addEventListener('popstate',()=>{
  const slug=location.pathname.match(/^\/gold-almanac\/([a-z-]+)\/$/)?.[1];
  if(!slug)return;
  if(slug!==selected)select(slug,{historyMode:'pop'});
  else if(pending){controller?.abort();serial++;pending=null;picker.value=selected;panel.removeAttribute('aria-busy');retry.hidden=true;share.disabled=false;status.textContent=picker.selectedOptions[0].textContent+' selected.';}
 });
})();
