const form=document.querySelector('.connections-editor');
if(form){let request;async function coverage(){const state=form.elements.state.value,range=form.elements.notificationRange.value,output=form.querySelector('[data-coverage]');if(!state)return;request?.abort();request=new AbortController();try{const response=await fetch('/connections/coverage/?state='+encodeURIComponent(state)+'&range='+encodeURIComponent(range),{signal:request.signal});const data=await response.json();if(response.ok)output.textContent=data.states.map(s=>s.name).join(', ');else output.textContent=data.error||'Coverage unavailable.';}catch(e){if(e.name!=='AbortError')output.textContent='Coverage will be checked when saving. Refresh to preview it.';}}for(const name of ['state','notificationRange'])form.elements[name].addEventListener('change',coverage);}
for(const form of document.querySelectorAll('[data-photo-upload]')){form.addEventListener('submit',async event=>{event.preventDefault();const output=form.querySelector('[data-upload-status]'),button=form.querySelector('button'),file=form.elements.photo.files[0];if(!file||file.size>5*1024*1024){output.textContent='Choose an image up to 5 MB.';return;}button.disabled=true;output.textContent='Uploading…';try{const response=await fetch(form.action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Connections-CSRF':form.elements.csrf.value,'X-Photo-Kind':form.elements.kind.value,'X-Photo-Caption':encodeURIComponent(form.elements.caption.value)},body:file});const data=await response.json();if(!response.ok)throw Error(data.error||'Upload failed.');location.assign(data.location);}catch(e){output.textContent=e.message;button.disabled=false;}});}
for(const section of document.querySelectorAll('[data-event-share]')){
 const input=section.querySelector('[data-event-share-url]'),button=section.querySelector('[data-event-share-copy]'),status=section.querySelector('[data-event-share-status]');
 if(!input||!button||!status)continue;
 button.hidden=false;
 button.addEventListener('click',async()=>{
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(input.value);status.textContent='Public event link copied.';
  }catch{
   input.focus();input.select();status.textContent='Link selected. Press Command-C on Mac or Ctrl-C to copy it.';
  }
 });
}
