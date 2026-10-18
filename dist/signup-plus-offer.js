// A single optional invitation after a confirmed signup request, never an entitlement change.
(() => {
 const dialog=document.querySelector('[data-signup-plus-offer]');
 if(!dialog||typeof dialog.showModal!=='function')return;
 let shown=false,returnTo=null;
 const restore=()=>{
  document.documentElement.classList.remove('signup-plus-open');
  const destination=returnTo?.isConnected?returnTo:document.querySelector('.member-card');
  if(destination){if(!destination.matches('a,button,input,[tabindex]'))destination.setAttribute('tabindex','-1');destination.focus({preventScroll:true});}
 };
 const close=()=>{if(dialog.open)dialog.close();};
 const show=()=>{
  if(shown||window.history.state?.goldTrailsSignupPlusOfferShown)return;
  shown=true;
  returnTo=document.activeElement===document.body||document.activeElement===document.documentElement?document.querySelector('.member-card'):document.activeElement;
  dialog.showModal();
  // Returning from Plus details should reveal the confirmation, not repeat the invitation.
  try{window.history.replaceState({...window.history.state,goldTrailsSignupPlusOfferShown:true},'');}catch{}
  document.documentElement.classList.add('signup-plus-open');
  dialog.querySelector('#signup-plus-title').focus({preventScroll:true});
 };
 for(const button of dialog.querySelectorAll('[data-signup-plus-dismiss]'))button.addEventListener('click',close);
 dialog.querySelector('[data-signup-plus-continue]').addEventListener('click',close);
 dialog.addEventListener('close',restore);
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('a[href],button:not([disabled])')];
  const first=controls[0],last=controls.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||!controls.includes(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!controls.includes(active))){event.preventDefault();first.focus();}
 });
 document.addEventListener('goldtrails:signup-confirmed',show,{once:true});
 if(dialog.hasAttribute('data-signup-plus-autoopen'))show();
})();
