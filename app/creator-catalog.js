import {readFileSync} from 'node:fs';
import {creatorPage,creatorDescription,creatorDestinations,escapeHtml,safeUrl} from './directory-views.js';
import {videoLibraryLink} from './creator-video-library.js';
import {creatorYoutubeLink,creatorYoutubeDestination,youtubeDestination,creatorSiteVideosLink} from './creator-channel-links.js';
const catalog=JSON.parse(readFileSync(new URL('./creator-catalog.json',import.meta.url),'utf8'));
const descriptions = new Map(Object.entries(JSON.parse(readFileSync(new URL('./creator-descriptions.json', import.meta.url), 'utf8'))));
export const creatorCatalog=()=>structuredClone(catalog);
export const catalogBySlug=slug=>catalog.find(p=>p.slug===slug);
function catalogDescription(entry) {
 const summary = creatorDescription(entry.summary);
 return summary ? {summary} : descriptions.get(entry.slug);
}

export function withCatalogDescription(person) {
 if (creatorDescription(person.short_introduction)) return person;
 const description = descriptions.get(person.slug);
 const summary = description?.summary || creatorDescription(catalogBySlug(person.slug)?.summary);
 if (!summary) return person;
 const sources = person.sources || [];
 const existingUrls = new Set(sources.map(source => source.canonical_url));
 return {
  ...person,
  short_introduction: summary,
  sources: [...sources, ...(description?.sources || []).filter(source => !existingUrls.has(source.canonical_url))]
 };
}

export function mergeCatalog(data) {
 const blocked = new Set(data.excludedSlugs || []);
 const people = [...data.people], regions = [...data.regions];
 for (const entry of catalog) {
  if (blocked.has(entry.slug)) continue;
  const index = people.findIndex(person => person.slug === entry.slug);
  if (index >= 0) {
   const person = withCatalogDescription(people[index]);
   people[index] = {...person, official_url: person.official_url || entry.official_url};
   if (entry.region && !regions.some(region => region.person_id === person.id && region.name === entry.region)) {
    regions.push({person_id: person.id, name: entry.region});
   }
   continue;
  }
  const id = 'catalog:' + entry.slug;
  people.push({
   id, slug: entry.slug, display_name: entry.name, official_url: entry.official_url,
   search_aliases: entry.search_aliases || '',
   short_introduction: catalogDescription(entry)?.summary || (entry.status === 'lead' ? 'Creator research lead; channel details are under review.' : 'Prospecting creator in the Gold Trails research roster.')
  });
  if (entry.region) regions.push({person_id: id, name: entry.region});
 }
 return {...data, people: people.sort((a, b) => a.display_name.localeCompare(b.display_name)), regions};
}
export function catalogProfile(p){
 const youtube=creatorYoutubeDestination(p),region=p.region||'Location unknown at this time';
 const url=safeUrl(p.official_url),website=safeUrl(p.website_url);
 const bio=Array.isArray(p.biography)?p.biography.filter(f=>typeof f.text==='string'&&safeUrl(f.source_url)):[];
 const {summary = '', sources = []} = catalogDescription(p) || {};
 const summaryLinks = sources.flatMap(source => {
  const href = safeUrl(source.canonical_url);
  return href ? ['<li><a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(source.title) + '</a></li>'] : [];
 });
 const summaryNotes = summaryLinks.length ? '<h3>Description sources</h3><ul>' + summaryLinks.join('') + '</ul>' : '';
 const actions=creatorYoutubeLink(p)+videoLibraryLink(p.slug,p.name)+creatorSiteVideosLink(p);
 const intro='<section class="profile-summary" aria-label="Creator channels and location"><div><p class="profile-region">⌖ '+escapeHtml(region)+'</p>'+(actions?'<div class="profile-actions">'+actions+'</div>':'')+(website?'<p><a href="'+escapeHtml(website)+'" target="_blank" rel="noopener noreferrer">Official website →</a></p>':'')+'</div></section>';
 const biography=bio.some(f=>f.text.trim()!==summary)?'<section class="resource-placeholder profile-background" aria-label="About this creator">'+bio.filter(f=>f.text.trim()!==summary).map(f=>'<p>'+escapeHtml(f.text)+' <a href="'+escapeHtml(safeUrl(f.source_url))+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(f.source_title||'Source')+' ↗</a></p>').join('')+'</section>':'';
 const notes='<details class="profile-notes" id="profile-notes"><summary>Sources &amp; profile notes</summary><div><p>'+(p.status==='lead'?'Some creator details are still being checked.':bio.length?'Profile checked against the linked public sources.':'Creator included in the public research roster.')+'</p>'+(p.checked_at?'<p>Last roster check: '+escapeHtml(p.checked_at)+'</p>':'')+(safeUrl(p.region_source)?'<p><a href="'+escapeHtml(p.region_source)+'" target="_blank" rel="noopener noreferrer">Source for this coverage region</a></p>':'')+(url&&url!==youtube?.url?'<p><a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+(youtubeDestination(url)?.isChannel?'YouTube channel source →':youtubeDestination(url)?'Related video on YouTube →':'Listed public source →')+'</a></p>':'')+summaryNotes+'<p>The region describes broad public content coverage, not an address or permission to prospect.</p></div></details>';
 return creatorPage(p.name,summary||'Public creator profile, channels and videos on Gold Trails.',intro+biography+creatorDestinations(p.slug)+notes,'',summary,{profile:true});
}
