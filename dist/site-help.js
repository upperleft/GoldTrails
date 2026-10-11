import {explainControl, helpPreferenceKey} from './site-help-content.js?v=7e10487203d9';

const menu = document.querySelector('.left .trail-menu');
if(menu) {
 const switchBox=document.createElement('div');switchBox.className='site-help-switch';
 switchBox.innerHTML='<label><input type="checkbox" id="site-help-toggle" aria-describedby="site-help-instructions">Explain this page</label><p id="site-help-instructions">Hover or use Tab for tips. On touch, press and hold. Escape closes a tip.</p>';
 (document.querySelector('.admin-editor .editor-toolbar') || menu).prepend(switchBox);
 const toggle=switchBox.querySelector('input'),bubble=document.createElement('div');
 bubble.id='site-help-tooltip';bubble.className='site-help-tooltip';bubble.role='tooltip';bubble.hidden=true;
 const heading=document.createElement('strong'),copy=document.createElement('p');heading.textContent='THE OLD TIMER’S TIP';bubble.append(heading,copy);document.body.append(bubble);
 let enabled=false,active=null,showTimer,hideTimer,touchTimer,suppressedClick=null,touchStart=null;
 const targets='a[href],button,input:not([type="hidden"]),select,textarea,summary,[data-help]';
 const moduleHeadings=document.querySelectorAll('[data-module] > header h2');
 for(const title of moduleHeadings){const card=title.closest('[data-module]'),state=card.querySelector('.dashboard-state');title.dataset.help=state?.classList.contains('preview')?'This is a future feature preview. It does not save or retrieve information yet.':state?.classList.contains('demo')?'This is an interactive sample. Read its notes to see which actions are temporary.':'This module uses existing Gold Trails resources. Use its controls and nearby notes to explore what is available.';}
 function label(el){
  const aria=el.getAttribute('aria-label');if(aria)return aria;
  const source=el.labels?.[0]||el,clone=source.cloneNode(true);clone.querySelectorAll('input,select,textarea,.source-card').forEach(node=>node.remove());
  return clone.textContent.trim().replace(/\s+/g,' ').slice(0,160);
 }
 function description(el){
  let href=el.getAttribute('href');if(href&&!href.startsWith('#')){try{const u=new URL(href,location.href);if(u.origin===location.origin)href=u.pathname+u.search+u.hash;}catch{}}
  return explainControl({tag:el.tagName.toLowerCase(),id:el.id,label:label(el),href,type:el.type,name:el.name,value:el.matches('button')?el.value:undefined,required:el.required,explicit:el.dataset.help,newPassword:el.autocomplete==='new-password',move:el.dataset.move,hide:el.hasAttribute('data-hide'),showAll:el.hasAttribute('data-show-all'),passwordToggle:el.hasAttribute('data-password-toggle'),findOnMap:el.classList.contains('map-find'),ephemeral:!!el.closest('.dashboard-packing'),sort:el.hasAttribute('data-sort'),permalink:el.classList.contains('section-link'),demo:el.closest('[data-member-dashboard]')?.dataset.demo==='true',formAction:el.form?.getAttribute('action')});
 }
 function target(node){const el=node?.closest?.(targets);return el&&!el.closest('.site-help-switch,.site-help-tooltip,.source-preview,.leaflet-container')&&!el.classList.contains('term')&&!el.disabled&&!el.closest('[hidden],fieldset[disabled]')&&description(el)?el:null;}
 function clearTimers(){clearTimeout(showTimer);clearTimeout(hideTimer);}
 function hide(){clearTimers();if(active){const ids=(active.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==bubble.id);if(ids.length)active.setAttribute('aria-describedby',ids.join(' '));else active.removeAttribute('aria-describedby');}active=null;bubble.hidden=true;}
 function position(){if(!active)return;const v=window.visualViewport,left=v?.offsetLeft||0,top=v?.offsetTop||0,w=v?.width||innerWidth,h=v?.height||innerHeight,r=active.getBoundingClientRect(),b=bubble.getBoundingClientRect();bubble.style.left=Math.max(left+12,Math.min(r.left,left+w-b.width-12))+'px';const below=r.bottom+9;const y=below+b.height<=top+h-12?below:r.top-b.height-9;bubble.style.top=Math.max(top+12,Math.min(y,top+h-b.height-12))+'px';}
 function show(el){if(!enabled||!el?.isConnected)return;hide();const text=description(el);if(!text)return;active=el;copy.textContent=text;bubble.hidden=false;const ids=new Set((el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(bubble.id);el.setAttribute('aria-describedby',[...ids].join(' '));position();}
 function setEnabled(value,persist=false){enabled=value;toggle.checked=value;document.body.classList.toggle('help-enabled',value);hide();for(const title of moduleHeadings){if(value)title.tabIndex=0;else title.removeAttribute('tabindex');}if(persist){try{localStorage.setItem(helpPreferenceKey,value?'on':'off');}catch{/* Still usable for this page if browser storage is blocked. */}}}
 try{setEnabled(localStorage.getItem(helpPreferenceKey)==='on');}catch{setEnabled(false);}
 toggle.addEventListener('change',()=>setEnabled(toggle.checked,true));
 window.addEventListener('storage',event=>{if(event.key===helpPreferenceKey)setEnabled(event.newValue==='on');});
 document.addEventListener('pointerover',event=>{if(!enabled||event.pointerType==='touch')return;const el=target(event.target);if(!el||el===active||el.contains(event.relatedTarget))return;clearTimers();showTimer=setTimeout(()=>show(el),220);});
 document.addEventListener('pointerout',event=>{if(event.pointerType==='touch')return;const el=target(event.target);if(!el||el.contains(event.relatedTarget)||bubble.contains(event.relatedTarget))return;clearTimeout(showTimer);if(el===active)hideTimer=setTimeout(hide,220);});
 bubble.addEventListener('pointerenter',()=>clearTimeout(hideTimer));bubble.addEventListener('pointerleave',()=>{if(document.activeElement!==active)hideTimer=setTimeout(hide,220);});
 document.addEventListener('focusin',event=>{const el=target(event.target);if(enabled&&el)show(el);else hide();});
 document.addEventListener('focusout',()=>{hideTimer=setTimeout(()=>{if(document.activeElement!==active)hide();},100);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){hide();clearTimeout(touchTimer);}});
 document.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'||!enabled)return;const el=target(event.target);if(!el)return;suppressedClick=null;touchStart={x:event.clientX,y:event.clientY};clearTimeout(touchTimer);touchTimer=setTimeout(()=>{show(el);suppressedClick=el;},550);});
 document.addEventListener('pointermove',event=>{if(event.pointerType==='touch'&&touchStart&&Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)>10)clearTimeout(touchTimer);});
 for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{clearTimeout(touchTimer);touchStart=null;});
 document.addEventListener('contextmenu',event=>{if(enabled&&target(event.target)&&touchStart){event.preventDefault();show(target(event.target));suppressedClick=target(event.target);}});
 document.addEventListener('click',event=>{const el=target(event.target);if(suppressedClick&&el===suppressedClick){event.preventDefault();event.stopImmediatePropagation();suppressedClick=null;return;}suppressedClick=null;if(!event.target.closest('.site-help-tooltip'))hide();},true);
 window.addEventListener('scroll',()=>{if(active&&active.getBoundingClientRect().bottom<0)hide();else position();},true);
 window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
}
