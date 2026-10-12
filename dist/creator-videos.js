const dialog=document.querySelector('#creator-video-dialog'),content=document.querySelector('#video-library-content'),title=document.querySelector('#video-library-title');
let request=null;
function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
function watchCard(video){
 const card=element('article',null,'video-library-card'),link=element('a',null,'video-library-watch'),picture=element('div',null,'video-library-image'),image=element('img');
 link.href=video.url;link.target='_blank';link.rel='noopener noreferrer';image.src='https://i.ytimg.com/vi/'+video.id+'/hqdefault.jpg';image.alt='';image.loading='lazy';image.width=480;image.height=360;
 const play=element('span','▶');play.setAttribute('aria-hidden','true');picture.append(image,play);link.append(picture,element('h3',video.title),element('span',video.subject||'Prospecting video','video-library-subject'),element('span','Watch on YouTube ↗','video-library-outbound'));card.append(link);return card;
}
function bindFilters(scope,library){
 const search=scope.querySelector('[data-video-search]'),topic=scope.querySelector('[data-video-topic]'),sort=scope.querySelector('[data-video-sort]'),grid=scope.querySelector('[data-video-grid]'),status=scope.querySelector('[data-video-status]'),empty=scope.querySelector('[data-video-empty]');
 function render(){const words=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);const videos=library.videos.filter(v=>(!topic.value||v.subject===topic.value)&&words.every(word=>[v.title,v.subject,...v.tags].join(' ').toLowerCase().includes(word))).sort((a,b)=>((sort.value==='topic'?a.subject.localeCompare(b.subject):0)||a.title.localeCompare(b.title)));grid.replaceChildren(...videos.map(watchCard));status.textContent=videos.length+' of '+library.videos.length+' video'+(library.videos.length===1?'':'s');empty.hidden=videos.length!==0;}
 search.addEventListener('input',render);topic.addEventListener('change',render);sort.addEventListener('change',render);render();
}
function showLibrary(library){
 title.textContent=library.name+' · Video library';content.replaceChildren();
 content.append(element('p','Selected videos from '+(library.uploaderName||library.name)+'. Topics are browsing categories; video content has not been independently reviewed. Each video opens on YouTube in a new tab.','video-library-note'));
 const tools=element('div',null,'video-library-tools'),searchLabel=element('label','Search videos'),search=element('input');search.type='search';search.placeholder='Title, topic, or keyword';search.maxLength=150;search.dataset.videoSearch='';searchLabel.append(search);
 const topicLabel=element('label','Topic'),topic=element('select');topic.dataset.videoTopic='';topic.append(new Option('All topics',''));for(const subject of [...new Set(library.videos.map(v=>v.subject).filter(Boolean))].sort())topic.append(new Option(subject,subject));topicLabel.append(topic);
 const sortLabel=element('label','Sort'),sort=element('select');sort.dataset.videoSort='';sort.append(new Option('Title A–Z','title'),new Option('Topic','topic'));sortLabel.append(sort);tools.append(searchLabel,topicLabel,sortLabel);
 const status=element('p',null,'video-library-status');status.dataset.videoStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');const grid=element('div',null,'video-library-grid');grid.dataset.videoGrid='';const empty=element('p','No videos match. Try a different keyword or topic.');empty.dataset.videoEmpty='';empty.hidden=true;
 const source=element('p',null,'video-library-source'),channel=element('a','Browse the full channel ↗');channel.href=library.channelUrl;channel.target='_blank';channel.rel='noopener noreferrer';source.append(channel,document.createTextNode(' · Channel ownership checked '+library.checkedAt));content.append(tools,status,grid,empty,source);bindFilters(content,library);search.focus();
}
if(dialog){
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();}});
 dialog.querySelector('.video-library-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{request?.abort();request=null;});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 document.addEventListener('click',async event=>{
  const link=event.target.closest?.('a[data-video-library]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||typeof dialog.showModal!=='function')return;
  event.preventDefault();request?.abort();const controller=new AbortController();request=controller;title.textContent='Video library';content.replaceChildren(element('p','Opening the screening room…'));dialog.showModal();
  try{const response=await fetch('/api/prospectors/'+encodeURIComponent(link.dataset.creatorSlug)+'/videos/',{signal:controller.signal});if(!response.ok)throw new Error('Library unavailable');const library=await response.json();if(request===controller&&dialog.open)showLibrary(library);}
  catch(error){if(controller.signal.aborted||request!==controller)return;const fallback=element('a','Open the video library page');fallback.href=link.href;content.replaceChildren(element('p','The video library could not load here.'),fallback);}
 });
}
const pageData=document.querySelector('#creator-video-page-data');if(pageData){try{bindFilters(document.querySelector('[data-video-page]'),JSON.parse(pageData.textContent));}catch{}}
