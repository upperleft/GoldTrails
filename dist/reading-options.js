(() => {
 'use strict';
 const key='gold-trails-reading-session-v1',sizes=[100,115,130,150,175,200],choices=['bold','contrast','roomy','font'],root=document.documentElement;
 const defaults=()=>({size:0,bold:false,contrast:false,roomy:false,font:false});
 function read(){try{const value=JSON.parse(window.sessionStorage.getItem(key));if(!value||value.version!==1)return defaults();return{size:Number.isInteger(value.size)&&value.size>=0&&value.size<sizes.length?value.size:0,...Object.fromEntries(choices.map(name=>[name,value[name]===true]))};}catch{return defaults();}}
 let settings=read();
 function apply(){root.dataset.readingSize=String(settings.size);for(const name of choices){if(settings[name])root.setAttribute('data-reading-'+name,'');else root.removeAttribute('data-reading-'+name);}}
 // Apply before the page paints, including on pages with late-loading content.
 apply();
 function init(){
  const panel=document.querySelector('[data-reading-options]');if(!panel)return;
  const summary=panel.querySelector('summary'),smaller=panel.querySelector('[data-reading-smaller]'),larger=panel.querySelector('[data-reading-larger]'),label=panel.querySelector('[data-reading-size-label]');
  const inputs=[...panel.querySelectorAll('[data-reading-choice]')];
  function sync(){apply();label.textContent=sizes[settings.size]+'%';smaller.disabled=settings.size===0;larger.disabled=settings.size===sizes.length-1;for(const input of inputs)input.checked=settings[input.dataset.readingChoice];}
  function save(){try{if(settings.size===0&&choices.every(name=>!settings[name]))window.sessionStorage.removeItem(key);else window.sessionStorage.setItem(key,JSON.stringify({version:1,...settings}));}catch{}sync();window.dispatchEvent(new Event('resize'));}
  smaller.addEventListener('click',()=>{settings.size=Math.max(0,settings.size-1);save();});
  larger.addEventListener('click',()=>{settings.size=Math.min(sizes.length-1,settings.size+1);save();});
  for(const input of inputs)input.addEventListener('change',()=>{settings[input.dataset.readingChoice]=input.checked;save();});
  panel.querySelector('[data-reading-reset]').addEventListener('click',()=>{settings=defaults();save();});
  const close=()=>{panel.open=false;summary.focus();};
  panel.querySelector('[data-reading-close]').addEventListener('click',close);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.open){event.preventDefault();close();}});
  document.addEventListener('pointerdown',event=>{if(panel.open&&!panel.contains(event.target))panel.open=false;});
  window.addEventListener('pageshow',()=>{settings=read();sync();});
  sync();panel.hidden=false;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
