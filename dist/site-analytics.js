// Optional first-party statistics. No page data is sent before permission.
(()=>{
 'use strict';
 const preferenceKey='gold-trails-usage-choice-v1',visitorKey='gold-trails-usage-browser-v1',visitKey='gold-trails-usage-visit-v1',lifetime=90*86400000;
 const protectedPath=/^\/(?:admin|api|account|signup|login|logout|forgot-password|reset-password|verify-email|resend-verification|calendar|compass|dashboard-preview|privacy|suggestions)(?:\/|$)/;
 const emptyStore={getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable');},removeItem:()=>{}};let localStore=emptyStore,tabStore=emptyStore;try{localStore=window.localStorage;}catch{}try{tabStore=window.sessionStorage;}catch{}
 const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 let memoryChoice=null,viewSent=false,dialog,opener;
 const read=(store,key)=>{try{return JSON.parse(store.getItem(key));}catch{return null;}};
 const save=(store,key,value)=>{try{store.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
 const remove=(store,key)=>{try{store.removeItem(key);}catch{}};
 const choice=()=>{const value=memoryChoice||read(localStore,preferenceKey);return value&&Date.now()-value.at<lifetime?value.value:null;};
 function clearCodes(){remove(localStore,visitorKey);remove(tabStore,visitKey);}
 function browser(){let v=read(localStore,visitorKey);if(!v||Date.now()-v.at>=lifetime){v={id:crypto.randomUUID(),at:Date.now()};if(!save(localStore,visitorKey,v))return null;}return v.id;}
 function visit(){let v=read(tabStore,visitKey);if(!v||Date.now()-v.at>1800000){let referrer='';try{const u=new URL(document.referrer);if(u.origin!==location.origin)referrer=u.origin;}catch{}v={id:crypto.randomUUID(),referrer};}v.at=Date.now();return save(tabStore,visitKey,v)?v:null;}
 function send(type,target=''){
  if(blocked()||choice()!=='allow'||protectedPath.test(location.pathname)||/^\/gold-almanac\/.+/.test(location.pathname)||document.visibilityState==='prerender')return;
  try{
   const visitor=browser(),session=visit();if(!visitor||!session)return;
   const data={version:1,consent:true,id:crypto.randomUUID(),visitor,session:session.id,type,page:location.pathname,target,referrer:session.referrer,device:innerWidth<600?'mobile':innerWidth<1000?'tablet':'desktop'},body=JSON.stringify(data);
   if(navigator.sendBeacon&&navigator.sendBeacon('/api/usage/',new Blob([body],{type:'application/json'})))return;
   fetch('/api/usage/',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body,keepalive:true}).catch(()=>{});
  }catch{}
 }
 function pageview(){if(!viewSent&&choice()==='allow'&&!blocked()){send('pageview');viewSent=true;}}
 function close(){dialog.hidden=true;opener?.focus();}
 function choose(value){memoryChoice={value,at:Date.now()};if(save(localStore,preferenceKey,memoryChoice))memoryChoice=null;if(value!=='allow')clearCodes();close();pageview();}
 function show(){opener=document.activeElement;dialog.hidden=false;dialog.querySelector('button').focus();}
 function start(){
  const footer=document.querySelector('footer')||document.body;
  const button=document.createElement('button');button.type='button';button.className='usage-preferences';button.textContent='Visitor statistics';button.addEventListener('click',show);footer.append(button);
  dialog=document.createElement('section');dialog.className='usage-choice';dialog.hidden=true;dialog.setAttribute('role','region');dialog.setAttribute('aria-label','Optional usage statistics');
  const p=document.createElement('p');p.textContent='Optional visitor statistics: allow counts of public page visits and outside links you click. No account details or IP addresses are added to these statistics.';dialog.append(p);
  const info=document.createElement('a');info.href='/privacy/usage/';info.textContent='What we collect and your choices';dialog.append(info);
  const actions=document.createElement('div');for(const [label,value] of [['No thanks','decline'],['Allow statistics','allow']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>choose(value));actions.append(b);}const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Close';cancel.addEventListener('click',close);actions.append(cancel);dialog.append(actions);document.body.append(dialog);
  if(blocked()){clearCodes();p.textContent='Your browser privacy signal disables optional usage measurement. You can continue using Gold Trails normally.';actions.querySelectorAll('button')[1].disabled=true;}
  pageview();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.hidden)close();});
  const captureClick=e=>{if(!e.isTrusted||(e.type==='auxclick'?e.button!==1:e.button!==0))return;const link=e.target.closest?.('a[href]');if(!link||link.hasAttribute('download'))return;try{const u=new URL(link.href);if(!['http:','https:'].includes(u.protocol)||u.origin===location.origin||u.username||u.password||/@|%40/i.test(u.pathname))return;const out=new URL(u.origin+u.pathname);if(/^(?:www\.)?(?:youtube\.com|youtu\.be)$/.test(u.hostname)){for(const key of ['v','t','start']){const value=u.searchParams.get(key);if(value&&(key==='v'?/^[\w-]{11}$/.test(value):/^\d{1,6}(?:s|m\d{1,2}s?)?$/.test(value)))out.searchParams.set(key,value);}}send('outbound',out.href);}catch{}};document.addEventListener('click',captureClick);document.addEventListener('auxclick',captureClick);
  window.addEventListener('storage',e=>{if(e.key===preferenceKey||e.key===null){memoryChoice=null;if(choice()!=='allow')clearCodes();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
