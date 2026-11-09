import {productPhotoLinks,productPhotoDialog} from './product-photos.js';
import {matchesProduct,compareProducts,productFilters,productFilterUrl} from '../dist/products.js';
import {assetUrl} from './asset-url.js';
import {readFileSync} from 'node:fs';
import {escapeHtml as h,safeUrl} from './directory-views.js';
import {catalogBySlug} from './creator-catalog.js';

// The supplied research stays in a portable file; no database migration is needed.
const catalog=JSON.parse(readFileSync(new URL('./product-catalog.json',import.meta.url),'utf8'));
const shellTemplate=readFileSync(new URL('./page-shell.html',import.meta.url),'utf8');
const evidence=catalog.tables.creator_product_evidence;
const creatorProfiles=new Map(catalog.tables.creators
 .filter(creator=>creator.identity_status==='confirmed'&&creator.profile_slug)
 .map(creator=>[creator.creator_id,catalogBySlug(creator.profile_slug)]));
export const productCatalog=()=>structuredClone(catalog.tables.products);
export function mergedProducts(overrides=[]) {
 const byId=new Map(overrides.map(r=>[r.product_id, typeof r.changes_json==='string'?JSON.parse(r.changes_json):r.changes_json]));
 return productCatalog().map(p=>({...p,...(byId.get(p.product_id)||{}),product_id:p.product_id}));
}

const split=value=>String(value||'').split('|').filter(Boolean);
const link=(url,label)=>safeUrl(url)?`<a href="${h(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${h(label)} ↗</a>`:'';
const fact=(label,value)=>value!==''&&value!==null&&value!==undefined?`<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`:'';
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):String(value||'');
const availability=value=>({current:'Listed product',unknown:'Availability not recorded','out of stock':'Out of stock',discontinued:'Discontinued','made to order':'Made to order'})[value]||value||'Availability not recorded';
const pumpGuide=`<details class="product-catalog-info"><summary>Choosing a pump and hoses for a highbanker</summary>
<p>For a pump on the bank, water runs from a screened intake through a short, reinforced suction hose to the pump. A lay-flat discharge hose carries it from the pump outlet up to the highbanker. A submersible electric pump sits in the water and feeds the discharge hose directly.</p>
<p>Start with the highbanker’s required flow. Compare the pump curve at the height from the water surface to the outlet, allowing for friction in the hose and fittings and any pressure the spray bar requires. Match the port sizes, connector types and pressure ratings before choosing hoses.</p>
<p>${link('https://powerequipment.honda.com/pumps/pump-theory','Honda pump sizing guide')} · ${link('https://keeneeng.com/pdfFiles/HBCK%20Instructions.pdf','Keene highbanker setup instructions')}</p></details>`;
const merchandise=`<section class="product-merchandise" aria-labelledby="product-merchandise-heading"><h2 id="product-merchandise-heading">Gold Trails Merchandise</h2><a class="product-merchandise-link" href="https://gold-trails.printify.me/product/33276034" target="_blank" rel="noopener noreferrer" aria-label="View the Gold Trails mug on Printify (opens in a new tab)"><img src="/assets/merchandise/gold-trails-15oz-mug.png" width="2048" height="2048" alt="White ceramic mug with the green and gold Gold Trails mountain and crossed-picks logo" decoding="async"><span>Gold Trails mug<small>View on Printify <span aria-hidden="true">↗</span></small></span></a></section>`;

