import {assetUrl} from './asset-url.js';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {token,digest} from './admin-auth.js';
import {page,escapeHtml as h} from './directory-views.js';
import {productCatalog,renderProductsPage} from './products-page.js';
import {reportInput,reportTypes,ProductInputError} from './product-workspace.js';
const read=req=>(req.headers.cookie||'').match(/(?:^|;\s*)__Host-gold-report=([a-f0-9]{64})(?:;|$)/)?.[1];
const shell=(title,body)=>page(title,'Suggest a correction to the Gold Trails equipment catalog.',`<section class="resource-placeholder product-report-card"><h2>${h(title)}</h2>${body}</section>`,'','Keep the equipment shelf accurate.').replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,`<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/products/">Products</a><span>/</span><span aria-current="page">${h(title)}</span></nav>`).replace('</head>',`<link rel="stylesheet" href="${assetUrl('products.css')}"></head>`);
const field=(name,label,max,type='text')=>`<label>${label}<input name="${name}" type="${type}" maxlength="${max}"></label>`;
const form=(p,nonce)=>shell('Report a product change',`<p><strong>${h(p.product_name)}</strong><br>${h(p.manufacturer_or_brand)} · ${h(p.product_id)}</p><p>Suggest a correction, updated description, or replacement product. Your report goes to the private administrator queue for review.</p><form class="admin-form product-report-form" action="/products/report/" method="post"><input type="hidden" name="csrf" value="${nonce}"><input type="hidden" name="submission_id" value="${randomUUID()}"><input type="hidden" name="product" value="${h(p.product_id)}"><label>What changed?<select name="report_type">${Object.entries(reportTypes).map(([v,l])=>`<option value="${v}">${h(l)}</option>`).join('')}</select></label>${field('suggested_url','Updated product or source URL (optional)',2048,'url')}<label class="full">Describe the correction<textarea name="message" required minlength="10" maxlength="4000" rows="5"></textarea></label>${field('sender_name','Your name (optional)',180)}${field('business_name','Business name (optional)',180)}${field('reply_email','Reply email (optional)',254,'email')}<div class="report-trap" aria-hidden="true"><label>Leave this blank<input name="company_website" maxlength="200" tabindex="-1" autocomplete="off"></label></div><p class="full product-note">Contact details stay private and are used to review this report or follow up. Submitting a report does not establish manufacturer ownership. You can submit without an account.</p><button class="gold-button" type="submit">Send to Gold Trails</button></form><p><a href="/products/#${h(p.product_id)}">Return to this product</a></p>`);
async function fields(req){if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw new ProductInputError('Use the product report form.');let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20000)throw new ProductInputError('This report is too large.');chunks.push(chunk);}const f=new URLSearchParams(Buffer.concat(chunks).toString('utf8')),seen=new Set();for(const k of f.keys()){if(seen.has(k))throw new ProductInputError('Refresh the form before submitting.');seen.add(k);}return f;}
export function createProductsHandler({store=null,members=null,config=null,log=console.error}={}){return async(req,res,url)=>{
 if(!['/products','/products/','/products/report','/products/report/'].includes(url.pathname))return false;
 const send=(status,html,extra={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'strict-origin','X-Content-Type-Options':'nosniff',...extra});res.end(req.method==='HEAD'?undefined:html);};
 if(!url.pathname.endsWith('/')){send(308,'',{Location:url.pathname+'/'+url.search});return true;}
 if(!['GET','HEAD','POST'].includes(req.method)){send(405,shell('Use the report form','<p>This action is unavailable.</p>'),{Allow:'GET, HEAD, POST'});return true;}
 if(url.pathname==='/products/'){
  if(req.method==='POST'){send(405,shell('Use the product form','<p>Browse the catalog or report a change.</p>'),{Allow:'GET, HEAD'});return true;}
  try{send(200,renderProductsPage(store?await store.products():productCatalog()));}catch{log('Gold Trails product updates unavailable');send(200,renderProductsPage(productCatalog(),'Editor updates are temporarily unavailable. Showing the original research catalog.'));}return true;
 }
 const csp={'Content-Security-Policy':"default-src 'self'; script-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"};
 let nonce=read(req)||token();
 try{
  if(!store||!config||!await store.ready()){send(503,shell('Reports are being prepared','<p>The correction queue is temporarily unavailable. Please try again later.</p><a href="/products/">Return to products</a>'),csp);return true;}
  let f;if(req.method==='POST'){
   if(req.headers.origin!==config.origin){send(403,shell('Refresh your report','<p>Use the report form on Gold Trails.</p>'),csp);return true;}
   f=await fields(req);const submitted=f.get('csrf');if(!read(req)||!/^[a-f0-9]{64}$/.test(submitted||'')||!timingSafeEqual(Buffer.from(nonce),Buffer.from(submitted))){send(403,shell('Refresh your report','<p>The form has expired. Return to the product and open a fresh report.</p><a href="/products/">Return to products</a>'),csp);return true;}
  }
  const id=f?f.get('product'):url.searchParams.get('product'),entry=await store.product(id);if(!entry){send(404,shell('Product not found','<p>Choose a product from the catalog.</p><a href="/products/">Browse products</a>'),csp);return true;}
  if(f){const data=reportInput(f);if(!await store.allowReport(nonce)){send(429,shell('Take a short break','<p>Please wait 15 minutes before sending another report.</p>'),{...csp,'Retry-After':'900'});return true;}
   const raw=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-gold-member=([a-f0-9]{64})(?:;|$)/)?.[1];const member=members&&raw?await members.session(raw):null;
   const reference=await store.submit(entry.product,digest(nonce+'|'+f.get('submission_id')),data,member?.id||null);
   send(200,shell('Thank you for the correction',`<div role="status"><h3>Your report is in the review queue</h3><p>The Gold Trails administrator will review your suggestion. The published listing has not changed yet.</p><p>Reference: ${h(reference)}</p></div><a class="gold-button" href="/products/#${h(id)}">Return to this product</a>`),csp);return true;
  }
  send(200,form(entry.product,nonce),{...csp,...(!read(req)?{'Set-Cookie':`__Host-gold-report=${nonce}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=7200`}:{})});
 }catch(e){if(e instanceof ProductInputError)send(400,shell('Check your report',`<p role="alert">${h(e.message)}</p><p>Use Back to correct your entries. Your report has not been saved.</p>`),csp);else{log('Gold Trails product report unavailable');send(503,shell('A pause at the equipment shelf','<p>We could not confirm that your report was saved. Please try again. Repeating the same submission will not create a second report.</p>'),csp);}}return true;
};}
