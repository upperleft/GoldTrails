import {readFileSync} from 'node:fs';
import {creatorPage,creatorDescription,escapeHtml,safeUrl} from './directory-views.js';
import {videoLibraryLink} from './creator-video-library.js';
import {creatorYoutubeLink,creatorYoutubeDestination,youtubeDestination} from './creator-channel-links.js';
const catalog=JSON.parse(readFileSync(new URL('./creator-catalog.json',import.meta.url),'utf8'));
export const creatorCatalog=()=>structuredClone(catalog);
export const catalogBySlug=slug=>catalog.find(p=>p.slug===slug);
export function mergeCatalog(data){const blocked=new Set(data.excludedSlugs||[]),existing=new Set(data.people.map(p=>p.slug));const people=[...data.people],regions=[...data.regions];for(const p of catalog){if(blocked.has(p.slug))continue;if(existing.has(p.slug)){const current=people.find(x=>x.slug===p.slug);if(p.region&&!regions.some(x=>x.person_id===current.id&&x.name===p.region))regions.push({person_id:current.id,name:p.region});continue;}people.push({id:'catalog:'+p.slug,slug:p.slug,display_name:p.name,search_aliases:p.search_aliases||'',short_introduction:p.summary||(p.status==='lead'?'Creator research lead; channel details are under review.':'Prospecting creator in the Gold Trails research roster.')});if(p.region)regions.push({person_id:'catalog:'+p.slug,name:p.region});}return {...data,people:people.sort((a,b)=>a.display_name.localeCompare(b.display_name)),regions};}
export function catalogProfile(p){
 const youtube=creatorYoutubeDestination(p),region=p.region||'Location unknown at this time';
 const url=safeUrl(p.official_url),website=safeUrl(p.website_url);
 const bio=Array.isArray(p.biography)?p.biography.filter(f=>typeof f.text==='string'&&safeUrl(f.source_url)):[];
 const summary=creatorDescription(p.summary);
 const actions=creatorYoutubeLink(p)+videoLibraryLink(p.slug,p.name);
 const intro='<section class="profile-summary" aria-label="Creator channels and location"><div><p class="profile-region">⌖ '+escapeHtml(region)+'</p>'+(actions?'<div class="profile-actions">'+actions+'</div>':'')+(website?'<p><a href="'+escapeHtml(website)+'" target="_blank" rel="noopener noreferrer">Official website →</a></p>':'')+'</div></section>';
 const biography=bio.some(f=>f.text.trim()!==summary)?'<section class="resource-placeholder profile-background" aria-label="About this creator">'+bio.filter(f=>f.text.trim()!==summary).map(f=>'<p>'+escapeHtml(f.text)+' <a href="'+escapeHtml(safeUrl(f.source_url))+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(f.source_title||'Source')+' ↗</a></p>').join('')+'</section>':'';
 const notes='<details class="profile-notes" id="profile-notes"><summary>Sources &amp; profile notes</summary><div><p>'+(p.status==='lead'?'Some creator details are still being checked.':bio.length?'Profile checked against the linked public sources.':'Creator included in the public research roster.')+'</p>'+(p.checked_at?'<p>Last roster check: '+escapeHtml(p.checked_at)+'</p>':'')+(safeUrl(p.region_source)?'<p><a href="'+escapeHtml(p.region_source)+'" target="_blank" rel="noopener noreferrer">Source for this coverage region</a></p>':'')+(url&&url!==youtube?.url?'<p><a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+(youtubeDestination(url)?.isChannel?'YouTube channel source →':youtubeDestination(url)?'Related video on YouTube →':'Listed public source →')+'</a></p>':'')+'<p>The region describes broad public content coverage, not an address or permission to prospect.</p></div></details>';
 return creatorPage(p.name,summary||'Public creator profile, channels and videos on Gold Trails.',intro+biography+notes,'',summary,{profile:true});
}
