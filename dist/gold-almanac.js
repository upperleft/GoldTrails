(() => {
 const panel=document.getElementById('state-details'),map=document.querySelector('.almanac-map');
 if(!panel||!map)return;
 const guideSlug=m=>m.dataset.state||m.dataset.canadaRegion;
 const markers=[...map.querySelectorAll('[data-state],[data-canada-region]')],status=document.getElementById('almanac-status'),retry=document.getElementById('almanac-retry'),share=document.getElementById('almanac-share');
 let selected=markers.find(m=>m.getAttribute('aria-pressed')==='true')?guideSlug(markers.find(m=>m.getAttribute('aria-pressed')==='true')):null,pending=null,controller=null,serial=0;
 const stateName=slug=>markers.find(m=>guideSlug(m)===slug)?.getAttribute('aria-label')||slug;
 const urlFor=slug=>slug?'/gold-almanac/'+slug+'/':'/gold-almanac/';
 const details=document.getElementById('almanac-details'),selectionMarker=document.getElementById('almanac-selection-marker');
 const usMarkers=markers.filter(m=>m.dataset.state),caMarkers=markers.filter(m=>m.dataset.canadaRegion);
 const setFocusStop=slug=>{for(const group of [usMarkers,caMarkers]){const stop=group.find(m=>guideSlug(m)===slug)||group[0];group.forEach(m=>m.setAttribute('tabindex',m===stop?'0':'-1'));}};

 setFocusStop(selected||(markers[0]&&guideSlug(markers[0])));share.hidden=!selected;
 if(selected)window.goldTrailsMineMap?.mount(panel);
 function clearSelection(){
  controller?.abort();serial++;pending=null;selected=null;window.goldTrailsMineMap?.destroy();panel.innerHTML='';panel.hidden=true;panel.dataset.stateId='';panel.removeAttribute('aria-busy');
  markers.forEach(m=>{m.classList.toggle('is-selected',false);m.setAttribute('aria-pressed','false');});setFocusStop(markers[0]&&guideSlug(markers[0]));
  document.getElementById('selected-state').textContent='None';status.textContent='Choose a state, province or territory to explore its field notes.';retry.hidden=true;share.hidden=true;share.disabled=false;details.hidden=true;if(selectionMarker)selectionMarker.hidden=true;
  document.title='Gold Almanac — Gold Trails';document.querySelector('link[rel="canonical"]').href='/gold-almanac/';
 }
 async function select(slug,{historyMode='push'}={}){
  if(slug===selected&&!pending)return;
  controller?.abort();controller=new AbortController();const request=++serial;pending=slug;retry.hidden=true;share.disabled=true;
  let timedOut=false;const requestController=controller;const timeout=setTimeout(()=>{timedOut=true;requestController.abort();},15000);
  panel.setAttribute('aria-busy','true');status.textContent='Loading '+stateName(slug)+' field notes…';
  try{
   const response=await fetch('/api/gold-almanac/'+slug+'/',{signal:controller.signal,headers:{Accept:'application/json'}});
   if(!response.ok&&response.status!==403)throw new Error('Unavailable');
   const result=await response.json();if(request!==serial)return;
   if(!response.ok&&result.code!=='plus_required')throw new Error('Unavailable');
   if(result.state?.slug!==slug||result.url!==urlFor(slug)||typeof result.html!=='string')throw new Error('Unexpected response');
   window.goldTrailsMineMap?.destroy();panel.innerHTML=result.html;panel.hidden=false;window.goldTrailsMineMap?.mount(panel);panel.dataset.stateId=result.state.id;selected=slug;share.hidden=false;details.hidden=false;if(selectionMarker)selectionMarker.hidden=false;
   markers.forEach(m=>{const active=guideSlug(m)===slug;m.classList.toggle('is-selected',active);m.setAttribute('aria-pressed',String(active));});
   setFocusStop(slug);document.getElementById('selected-state').textContent=result.state.name;
   document.title='Gold Almanac · '+result.state.name+' — Gold Trails';document.querySelector('link[rel="canonical"]').href=result.url;
   if(historyMode==='push')history.pushState({state:slug},'',result.url+(location.search||'')+location.hash);
   status.textContent=result.state.name+' selected. '+(result.code==='plus_required'?'Plus access information is below the map.':'Field notes are below the map.');pending=null;
  }catch(error){
   if((error.name==='AbortError'&&!timedOut)||request!==serial)return;
   status.textContent='Could not load that guide. Your previous selection is still here. Try again, or open the guide link.';retry.hidden=false;
   if(historyMode==='pop')history.replaceState({state:selected},'',urlFor(selected)+(location.search||'')+location.hash);
  }finally{clearTimeout(timeout);if(request===serial){panel.removeAttribute('aria-busy');share.disabled=false;}}
 }
 map.addEventListener('click',e=>{const marker=e.target.closest('[data-state]');if(!marker||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();select(marker.dataset.state);});
 map.addEventListener('keydown',e=>{
  const marker=e.target.closest('[data-state]');if(!marker)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();select(marker.dataset.state);return;}
  let index=usMarkers.indexOf(marker);
  if(['ArrowRight','ArrowDown'].includes(e.key))index=(index+1)%usMarkers.length;
  else if(['ArrowLeft','ArrowUp'].includes(e.key))index=(index+usMarkers.length-1)%usMarkers.length;
  else if(e.key==='Home')index=0;else if(e.key==='End')index=usMarkers.length-1;else return;
  e.preventDefault();setFocusStop(usMarkers[index].dataset.state);usMarkers[index].focus();
 });
 retry.addEventListener('click',()=>{if(pending)select(pending);});
 share.addEventListener('click',async()=>{
  const url=new URL(urlFor(selected),location.origin).href;
  try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(url);status.textContent='Guide link copied.';}
  catch{status.textContent='Guide link: '+url;const input=document.createElement('input');input.value=url;input.readOnly=true;input.setAttribute('aria-label','Copy this guide link');status.append(input);input.focus();input.select();}
 });
 details.addEventListener('click',()=>requestAnimationFrame(()=>document.getElementById('state-heading')?.focus({preventScroll:true})));
 window.addEventListener('gold-trails:canada-region',event=>{if(event?.detail?.slug){select(event.detail.slug);return;}clearSelection();status.textContent='Canadian creator coverage selected. Matching profiles and videos are listed below the map.';});
 window.addEventListener('popstate',()=>{
  if(['/gold-almanac','/gold-almanac/'].includes(location.pathname)){clearSelection();return;}
  const slug=location.pathname.match(/^\/gold-almanac\/([a-z-]+)\/$/)?.[1];
  if(!slug)return;
  if(slug!==selected)select(slug,{historyMode:'pop'});
  else if(pending){controller?.abort();serial++;pending=null;panel.removeAttribute('aria-busy');retry.hidden=true;share.disabled=false;status.textContent=stateName(selected)+' selected.';}
 });
})();
