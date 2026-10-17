import {readFileSync} from 'node:fs';
import {assetUrl} from './asset-url.js';
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateVideoLibrary(data){
 const slugs=new Set(),ids=new Set();
 const text=value=>typeof value==='string'&&Boolean(value.trim())&&value.length<=600;
 if(!data||!/^\d{4}-\d{2}-\d{2}$/.test(data.checkedAt)||!Array.isArray(data.creators))throw new Error('Invalid video library');
 for(const creator of data.creators){
  if(!creator||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(creator.slug)||slugs.has(creator.slug)||!text(creator.name)||!/^UC[\w-]{22}$/.test(creator.channelId)||creator.channelUrl!=='https://www.youtube.com/channel/'+creator.channelId||!Array.isArray(creator.videos))throw new Error('Invalid video owner');
  slugs.add(creator.slug);
  for(const video of creator.videos){
   if(!video||!/^[\w-]{11}$/.test(video.id)||ids.has(video.id)||!text(video.title)||video.url!=='https://www.youtube.com/watch?v='+video.id||video.channelId!==creator.channelId||video.ownershipStatus!=='source_checked'||!/^\d{4}-\d{2}-\d{2}$/.test(video.checkedAt)||!text(video.subject)||!Array.isArray(video.tags)||video.tags.some(tag=>!text(tag)))throw new Error('Invalid verified video');
   ids.add(video.id);
  }
 }
 return data;
}
const data=validateVideoLibrary(JSON.parse(readFileSync(new URL('./creator-video-library.json',import.meta.url),'utf8')));
export const videoLibraryFor=slug=>{
 const creator=data.creators.find(c=>c.slug===slug);if(!creator)return null;
 return {slug:creator.slug,name:creator.name,channelId:creator.channelId,channelUrl:creator.channelUrl,uploaderName:creator.uploaderName||creator.name,attributionScope:creator.attributionScope||'uploader_channel',checkedAt:creator.checkedAt||data.checkedAt,
  videos:creator.videos.map(v=>({id:v.id,title:v.title,url:v.url,channelId:v.channelId,ownershipStatus:v.ownershipStatus,checkedAt:v.checkedAt,subject:v.subject,tags:[...v.tags]}))};
};
export const videoLibraryCount=slug=>data.creators.find(c=>c.slug===slug)?.videos.length||0;
export function videoLibraryLink(slug,name){
 const count=videoLibraryCount(slug);
 return count?`<a class="creator-video-link" href="/prospectors/${encodeURIComponent(slug)}/videos/" data-video-library data-creator-slug="${html(slug)}" aria-haspopup="dialog" aria-label="Video library for ${html(name)} · ${count} video${count===1?'':'s'}">▶ Video library <span>${count}</span></a>`:'';
}
export function videoLibraryAssets(){return `<link rel="stylesheet" href="${assetUrl('creator-videos.css')}"><dialog class="video-library-dialog" id="creator-video-dialog" aria-labelledby="video-library-title"><div class="video-library-header"><div><span class="eyebrow">THE SCREENING ROOM</span><h2 id="video-library-title">Video library</h2></div><button type="button" class="video-library-close" aria-label="Close video library">×</button></div><div id="video-library-content"></div></dialog><script type="module" src="${assetUrl('creator-videos.js')}"></script>`;}
export function videoLibraryControls(library){
 const subjects=[...new Set(library.videos.map(v=>v.subject).filter(Boolean))].sort();
 return `<div class="video-library-tools"><label>Search videos<input type="search" data-video-search maxlength="150" placeholder="Title, topic, or keyword"></label><label>Topic<select data-video-topic><option value="">All topics</option>${subjects.map(s=>`<option value="${html(s)}">${html(s)}</option>`).join('')}</select></label><label>Sort<select data-video-sort><option value="title">Title A–Z</option><option value="topic">Topic</option></select></label></div><p class="video-library-status" data-video-status role="status" aria-live="polite">${library.videos.length} selected video${library.videos.length===1?'':'s'}</p>`;
}
export function videoLibraryCards(library){return `<div class="video-library-grid" data-video-grid>${library.videos.map(video=>`<article class="video-library-card"><a class="video-library-watch" href="${html(video.url)}" target="_blank" rel="noopener noreferrer"><div class="video-library-image"><img src="https://i.ytimg.com/vi/${html(video.id)}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><span aria-hidden="true">▶</span></div><h3>${html(video.title)}</h3><span class="video-library-subject">${html(video.subject||'Prospecting video')}</span><span class="video-library-outbound">Watch on YouTube ↗</span></a></article>`).join('')}</div><p data-video-empty hidden>No videos match. Try a different keyword or topic.</p>`;}
export function videoLibraryBody(library){return `<p class="video-library-note">Selected videos from ${html(library.uploaderName||library.name)}. Topics are browsing categories; video content has not been independently reviewed. Each video opens on YouTube in a new tab.</p>${videoLibraryControls(library)}${videoLibraryCards(library)}<p class="video-library-source"><a href="${html(library.channelUrl)}" target="_blank" rel="noopener noreferrer">Browse the full channel ↗</a> · Channel ownership checked ${html(library.checkedAt)}</p>`;}
