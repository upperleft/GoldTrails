import {readFileSync} from 'node:fs';
import {escapeHtml as h,safeUrl} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';
import {funFindsNavigation} from '../site-navigation.js';
import {findPages,foodFinds,giftFinds,diyIdeas,snackBreak,unverifiedConcepts} from './catalog.js';

const template=readFileSync(new URL('../page-shell.html',import.meta.url),'utf8');
const external=(url,label)=>safeUrl(url)?`<a href="${h(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${h(label)} <span aria-hidden="true">↗</span></a>`:'';
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value || '')?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'Date not recorded';
const status={available:'Offered when checked',listed:'Maker / seller listing',unconfirmed:'Availability not confirmed',unavailable:'Not currently offered'};
const icons={candy:'◆','edible-gold':'✦',experiences:'⌖',accessories:'◇',home:'▧',novelties:'◈'};
function price(find){
 if(!find.price||!Number.isFinite(find.price.amount)||!find.price.currency||!find.price.checkedAt)return '';
 let amount;try{amount=new Intl.NumberFormat('en-US',{style:'currency',currency:find.price.currency}).format(find.price.amount);}catch{return '';}
 return `<p class="find-price">${h(amount)} <span>${h(find.price.currency)} · checked ${h(date(find.price.checkedAt))}; price can change.</span></p>`;
}
function card(find){
 const checked=[...new Set(find.sources.map(source=>source.checkedAt))].sort();
 const checkLabel=checked.length===1?date(checked[0]):checked.map(date).join(' · ');
 return `<li class="find-card" id="${h(find.id)}"><article aria-labelledby="find-title-${h(find.id)}"><div class="find-heading"><span class="find-icon" aria-hidden="true">${icons[find.section] || '◇'}</span><div><p class="find-classification">${h(find.classification)}</p><h3 id="find-title-${h(find.id)}">${h(find.name)}</h3></div></div><p>${h(find.summary)}</p>${find.material?`<p class="find-material"><strong>Material / ingredients:</strong> ${h(find.material)}</p>`:''}${find.location?`<p class="find-location"><strong>Where:</strong> ${h(find.location)}</p>`:''}<p class="find-availability"><strong>${h(status[find.availability])}.</strong> ${h(find.availabilityNote || '')}</p>${price(find)}<div class="find-link">${external(find.url,find.linkLabel || 'View source listing')}</div><p class="find-checked">Last checked ${h(checkLabel)}</p><details class="find-sources"><summary>Sources &amp; details</summary><ul>${find.sources.map(source=>`<li>${external(source.url,new URL(source.url).hostname.replace(/^www\./,''))}<small>Checked ${h(date(source.checkedAt))}. ${h(source.note)}</small></li>`).join('')}</ul></details></article></li>`;
}
function kitchenIdeas(){
 return `<section class="finds-kitchen" id="kitchen-ideas" aria-labelledby="kitchen-title"><span class="eyebrow">ORIGINAL GOLD TRAILS IDEAS</span><h2 id="kitchen-title">Make your own little gold rush</h2><p>These are kitchen ideas, separate from the products above. Use food ingredients and kitchen bowls, spoons, and tools only. Keep real soil, paydirt, gold pans, and other prospecting equipment away from food preparation.</p><div class="finds-ideas">${diyIdeas.map(idea=>`<article><h3>${h(idea.name)}</h3><p>${h(idea.summary)}</p><p><strong>Gather:</strong> ${h(idea.materials.join(' · '))}</p><ol>${idea.steps.map(step=>`<li>${h(step)}</li>`).join('')}</ol><p class="finds-note">${h(idea.note)}</p></article>`).join('')}</div></section>`;
}
function snack(){
 return `<aside class="finds-snack" aria-labelledby="snack-title"><span class="eyebrow">PROSPECTOR’S SNACK BREAK</span><h2 id="snack-title">${h(snackBreak.name)}</h2><p>${h(snackBreak.summary)}</p>${external(snackBreak.url,snackBreak.linkLabel)}<small>Checked ${h(date(snackBreak.sources[0]?.checkedAt))} · A playful name connection, separate from the edible-gold collection.</small></aside>`;
}
function concepts(){
 return `<section class="finds-concepts" id="on-the-wish-list" aria-labelledby="concept-title"><span class="eyebrow">ON THE WISH LIST</span><h2 id="concept-title">A nugget we haven’t found yet</h2>${unverifiedConcepts.map(concept=>`<article><h3>${h(concept.name)}</h3><p>${h(concept.summary)}</p><p class="finds-concept-label"><strong>Original concept · No verified product listing</strong></p><p>${h(concept.note)}</p></article>`).join('')}</section>`;
}
export function renderFunFindsPage(kind){
 const page=findPages[kind];if(!page)throw new Error('Unknown Fun & Finds page');
 const finds=kind==='food'?foodFinds:giftFinds;
 const sections=page.sections.filter(section=>finds.some(find=>find.section===section.id));
 const jumpLinks=`<nav class="finds-section-links" aria-label="On this page">${sections.map(section=>`<a href="#${section.id}">${h(section.title)}</a>`).join('')}${kind==='food'?'<a href="#kitchen-ideas">Make your own</a>':'<a href="#on-the-wish-list">The nugget pillow idea</a>'}</nav>`;
 const collection=sections.map(section=>`<section class="finds-section" id="${section.id}" aria-labelledby="section-${section.id}"><h2 id="section-${section.id}">${h(section.title)}</h2><p class="finds-section-intro">${h(section.intro)}</p><ul class="finds-grid">${finds.filter(find=>find.section===section.id).map(card).join('')}</ul></section>`).join('');
 const content=`${funFindsNavigation(page.route)}${jumpLinks}${collection}${kind==='food'?kitchenIdeas()+snack():concepts()}<section class="finds-about" aria-labelledby="finds-about-title"><h2 id="finds-about-title">A few notes before following the trail</h2><p>Gold Trails links out to the maker, seller, or operator. This collection is research, rather than hands-on product reviews. Listings, prices, menus, and stock can change; a source page does not guarantee checkout, shipping, or a place on today’s menu.</p><p>${kind==='food'?'Gold-colored food, real edible gold, and removable foil packaging are labeled separately. Check the product’s ingredient, allergen, and food-use information before choosing it.':'Materials and shapes are described as the source identifies them. Gold-colored materials and printed pictures do not establish real-gold content. A pillow shaped like a bar is different from an irregular nugget cushion.'}</p><p>For another kind of treasure, explore <a href="/gold-games/">Gold Games</a>. For real prospecting, start with our <a href="/articles/">field articles</a>, <a href="/products/">equipment catalog</a>, or <a href="/clubs-groups/">Clubs &amp; Groups</a>.</p></section>`;
 const intro=`<section class="category-intro rust"><div><span class="eyebrow">${h(page.eyebrow)}</span><h1>${h(page.title)}</h1><p>${h(page.intro)}</p></div></section>`;
 const tokens={TITLE:page.title,DESCRIPTION:page.description,INTRO:intro,CONTENT:content};
 return template.replace('body class="category-page"',`body class="category-page fun-finds-page finds-${kind}"`).replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,`<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">${h(page.title)}</span></nav>`).replace(/\{\{(TITLE|DESCRIPTION|INTRO|CONTENT)\}\}/g,(_,key)=>tokens[key]).replace('</head>',`<link rel="canonical" href="https://goldtrails.org${page.route}"><link rel="stylesheet" href="${assetUrl('fun-finds.css')}"></head>`);
}
