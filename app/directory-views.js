import { readFileSync } from 'node:fs';
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
const destination = (url, label) => safeUrl(url) ? `<a href="${escapeHtml(safeUrl(url))}" rel="noopener noreferrer">${escapeHtml(label)}</a>` : '<span class="pending-label">TBD</span>';
const list = values => values.length ? values.map(x => x.name).join(', ') : null;
const fact = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${html(value)}</dd></div>`;
const section = (title, body, id = '') => `<section class="resource-placeholder"${id ? ` id="${id}"` : ''}><h2>${escapeHtml(title)}</h2>${body}</section>`;
const queryLink = (key, value, label) => `<a href="/prospectors/?${key}=${encodeURIComponent(value)}">${escapeHtml(label)}</a>`;
export function page(title, description, content, context, introduction) {
  const intro = `<section class="category-intro rust"><div><span class="eyebrow">GOLD TRAILS / PROSPECTOR DIRECTORY</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(introduction)}</p></div></section>`;
  const tokens = { TITLE: escapeHtml(title), DESCRIPTION: escapeHtml(description), INTRO: intro, CONTENT: content, CONTEXT: context };
  return shell.replace(/\{\{(TITLE|DESCRIPTION|INTRO|CONTENT|CONTEXT)\}\}/g, (_, key) => tokens[key]);
}
function directoryContext() {
  return `<section class="panel related"><span class="eyebrow">AROUND THE CAMPFIRE</span><h2>Keep exploring</h2><a href="/creators-experts/">Creators &amp; Experts</a><a href="/collections/creator-resource-lists/">Creator resource lists</a><a href="/collections/featured-lessons-collection/">Featured lessons</a></section><section class="panel related"><h2>Profile preview</h2><p>See the layout with a clearly fictional example.</p><a href="/prospectors/jack-riverbend-morgan/">View the sample profile</a></section>`;
}
export function directoryPage(criteria, result) {
  const select = (name, label, items) => `<label>${label}<select name="${name}"><option value="">All ${label.toLowerCase()}</option>${items.map(x => `<option value="${escapeHtml(x.slug)}"${criteria[name] === x.slug ? ' selected' : ''}>${escapeHtml(x.name)}</option>`).join('')}</select></label>`;
  const search = `<form class="directory-search" action="/prospectors/" method="get"><label class="search-keyword">Search the campfire<input name="q" type="search" maxlength="100" value="${escapeHtml(criteria.q)}" placeholder="Name, topic, region, or channel"></label>${select('topic','Topics',result.topics)}${select('region','Regions',result.regions)}<button class="gold-button" type="submit">Find prospectors</button><a href="/prospectors/">Clear search</a></form>`;
  const cards = result.people.map(p => `<article class="article-card"><div class="article-content"><span class="eyebrow">PROSPECTOR PROFILE</span><h3><a href="/prospectors/${encodeURIComponent(p.slug)}/">${escapeHtml(p.display_name)}</a></h3><p class="profile-region directory-region">⌖ ${html(p.primary_region)}</p><p>${html(p.short_introduction)}</p><a href="/prospectors/${encodeURIComponent(p.slug)}/">Meet this prospector →</a></div></article>`).join('');
  const filtered = criteria.q || criteria.topic || criteria.region;
  const empty = section(filtered ? 'No matching prospectors yet' : 'The campfire is taking shape', `<p>${filtered ? 'Try a different name, topic, or region, or clear your search.' : 'Our first researched profiles will appear here as they are ready.'}</p><a href="/prospectors/jack-riverbend-morgan/">Explore the fictional profile preview</a>`);
  const pageLink = number => { const params = new URLSearchParams({ q:criteria.q, topic:criteria.topic, region:criteria.region, page:String(number) }); return '/prospectors/?' + escapeHtml(params.toString()); };
  const pages = Math.max(1, Math.ceil(result.total / criteria.pageSize));
  const pagination = `<nav class="directory-pagination" aria-label="Search results pages">${criteria.page > 1 ? `<a href="${pageLink(criteria.page - 1)}">← Previous</a>` : ''}<span>Page ${criteria.page} of ${pages}</span>${criteria.page < pages ? `<a href="${pageLink(criteria.page + 1)}">Next →</a>` : ''}</nav>`;
  return page('Meet the prospectors', 'Search Gold Trails prospector profiles by name, topic, region, or creator channel.', section('Find a voice for your next trail', search) + `<p class="directory-count" role="status">${result.total} profile${result.total === 1 ? '' : 's'} found</p>` + (cards ? `<div class="cards category-cards">${cards}</div>` : empty) + pagination, directoryContext(), 'Patient teachers, field storytellers, and curious explorers. Find the people behind the knowledge.');
}
export function profilePage(p) {
  const initials = p.display_name.trim().split(/\s+/).slice(0,2).map(x => Array.from(x)[0]).join('');
  const topicButtons = [...new Map(p.topics.map(t => [t.slug,t])).values()].map(t => queryLink('topic',t.slug,t.name)).join('');
  const intro = `<section class="profile-summary"><div class="profile-avatar" aria-label="Portrait placeholder">${escapeHtml(initials)}<small>PORTRAIT<br>FORTHCOMING</small></div><div><span class="eyebrow">MEET THE PROSPECTOR</span><h2>${escapeHtml(p.display_name)}</h2><p class="profile-role">${html(list(p.roles))}</p><p class="profile-region">⌖ ${html(p.primary_region)}</p><div class="topic-buttons">${topicButtons}</div></div></section>`;
  const instruction = p.offers_instruction === null ? null : Boolean(p.offers_instruction);
  const facts = section('At a glance', `<dl class="profile-facts">${fact('Primary region',p.primary_region)}${fact('State / province',p.state_province)}${fact('Country',p.country_code)}${fact('Prospecting since',p.experience_since_year)}${fact('Best for',list(p.audience))}${fact('Content formats',list(p.formats))}${fact('Languages',list(p.languages))}${fact('Offers instruction',instruction)}${fact('Also known as',p.nickname)}${fact('Profile status',({ unverified:'Sources pending',source_checked:'Sources checked',creator_confirmed:'Creator confirmed' })[p.verification_status])}</dl>`);
  const bio = section('Background', `<p class="preserve-lines">${html(p.biography)}</p>${instruction ? `<h3>Instruction</h3><p>${html(p.instruction_description)}</p>` : ''}`);
  const regions = section('Where they explore', p.regions.length ? `<ul>${p.regions.map(r => `<li>${queryLink('region',r.slug,r.name)} <small>(${escapeHtml(r.relationship_type.replaceAll('_',' '))})</small></li>`).join('')}</ul>` : `<p>${html(p.primary_region)}</p>`);
  const channels = p.channels.map(c => `<div><strong>${escapeHtml(c.platform)} · ${escapeHtml(c.channel_name)}</strong><span>${html(c.description)}</span><span>Publishing since: ${html(c.publishing_since_year)}</span>${destination(c.canonical_url,'Visit channel')}</div>`).join('');
  const contacts = p.contacts.map(c => `<div><strong>${c.contact_type === 'business_email' ? 'Public business email' : 'Contact page'}</strong>${c.contact_type === 'business_email' ? `<span>${html(c.public_value)}</span>` : destination(c.public_value,'Open contact page')}</div>`).join('');
  const channelSection = section('Channels & contact', `<div class="channel-list">${channels || '<div><strong>Official channels</strong><span class="pending-label">TBD</span></div>'}${contacts || '<div><strong>Public contact</strong><span class="pending-label">TBD</span></div>'}</div>`, 'channels');
  const resources = section('Start with these resources', p.resources.length ? p.resources.map(r => `<div class="profile-resource"><span class="eyebrow">${escapeHtml(r.format)}</span><h3>${escapeHtml(r.title)}</h3><p>${html(r.summary)}</p>${destination(r.canonical_url,'Open resource')}</div>`).join('') : '<p>Selected lessons and references will appear here as they are ready.</p>', 'profile-resources');
  const sources = section('Profile sources', p.sources.length ? `<ul>${p.sources.map(s => `<li>${destination(s.canonical_url,s.title)}</li>`).join('')}</ul>` : '<p>Source references are TBD.</p>');
  const context = `<section class="panel related"><span class="eyebrow">THIS PROSPECTOR</span><h2>Quick connections</h2><a href="#channels">Channels &amp; contact</a><a href="#profile-resources">Selected resources</a><a href="/prospectors/">Back to the directory</a></section><section class="panel related"><span class="eyebrow">FOLLOW THE CONTEXT</span><h2>Related trails</h2>${topicButtons || '<p>Topic connections: TBD</p>'}${p.primary_region_slug ? queryLink('region',p.primary_region_slug,p.primary_region) : ''}<a href="/collections/creator-resource-lists/">Creator resource collections</a></section><section class="panel related"><h2>Field notes</h2><p>Regions describe a creator’s broad coverage. Check local access and prospecting rules before planning a visit.</p></section>`;
  return page(p.display_name, p.short_introduction || 'Prospector profile, channels, regional knowledge, and resources on Gold Trails.', intro + facts + bio + regions + channelSection + resources + sources, context, display(p.short_introduction));
}
export function messagePage(title, message) {
  return page(title, message, section(title, `<p>${escapeHtml(message)}</p><a href="/prospectors/">Return to the directory</a>`), directoryContext(), 'There is always another trail to explore.');
}
