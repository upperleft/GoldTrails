import {creatorControls} from './creator-controls.js';
import {creatorPage,creatorDescription,escapeHtml as h} from './directory-views.js';
import {assetUrl} from './asset-url.js';
import {videoLibraryLink} from './creator-video-library.js';
import {matchesCreator,sortCreators} from '../dist/prospectors-data.js';
export function explorerCriteria(params,criteria){
 const view=params.get('view')||'list',setting=params.get('setting')||'',sort=params.get('sort')||'az';
 if(!['list','map'].includes(view)||!['','river','ground','mine','unknown'].includes(setting)||!['az','za'].includes(sort))return null;
 return {...criteria,view,setting,sort};
}
export function prospectorsPage(records,filters,{canFindOnMap=false}={}){
 const ordered=sortCreators(records,filters.sort),visible=ordered.filter(p=>matchesCreator(p,filters));
 const cards=ordered.map(p=>{
  const videos=videoLibraryLink(p.slug,p.name),description=creatorDescription(p.introduction);
  const map=canFindOnMap&&p.regions.length?`<a class="map-find" href="/gold-almanac/?creator=${encodeURIComponent(p.slug)}">Find on map</a>`:'';
  return `<article class="map-person" data-slug="${h(p.slug)}"${matchesCreator(p,filters)?'':' hidden'}><div><h2><a href="${h(p.profileUrl||'/prospectors/'+encodeURIComponent(p.slug)+'/')}">${h(p.name)}</a></h2>${p.location?`<p class="creator-region">⌖ ${h(p.location)}</p>`:''}${description?`<p>${h(description)}</p>`:''}${p.topics.length?`<small>${h([...new Set(p.topics.map(t=>t.name))].slice(0,5).join(' · '))}</small>`:''}</div>${videos||map?`<div class="creator-actions">${videos}${map}</div>`:''}</article>`;
 }).join('');
 const content=`<section class="map-desk prospectors-desk" aria-label="Search and browse creators">${creatorControls(records,filters,{views:canFindOnMap})}<p id="map-status" role="status" aria-live="polite">${visible.length} creators · profiles and video links are free</p><div id="map-people">${cards||'<p>No published creators are available yet.</p>'}</div><p id="creator-empty"${visible.length?' hidden':''}>No creators match these filters. Try a broader search or clear the filters.</p><noscript><p>All matching creators appear in the list. Instant filtering requires JavaScript.</p></noscript></section><script id="map-data" type="application/json">${JSON.stringify(records).replace(/</g,'\\u003c')}</script><script id="explorer-state" type="application/json">${JSON.stringify(filters).replace(/</g,'\\u003c')}</script><script type="module" src="${assetUrl('creator-map.js')}"></script>`;
 return creatorPage('Creators & Videos','Browse every Gold Trails creator profile and video library for free.',content,'','Find a familiar voice or a new one. Every creator profile and video link is free.');
}
