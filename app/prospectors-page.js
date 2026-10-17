import {creatorControls} from './creator-controls.js';
import {page,escapeHtml as h} from './directory-views.js';
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
  const videos=videoLibraryLink(p.slug,p.name);
  const map=canFindOnMap&&p.regions.length?`<a class="map-find" href="/gold-almanac/?creator=${encodeURIComponent(p.slug)}">Find on map</a>`:'';
  return `<article class="map-person" data-slug="${h(p.slug)}"${matchesCreator(p,filters)?'':' hidden'}><div><h2><a href="${h(p.profileUrl||'/prospectors/'+encodeURIComponent(p.slug)+'/')}">${h(p.name)}</a></h2><p class="creator-region">⌖ ${h(p.location||'Location unknown at this time')}</p><p>${h(p.introduction)}</p>${p.topics.length?`<small>${h([...new Set(p.topics.map(t=>t.name))].slice(0,5).join(' · '))}</small>`:''}</div>${videos||map?`<div class="creator-actions">${videos}${map}</div>`:''}</article>`;
 }).join('');
 const content=`<link rel="stylesheet" href="${assetUrl('creator-map.css')}"><section class="map-desk prospectors-desk"><span class="eyebrow">PEOPLE OF THE GOLD COUNTRY</span><h2>Find a familiar voice. Discover a new one.</h2><p>Explore the people behind the channels. The complete directory, creator profiles, and video links are free. Geographic discovery is part of the Plus Almanac.</p>${creatorControls(records,filters)}<p id="map-status" role="status" aria-live="polite">${visible.length} prospectors · profiles and video links are free</p><div id="map-people">${cards||'<p>No published prospectors are available yet.</p>'}</div><p id="creator-empty"${visible.length?' hidden':''}>No prospectors match these filters. Try a broader search or clear the filters.</p><noscript><p>All matching creators appear in the list. Instant filtering requires JavaScript.</p></noscript></section><script id="map-data" type="application/json">${JSON.stringify(records).replace(/</g,'\\u003c')}</script><script id="explorer-state" type="application/json">${JSON.stringify(filters).replace(/</g,'\\u003c')}</script><script type="module" src="${assetUrl('creator-map.js')}"></script>`;
 return page('Prospectors','Browse every Gold Trails creator profile and video library for free.',content,'','Patient teachers, field storytellers, and curious explorers. Meet the people behind the knowledge.')
 .replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">Prospectors</span></nav>')
 .replace('GOLD TRAILS / PROSPECTOR DIRECTORY','GOLD TRAILS / PROSPECTORS')
 .replace('<a href="/prospectors/">Prospectors</a>','<a href="/prospectors/" aria-current="page">Prospectors</a>');
}
