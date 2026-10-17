const dialog=document.querySelector('[data-product-photo-dialog]');
if(dialog&&typeof dialog.showModal==='function'){
 const image=dialog.querySelector('[data-photo-image]'),title=dialog.querySelector('#product-photo-title'),source=dialog.querySelector('[data-photo-source-link]');
 let opener=null;
 document.querySelector('#product-list').addEventListener('click',event=>{
  const link=event.target.closest('[data-product-photo]');
  if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();opener=link;
  image.src=link.href;image.alt=link.querySelector('img').alt;
  title.textContent=link.dataset.photoTitle;
  source.href=link.dataset.photoSource;source.textContent='Photo: '+link.dataset.photoCredit;
  link.setAttribute('aria-expanded','true');dialog.showModal();
 });
 dialog.querySelector('[data-photo-close]').addEventListener('click',()=>dialog.close());
 dialog.querySelector('[data-photo-shrink]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{if(opener){opener.setAttribute('aria-expanded','false');opener.focus({preventScroll:true});}image.removeAttribute('src');});
}
