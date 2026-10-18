// Same enlarge / click-to-shrink / Escape pattern used by product photographs.
const article=document.querySelector('#river-rocks-article');
const dialog=document.querySelector('[data-article-photo-dialog]');
if(article&&dialog&&typeof dialog.showModal==='function'){
 const image=dialog.querySelector('[data-article-photo-image]');
 const title=dialog.querySelector('#article-photo-title');
 const caption=dialog.querySelector('[data-article-photo-caption]');
 const shrink=dialog.querySelector('[data-article-photo-shrink]');
 let opener=null;
 article.addEventListener('click',event=>{
  const link=event.target.closest('[data-article-photo]');
  if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const figure=link.closest('figure'),original=link.querySelector('img');
  if(!figure||!original)return;
  event.preventDefault();opener=link;
  image.src=link.href;image.alt=original.alt;
  title.textContent=link.dataset.photoTitle;
  shrink.setAttribute('aria-label','Close enlarged photograph of '+link.dataset.photoTitle);
  caption.replaceChildren(...Array.from(figure.querySelector('figcaption').childNodes,node=>node.cloneNode(true)));
  link.setAttribute('aria-expanded','true');dialog.showModal();
 });
 dialog.querySelector('[data-article-photo-close]').addEventListener('click',()=>dialog.close());
 shrink.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{
  if(opener){opener.setAttribute('aria-expanded','false');opener.focus({preventScroll:true});}
  image.removeAttribute('src');caption.replaceChildren();
 });
}
