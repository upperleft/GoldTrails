import { readFileSync } from 'node:fs';
import {videoLibraryLink,videoLibraryAssets} from './creator-video-library.js';
import {creatorYoutubeLink} from './creator-channel-links.js';
import {assetUrl} from './asset-url.js';
// Hostinger loads the entry through require(), so startup must remain synchronous.
const shell = readFileSync(new URL('./page-shell.html', import.meta.url), 'utf8');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export function display(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return 'TBD';
  if (value === true || value === false) return value ? 'Yes' : 'No';
  return String(value);
}
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
const html = value => escapeHtml(display(value));
const destination = (url, label) => safeUrl(url) ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : '<span class="pending-label">TBD</span>';
const list = values => values.length ? values.map(x => x.name).join(', ') : null;
const fact = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${html(value)}</dd></div>`;
const section = (title, body, id = '') => `<section class="resource-placeholder"${id ? ` id="${id}"` : ''}><h2>${escapeHtml(title)}</h2>${body}</section>`;
const queryLink = (key, value, label) => `<a href="/prospectors/?${key}=${encodeURIComponent(value)}">${escapeHtml(label)}</a>`;
export function page(title, description, content, context, introduction, {eyebrow='GOLD TRAILS / PROSPECTOR DIRECTORY'} = {}) {
  const intro = `<section class="category-intro rust"><div>${eyebrow?`<span class="eyebrow">${escapeHtml(eyebrow)}</span>`:''}<h1>${escapeHtml(title)}</h1>${introduction?`<p>${escapeHtml(introduction)}</p>`:''}</div></section>`;
  const tokens = { TITLE: escapeHtml(title), DESCRIPTION: escapeHtml(description), INTRO: intro, CONTENT: content, CONTEXT: context };
  const rendered = shell.replace(/\{\{(TITLE|DESCRIPTION|INTRO|CONTENT|CONTEXT)\}\}/g, (_, key) => tokens[key]);
  return /data-video-(?:library|library-host|page)\b/.test(content + (context || '')) ? rendered.replace('</body>', videoLibraryAssets() + '</body>') : rendered;
}
// Public descriptions are retained; editorial placeholders belong in profile notes.
export function creatorDescription(value) {
 const text=typeof value==='string'?value.trim():'';
 return !text||/^(?:TBD|unknown|n\/a)$/i.test(text)||/(?:portrait|biograph(?:y|ies)).*(?:forthcoming|will (?:appear|follow)|being prepared)|^Creator research lead\b|^Prospecting creator in the Gold Trails research roster\b|^This creator is (?:a research lead|included in our research roster)\b|channel details.*(?:under review|being checked)|fuller biography|selected lessons and references will appear/i.test(text)?'':text;
}
const hasValue=value=>value!==null&&value!==undefined&&(typeof value!=='string'||Boolean(value.trim())&&!/^(?:TBD|unknown|n\/a)$/i.test(value.trim()));
const knownFact=(label,value)=>hasValue(value)?fact(label,value):'';
const publicLink=(url,label)=>safeUrl(url)?destination(url,label):'';
export function creatorPage(title,description,content,context='',introduction='',{profile=false}={}) {
 const breadcrumb='<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>'+(profile?'<a href="/prospectors/">Creators &amp; Videos</a><span>/</span><span aria-current="page">'+escapeHtml(title)+'</span>':'<span aria-current="page">Creators &amp; Videos</span>')+'</nav>';
 return page(title,description,content,context,introduction,{eyebrow:null})
  .replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,breadcrumb)
  .replace('class="category-page"','class="category-page '+(profile?'creator-profile-page':'creator-directory-page')+'"')
  .replace('</head>','<link rel="stylesheet" href="'+assetUrl('creator-map.css')+'"></head>');
}
function directoryContext() {
 return '<section class="panel related"><h2>Keep exploring</h2><a href="/articles/">Articles</a><a href="/glossary/">Glossary</a><a href="/clubs-groups/">Clubs &amp; Groups</a></section>';
}
export function directoryPage(criteria,result) {
 const select=(name,label,items)=>'<label>'+label+'<select name="'+name+'"><option value="">All '+label.toLowerCase()+'</option>'+items.map(x=>'<option value="'+escapeHtml(x.slug)+'"'+(criteria[name]===x.slug?' selected':'')+'>'+escapeHtml(x.name)+'</option>').join('')+'</select></label>';
 const search='<form class="directory-search" action="/prospectors/" method="get"><label class="search-keyword">Search creators<input name="q" type="search" maxlength="100" value="'+escapeHtml(criteria.q)+'" placeholder="Name, topic, region, or channel"></label>'+select('topic','Topics',result.topics)+select('region','Regions',result.regions)+((result.specialties||[]).length?select('specialty','Specialties',result.specialties):'')+'<button class="gold-button" type="submit">Find creators</button><a href="/prospectors/">Clear search</a></form>';
 const cards=result.people.map(p=>'<article class="article-card"><div class="article-content"><h2><a href="/prospectors/'+encodeURIComponent(p.slug)+'/">'+escapeHtml(p.display_name)+'</a></h2>'+(p.primary_region?'<p class="profile-region directory-region">⌖ '+escapeHtml(p.primary_region)+'</p>':'')+(creatorDescription(p.short_introduction)?'<p>'+escapeHtml(creatorDescription(p.short_introduction))+'</p>':'')+'<a href="/prospectors/'+encodeURIComponent(p.slug)+'/">View creator profile →</a>'+videoLibraryLink(p.slug,p.display_name)+'</div></article>').join('');
 const filtered=criteria.q||criteria.topic||criteria.region||criteria.specialty;
 const empty=section(filtered?'No matching creators yet':'The campfire is taking shape','<p>'+(filtered?'Try a different name, topic, or region, or clear your search.':'Our first researched profiles will appear here as they are ready.')+'</p><a href="/articles/">Browse articles</a>');
 const pageLink=number=>{const params=new URLSearchParams({q:criteria.q,topic:criteria.topic,region:criteria.region,specialty:criteria.specialty||'',page:String(number)});return '/prospectors/?'+escapeHtml(params.toString());};
 const pages=Math.max(1,Math.ceil(result.total/criteria.pageSize));
 const pagination='<nav class="directory-pagination" aria-label="Search results pages">'+(criteria.page>1?'<a href="'+pageLink(criteria.page-1)+'">← Previous</a>':'')+'<span>Page '+criteria.page+' of '+pages+'</span>'+(criteria.page<pages?'<a href="'+pageLink(criteria.page+1)+'">Next →</a>':'')+'</nav>';
 return creatorPage('Creators & Videos','Browse Gold Trails creator profiles, public channels and videos for free.','<section class="creator-directory-results">'+search+'<p class="directory-count" role="status">'+result.total+' profile'+(result.total===1?'':'s')+' found</p>'+(cards?'<div class="cards category-cards">'+cards+'</div>':empty)+pagination+'</section>',directoryContext(),'Find a familiar voice or a new one. Every creator profile and video link is free.');
}
export function profilePage(p) {
 const topics=p.topics||[],regions=p.regions||[],sources=p.sources||[],resources=p.resources||[];
 const topicButtons=[...new Map(topics.map(t=>[t.slug,t])).values()].map(t=>queryLink('topic',t.slug,t.name)).join('');
 const summary=creatorDescription(p.short_introduction);
 const location=p.primary_region||[p.state_province,p.country_code].filter(hasValue).join(', ');
 const roles=list(p.roles||[]);
 const actions=creatorYoutubeLink(p)+videoLibraryLink(p.slug,p.display_name);
 const intro='<section class="profile-summary" aria-label="Creator channels and location"><div>'+(roles?'<p class="profile-role">'+escapeHtml(roles)+'</p>':'')+'<p class="profile-region">⌖ '+escapeHtml(location||'Location unknown at this time')+'</p>'+(actions?'<div class="profile-actions">'+actions+'</div>':'')+(topicButtons?'<div class="topic-buttons">'+topicButtons+'</div>':'')+'</div></section>';
 const instruction=p.offers_instruction===null||p.offers_instruction===undefined?null:Boolean(p.offers_instruction);
 const factRows=knownFact('State / province',p.state_province)+knownFact('Country',p.country_code)+knownFact('Prospecting since',p.experience_since_year)+knownFact('Best for',list(p.audience||[]))+knownFact('Content formats',list(p.formats||[]))+knownFact('Languages',list(p.languages||[]))+knownFact('Offers instruction',instruction)+knownFact('Also known as',p.nickname);
 const facts=factRows?section('At a glance','<dl class="profile-facts">'+factRows+'</dl>'):'';
 const biography=creatorDescription(p.biography),instructionText=creatorDescription(p.instruction_description);
 const bio=biography&&biography!==summary?section('Background','<p class="preserve-lines">'+escapeHtml(biography)+'</p>'+(instruction&&instructionText?'<h3>Instruction</h3><p>'+escapeHtml(instructionText)+'</p>':'')):(instruction&&instructionText?section('Instruction','<p>'+escapeHtml(instructionText)+'</p>'):'');
 const associates=(p.associates||[]).length?section('People & associates','<div class="channel-list">'+p.associates.map(a=>'<div><strong>'+escapeHtml(a.display_name)+'</strong><span>'+escapeHtml(({co_creator:'Co-creator',partner:'Partner',friend:'Friend',collaborator:'Collaborator',other:'Associate'})[a.relationship_type]||'Associate')+'</span>'+(creatorDescription(a.description)?'<p>'+escapeHtml(creatorDescription(a.description))+'</p>':'')+(a.linked_slug?'<a href="/prospectors/'+escapeHtml(a.linked_slug)+'/">View individual profile</a>':'')+publicLink(a.canonical_url,'Individual website / channel')+publicLink(a.source_url,'Public source')+'</div>').join('')+'</div>'):'';
 const coverage=regions.length?section('Where they explore','<ul>'+regions.map(r=>'<li>'+queryLink('region',r.slug,r.name)+(r.relationship_type?' <small>('+escapeHtml(r.relationship_type.replaceAll('_',' '))+')</small>':'')+'</li>').join('')+'</ul>'):'';
 const channels=(p.channels||[]).map(c=>'<div><strong>'+escapeHtml([c.platform,c.channel_name].filter(hasValue).join(' · '))+'</strong>'+(creatorDescription(c.description)?'<span>'+escapeHtml(creatorDescription(c.description))+'</span>':'')+(hasValue(c.publishing_since_year)?'<span>Publishing since: '+escapeHtml(c.publishing_since_year)+'</span>':'')+publicLink(c.canonical_url,'Visit channel')+'</div>').join('');
 const contacts=(p.contacts||[]).filter(c=>hasValue(c.public_value)).map(c=>'<div><strong>'+(c.contact_type==='business_email'?'Public business email':'Contact page')+'</strong>'+(c.contact_type==='business_email'?'<span>'+escapeHtml(c.public_value)+'</span>':publicLink(c.public_value,'Open contact page'))+'</div>').join('');
 const channelSection=channels||contacts?section('Channels & contact','<div class="channel-list">'+channels+contacts+'</div>','channels'):'';
 const resourceSection=resources.length?section('Start with these resources',resources.map(r=>'<div class="profile-resource">'+(hasValue(r.format)?'<span class="eyebrow">'+escapeHtml(r.format)+'</span>':'')+'<h3>'+escapeHtml(r.title)+'</h3>'+(creatorDescription(r.summary)?'<p>'+escapeHtml(creatorDescription(r.summary))+'</p>':'')+publicLink(r.canonical_url,'Open '+r.title)+'</div>').join(''),'profile-resources'):'';
 const labels={public_name:'Publicly stated name',short_bio:'Research summary',youtube_channel_id:'YouTube channel ID',youtube_canonical_url:'Canonical YouTube URL',joined_youtube:'Joined YouTube',earliest_prospecting_video_date:'Earliest publicly available prospecting video',latest_prospecting_video_date:'Latest publicly available prospecting video',prospecting_start_year:'Creator-stated prospecting start year',experience_statement:'Creator-stated experience',experience_statement_date:'Experience statement date',public_video_count:'Public channel video count',video_count_basis:'Video count basis',website:'Public website',social_link:'Public social link',region:'Prospecting content region',specialty:'Specialty'};
 const claims=(p.researchClaims||[]).filter(r=>Object.hasOwn(labels,r.field_key)&&hasValue(r.claim_value));
 const lastChecked=claims.map(r=>String(r.checked_at||'')).filter(Boolean).sort().at(-1);
 const enriched=claims.length?'<h3>Researched profile details</h3>'+(lastChecked?'<p>Profile last researched: '+escapeHtml(lastChecked)+'</p>':'')+'<dl class="profile-facts">'+claims.map(r=>'<div><dt>'+escapeHtml(labels[r.field_key])+'</dt><dd>'+(['website','social_link','youtube_canonical_url'].includes(r.field_key)?publicLink(r.claim_value,'Open public link'):escapeHtml(r.claim_value))+'<small>'+[r.assessment?.replaceAll('_',' '),r.checked_at?'checked '+r.checked_at:''].filter(Boolean).map(escapeHtml).join(' · ')+'</small>'+publicLink(r.source_url,'Source')+(hasValue(r.locator)?'<small>'+escapeHtml(r.locator)+'</small>':'')+'</dd></div>').join('')+'</dl><p>Channel age and video count do not measure prospecting experience.</p>':'';
 const waterwaySection=(p.waterways||[]).length?'<h3>Waterways featured</h3><div class="channel-list">'+p.waterways.map(w=>{const location=[w.state_province,w.country].filter(hasValue).join(', ');const metadata=[w.publication_date?'Source publication: '+w.publication_date:'',w.checked_at?'checked '+w.checked_at:'',w.inspection_basis?'basis: '+w.inspection_basis:''].filter(Boolean).join(' · ');return '<div><strong>'+escapeHtml(w.name)+(location?' — '+escapeHtml(location):'')+'</strong><span>'+[w.location_status?w.location_status+' naming':'',w.resolution?w.resolution+' identity':''].filter(Boolean).map(escapeHtml).join(' · ')+'</span>'+(hasValue(w.public_note)?'<p>'+escapeHtml(w.public_note)+'</p>':'')+(metadata?'<span>'+escapeHtml(metadata)+'</span>':'')+publicLink(w.timestamp_seconds==null?w.source_url:safeUrl(w.source_url)?new URL(w.source_url).origin+new URL(w.source_url).pathname+'?'+new URLSearchParams({...Object.fromEntries(new URL(w.source_url).searchParams),t:String(w.timestamp_seconds)+'s'}):null,w.title)+'<span>Repeated visits: '+(new Set(p.waterways.filter(x=>x.waterway_key===w.waterway_key&&x.location_status==='explicit'&&x.visit_key).map(x=>x.visit_key)).size>1?'Multiple visits reported in supporting sources':'Not established')+'</span></div>';}).join('')+'</div><p>These sources describe creator content. They do not establish public access or permission to prospect.</p>':'';
 const status=({unverified:'Some profile details are still being checked.',source_checked:'Profile sources checked.',creator_confirmed:'Profile details confirmed by the creator.'})[p.verification_status]||'';
 const references=sources.length?'<ul>'+sources.map(s=>'<li>'+publicLink(s.canonical_url,s.title)+'</li>').join('')+'</ul>':'';
 const sourceNotes='<details class="profile-notes" id="profile-notes"><summary>Sources &amp; profile notes</summary><div>'+(status?'<p>'+escapeHtml(status)+'</p>':'')+references+enriched+waterwaySection+'<p>Regions describe broad public content coverage, not a home address or permission to prospect.</p></div></details>';
 const context='<section class="panel related"><h2>Keep exploring</h2>'+(channelSection?'<a href="#channels">Channels &amp; contact</a>':'')+(resourceSection?'<a href="#profile-resources">Selected resources</a>':'')+'<a href="#profile-notes">Sources &amp; profile notes</a><a href="/prospectors/">Creators &amp; Videos</a></section>';
 return creatorPage(p.display_name,summary||'Public creator profile, channels and resources on Gold Trails.',intro+bio+facts+associates+coverage+channelSection+resourceSection+sourceNotes,context,summary,{profile:true});
}
export function messagePage(title, message) {
  return page(title, message, section(title, `<p>${escapeHtml(message)}</p><a href="/prospectors/">Return to the directory</a>`), directoryContext(), 'There is always another trail to explore.');
}