function price(p){
 if(p.listed_price===''||p.listed_price===null||p.listed_price===undefined)return 'Price not recorded';
 return `${p.currency||p.price_symbol_as_displayed||''} ${p.listed_price}${p.listed_price_max!==''&&p.listed_price_max!=null?'–'+p.listed_price_max:''}`.trim();
}
function productItem(p){
 const names=[...new Set(evidence.filter(item=>item.product_id===p.product_id)
  .flatMap(item=>[item.creator_name,creatorProfiles.get(item.creator_id)?.name]).filter(Boolean))];
 return {name:p.product_name,brand:p.manufacturer_or_brand,category:p.category,search:[p.product_name,p.manufacturer_or_brand,p.model,p.category,p.subcategory,p.short_description,p.intended_gold_prospecting_use,p.techniques,p.settings,p.important_specifications,...names].join(' ')};
}
function creatorEvidenceSections(product,connections){
 const documented=[],related=[];
 for(const item of connections){
  const sameModel=item.model===product.model&&item.brand===product.manufacturer_or_brand;
  const exactUse=sameModel&&item.use_scope==='exact_model'&&item.confirmed_use===true&&item.identification_confidence==='confirmed';
  const profile=exactUse?creatorProfiles.get(item.creator_id):null;
  const name=profile?`<a href="/prospectors/${encodeURIComponent(profile.slug)}/">${h(profile.name)}</a>`:h(item.creator_name);
  let label=item.evidence_type&&item.evidence_type!=='unclear'?item.evidence_type:item.relationship_type;
  if(exactUse&&item.explicit_recommendation)label='Use and recommendation';
  else if(item.use_scope==='product_family')label='Use of the product family';
  else if(item.use_scope==='exact_model'&&!sameModel)label='Use reported for '+item.model;
  const card=`<div><p><strong>${name}</strong> · ${h(label)}</p><p>${h(item.verified_paraphrase)}</p>
   ${item.sponsorship_or_affiliate_disclosure?`<p class="product-note">${h(item.sponsorship_or_affiliate_disclosure)}</p>`:''}
   ${link(item.source_url,item.source_title||'Evidence source')}${item.timestamp?`<small> · ${h(item.timestamp)}</small>`:''}
   ${item.notes?`<p class="product-note">${h(item.notes)}</p>`:''}</div>`;
  (exactUse?documented:related).push(card);
 }
 const use=documented.length?`<section class="product-evidence"><h3>Documented product use</h3>${documented.join('')}</section>`:'';
 const other=related.length?`<section class="product-evidence"><h3>${documented.length?'Other creator connections':'Creator connections'}</h3>${related.join('')}</section>`:'';
 return use+other;
}
function row(p,hidden=false){
 const connections=evidence.filter(e=>e.product_id===p.product_id);
 const search=productItem(p).search;
 const sources=[...new Set(split(p.source_urls))];
 const purchases=[...new Set([p.manufacturer_purchase_url,...split(p.reseller_purchase_urls)].filter(url=>url&&url!==p.official_product_url))];
 return `<li class="product-row" id="${h(p.product_id)}" data-name="${h(p.product_name)}" data-brand="${h(p.manufacturer_or_brand)}" data-category="${h(p.category)}" data-search="${h(search)}"${hidden?' hidden':''}><article>
 <div class="product-overview"><div class="product-summary"><h2>${h(p.product_name)}</h2><p class="product-brand">${h(split(p.manufacturer_or_brand).join(' · '))} · ${h(p.category)}${p.date_added?` · Added <time datetime="${h(p.date_added)}">${h(date(p.date_added))}</time>`:''}</p><p class="product-description">${h(p.short_description)}</p><div class="product-actions">${link(p.official_product_url||p.manufacturer_website,'Manufacturer website')}<span class="product-price${p.listed_price===''||p.listed_price===null||p.listed_price===undefined?' product-price-unknown':''}">${h(price(p))}${p.listed_price!==''&&p.listed_price!==null&&p.listed_price!==undefined&&!p.currency?' <span class="product-currency-note">(Currency not confirmed)</span>':''}</span></div></div><div class="product-media">${productPhotoLinks(p)}</div></div>
 <details class="product-details"><summary>Details &amp; sources</summary><div class="product-detail-body">${p.techniques?`<p class="product-tags"><strong>Techniques:</strong> ${h(split(p.techniques).join(' · '))}</p>`:''}<dl class="product-facts">${fact('Type',p.subcategory||p.category)}${fact('Recorded availability',availability(p.availability))}${fact('Price checked',p.price_checked_date?date(p.price_checked_date):'')}${fact('Gold-prospecting use',p.intended_gold_prospecting_use)}${fact('Specifications',p.important_specifications)}${fact('Dimensions',p.dimensions)}${fact('Weight',p.weight_value!==''?`${p.weight_value} ${p.weight_unit||''}`:'')}${fact('Weight basis',p.weight_basis)}${fact('Power',p.power_requirements)}${fact('Water',p.water_requirements)}${fact('Portability',p.portability_notes)}${fact('Compatibility',p.compatibility)}${fact('Required accessories',p.required_accessories)}${fact('Variants',p.variant_options)}${fact('Price context',p.price_basis)}${fact('Stock notes',p.stock_status_notes)}${fact('Research date',p.date_researched)}</dl>
 ${creatorEvidenceSections(p,connections)}
 <section class="product-sources"><h3>Sources &amp; purchase links</h3><ul>${sources.map((url,i)=>link(url,`Research source ${i+1}`)).filter(Boolean).map(a=>`<li>${a}</li>`).join('')}${purchases.map((url,i)=>link(url,`Purchase listing ${i+1}`)).filter(Boolean).map(a=>`<li>${a}</li>`).join('')}</ul></section>
 ${p.missing_information_and_uncertainty?`<p class="product-note"><strong>Research notes:</strong> ${h(p.missing_information_and_uncertainty)}</p>`:''}<p class="product-feedback"><a href="/products/report/?product=${h(p.product_id)}" aria-label="${h('Report a change to '+p.product_name)}">Report a change</a><span>Suggest a correction or updated product information for the Gold Trails editor to review.</span></p></div></details></article></li>`;
}
export function renderProductsPage(products=productCatalog(),notice='',params=new URLSearchParams()) {
const categories=[...new Set(products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b));
const filters=productFilters(params,categories),ordered=[...products].sort((a,b)=>compareProducts(productItem(a),productItem(b),filters.sort));
const visible=products.filter(p=>matchesProduct(productItem(p),filters.query,filters.category)).length;
const categoryLinks=[{name:'All products',value:'',count:products.length},...categories.map(name=>({name,value:name,count:products.filter(p=>p.category===name).length}))];
const categoryNavigation=`<nav class="product-category-nav" aria-label="Product categories">${categoryLinks.map(item=>`<a href="${h(productFilterUrl({...filters,category:item.value}))}" data-product-category="${h(item.value)}"${filters.category===item.value?' aria-current="page"':''}>${h(item.name)} <span class="category-count">(${item.count})</span></a>`).join('')}</nav>`;
const content=`${notice?`<p role="status" class="product-catalog-note">${h(notice)}</p>`:''}${merchandise}<section class="product-desk"><div class="product-desk-heading"><p>Compare ${products.length} products, from pans and sluices to camp stoves and coffee pots. Open Details &amp; sources for specifications, research dates, and creator notes.</p></div>${categoryNavigation}<div class="product-controls" hidden><label class="product-search-label">Search products<input type="search" id="product-search" value="${h(filters.query)}" placeholder="Try sluice, Garrett, waders, or Klesh" maxlength="200"></label><label>Category<select id="product-category"><option value="">All categories</option>${categories.map(c=>`<option value="${h(c)}"${filters.category===c?' selected':''}>${h(c)}</option>`).join('')}</select></label><label>Sort by<select id="product-sort">${[['name','Product name A–Z'],['name-desc','Product name Z–A'],['brand','Brand A–Z'],['category','Category A–Z']].map(([value,label])=>`<option value="${value}"${filters.sort===value?' selected':''}>${label}</option>`).join('')}</select></label><button class="gold-button small" id="product-reset" type="button">Clear</button></div><details class="product-catalog-info"><summary>About this catalog</summary><p class="product-catalog-note">Prices and availability reflect the recorded research date. Creator notes distinguish product use, recommendations, and business connections. Manufacturer links open in a new tab or window; Gold Trails does not sell the equipment listed in this research catalog.</p><p class="product-catalog-note">Make or sell prospecting equipment? Open an entry’s Details &amp; sources and use “Report a change” to suggest a correction, updated description, or replacement product. Submissions go to our private review queue.</p></details>${pumpGuide}<p id="product-count" role="status" aria-live="polite">${visible} product${visible===1?'':'s'}${visible!==products.length?' of '+products.length:''}</p><ul class="product-list" id="product-list">${ordered.map(p=>row(p,!matchesProduct(productItem(p),filters.query,filters.category))).join('')}</ul><p id="product-empty"${visible?' hidden':''}>No products match. Try a broader search or clear the category.</p><noscript><p>Category links work without JavaScript. Search and sorting controls require JavaScript.</p></noscript></section>`;
let shell=shellTemplate;
shell=shell.replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">Products</span></nav>');
shell=shell.replace('<a href="/products/">Products</a>','<a href="/products/" aria-current="page">Products</a>');
shell=shell.replace('</head>',`<link rel="stylesheet" href="${assetUrl('products.css')}"></head>`).replace('</body>',`<script type="module" src="${assetUrl('products.js')}"></script><script type="module" src="${assetUrl('product-photos.js')}"></script>${productPhotoDialog()}</body>`);
const intro='<section class="category-intro rust"><div><span class="eyebrow">GOLD TRAILS / EQUIPMENT &amp; FIELD GEAR</span><h1>Products</h1><p>Tools for muddy boots, curious minds, and a day beside the water.</p></div><picture class="old-timer-vignette" aria-hidden="true"><source media="(min-width:1100px)" srcset="/assets/old-timer-coffee-v1.webp"><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" width="160" height="160" alt="" loading="lazy" decoding="async"></picture></section>';
const tokens={TITLE:'Products',DESCRIPTION:'Search and explore gold-prospecting equipment, specifications, source links, and documented creator connections.',INTRO:intro,CONTENT:content};
shell=shell.replace(/\{\{(TITLE|DESCRIPTION|INTRO|CONTENT)\}\}/g,(_,key)=>tokens[key]);
return shell.replace(/[ \t]+\n/g,'\n');
}
