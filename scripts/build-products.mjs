import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {escapeHtml as h,safeUrl} from '../app/directory-views.js';

// The supplied research stays in a portable file; no database migration is needed.
const catalog=JSON.parse(await readFile('app/product-catalog.json','utf8'));
const {products,creator_product_evidence:evidence}=catalog.tables;
const split=value=>String(value||'').split('|').filter(Boolean);
const link=(url,label)=>safeUrl(url)?`<a href="${h(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${h(label)} ↗</a>`:'';
const fact=(label,value)=>value!==''&&value!==null&&value!==undefined?`<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`:'';
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):String(value||'');
const availability=value=>({current:'Listed product',unknown:'Availability not recorded','out of stock':'Out of stock',discontinued:'Discontinued','made to order':'Made to order'})[value]||value||'Availability not recorded';
const categories=[...new Set(products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b));
function price(p){
 if(p.listed_price===''||p.listed_price===null||p.listed_price===undefined)return 'Price not recorded';
 return `${p.currency||p.price_symbol_as_displayed||''} ${p.listed_price}${p.listed_price_max!==''&&p.listed_price_max!=null?'–'+p.listed_price_max:''}`.trim();
}
function row(p){
 const connections=evidence.filter(e=>e.product_id===p.product_id);
 const names=[...new Set(connections.map(e=>e.creator_name))];
 const search=[p.product_name,p.manufacturer_or_brand,p.model,p.category,p.subcategory,p.short_description,p.intended_gold_prospecting_use,p.techniques,p.settings,p.important_specifications,...names].join(' ');
 const sources=[...new Set(split(p.source_urls))];
 const purchases=[...new Set([p.manufacturer_purchase_url,...split(p.reseller_purchase_urls)].filter(url=>url&&url!==p.official_product_url))];
 // Optional image_url can be added to a record after a photo has been approved.
 const image=typeof p.image_url==='string'&&(p.image_url.startsWith('/images/products/')||safeUrl(p.image_url))?`<img class="product-photo" src="${h(p.image_url)}" alt="${h(p.product_name)}" loading="lazy">`:'';
 return `<li class="product-row" id="${h(p.product_id)}" data-name="${h(p.product_name)}" data-brand="${h(p.manufacturer_or_brand)}" data-category="${h(p.category)}" data-search="${h(search)}"><article>
 <div class="product-overview${image?' with-photo':''}">${image}<div><span class="eyebrow">${h(p.subcategory||p.category)}</span><h2>${h(p.product_name)}</h2><p class="product-brand">${h(split(p.manufacturer_or_brand).join(' · '))} · ${h(p.category)}</p><p>${h(p.short_description)}</p><p class="product-tags">${h(split(p.techniques).join(' · '))}</p>${names.length?`<p class="product-connections">Creator connections: ${h(names.join(' · '))}</p>`:''}</div><div class="product-price"><strong>${h(price(p))}</strong>${p.listed_price!==''&&!p.currency?'<small>Currency not confirmed</small>':''}<small>${h(availability(p.availability))}</small>${p.price_checked_date?`<small>Price checked ${h(date(p.price_checked_date))}</small>`:''}${link(p.official_product_url,'Product website')}</div></div>
 <details class="product-details"><summary>Specifications, sources &amp; creator notes</summary><div class="product-detail-body"><dl class="product-facts">${fact('Gold-prospecting use',p.intended_gold_prospecting_use)}${fact('Specifications',p.important_specifications)}${fact('Dimensions',p.dimensions)}${fact('Weight',p.weight_value!==''?`${p.weight_value} ${p.weight_unit||''}`:'')}${fact('Weight basis',p.weight_basis)}${fact('Power',p.power_requirements)}${fact('Water',p.water_requirements)}${fact('Portability',p.portability_notes)}${fact('Compatibility',p.compatibility)}${fact('Required accessories',p.required_accessories)}${fact('Variants',p.variant_options)}${fact('Price context',p.price_basis)}${fact('Stock notes',p.stock_status_notes)}${fact('Research date',p.date_researched)}</dl>
 ${connections.length?`<section class="product-evidence"><h3>Creator connections</h3>${connections.map(e=>`<div><p><strong>${h(e.creator_name)}</strong> · ${h(e.evidence_type||e.relationship_type)}</p><p>${h(e.verified_paraphrase)}</p>${e.sponsorship_or_affiliate_disclosure?`<p class="product-note">${h(e.sponsorship_or_affiliate_disclosure)}</p>`:''}${link(e.source_url,e.source_title||'Evidence source')}${e.timestamp?`<small> · ${h(e.timestamp)}</small>`:''}${e.notes?`<p class="product-note">${h(e.notes)}</p>`:''}</div>`).join('')}</section>`:''}
 <section class="product-sources"><h3>Sources &amp; purchase links</h3><ul>${sources.map((url,i)=>link(url,`Research source ${i+1}`)).filter(Boolean).map(a=>`<li>${a}</li>`).join('')}${purchases.map((url,i)=>link(url,`Purchase listing ${i+1}`)).filter(Boolean).map(a=>`<li>${a}</li>`).join('')}</ul></section>
 ${p.missing_information_and_uncertainty?`<p class="product-note"><strong>Research notes:</strong> ${h(p.missing_information_and_uncertainty)}</p>`:''}</div></details></article></li>`;
}
const content=`<section class="product-desk"><div class="product-desk-heading"><span class="eyebrow">THE EQUIPMENT SHELF</span><h2>Find the right tool for your trail</h2><p>Browse ${products.length} product records, from pans and sluices to field equipment. Open an entry for specifications and the sources behind it.</p></div><div class="product-controls" hidden><label class="product-search-label">Search products<input type="search" id="product-search" placeholder="Try sluice, Garrett, waders, or Klesh" maxlength="200"></label><label>Category<select id="product-category"><option value="">All categories</option>${categories.map(c=>`<option value="${h(c)}">${h(c)}</option>`).join('')}</select></label><label>Sort by<select id="product-sort"><option value="name">Product name A–Z</option><option value="name-desc">Product name Z–A</option><option value="brand">Brand A–Z</option><option value="category">Category A–Z</option></select></label><button class="gold-button small" id="product-reset" type="button">Clear</button></div><p class="product-catalog-note">Prices and availability reflect the recorded research date. Creator notes distinguish product use, recommendations, and business connections. External links open in a new tab or window.</p><p id="product-count" role="status" aria-live="polite">${products.length} products</p><ul class="product-list" id="product-list">${[...products].sort((a,b)=>a.product_name.localeCompare(b.product_name)).map(row).join('')}</ul><p id="product-empty" hidden>No products match. Try a broader search or clear the category.</p><noscript><p>Search and sorting require JavaScript. All product entries and details are available below.</p></noscript></section>`;
let shell=await readFile('app/page-shell.html','utf8');
shell=shell.replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">Products</span></nav>');
shell=shell.replace('<a href="/products/">Products</a>','<a href="/products/" aria-current="page">Products</a>');
shell=shell.replace('</head>','<link rel="stylesheet" href="/products.css"></head>').replace('</body>','<script type="module" src="/products.js"></script></body>');
const intro='<section class="category-intro rust"><div><span class="eyebrow">GOLD TRAILS / EQUIPMENT &amp; FIELD GEAR</span><h1>Products</h1><p>Tools for muddy boots, curious minds, and a day beside the water.</p></div></section>';
const tokens={TITLE:'Products',DESCRIPTION:'Search and explore gold-prospecting equipment, specifications, source links, and documented creator connections.',INTRO:intro,CONTENT:content};
shell=shell.replace(/\{\{(TITLE|DESCRIPTION|INTRO|CONTENT)\}\}/g,(_,key)=>tokens[key]);
await mkdir('dist/products',{recursive:true});await writeFile('dist/products/index.html',shell);
console.log(`Products catalog: ${products.length} entries, ${categories.length} categories.`);
