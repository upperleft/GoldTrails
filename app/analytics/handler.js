import {assetUrl} from '../asset-url.js';
import {page} from '../directory-views.js';
import {publicPath,validateEvent} from './model.js';
const bot=/bot\b|crawler|spider|headless|lighthouse|preview|facebookexternalhit|slurp/i;
export function analyticsMarkup(html,path){
 if(!publicPath(path)||typeof html!=='string'||!html.includes('</body>'))return html;
 return html.replace('</head>',`<link rel="stylesheet" href="${assetUrl('site-analytics.css')}"></head>`).replace('</body>',`<script src="${assetUrl('site-analytics.js')}" defer></script></body>`);
}
export function attachAnalyticsMarkup(req,res,url){
 if(!publicPath(url.pathname)||!['GET','HEAD'].includes(req.method)||req.headers.cookie?.includes('__Host-gold-admin='))return;
 const end=res.end.bind(res),writeHead=res.writeHead.bind(res);let contentType='';
 res.writeHead=function(status,message,headers){
  const supplied=typeof message==='object'?message:headers;
  contentType=String(Object.entries(supplied||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');
  if(contentType.includes('text/html')){res.removeHeader('Content-Length');if(supplied)for(const key of Object.keys(supplied))if(key.toLowerCase()==='content-length')delete supplied[key];}
  return typeof message==='string'?writeHead(status,message,headers):writeHead(status,message);
 };
 res.end=function(chunk,encoding,callback){
  if(res.statusCode===200&&(contentType||String(res.getHeader('Content-Type')||'')).includes('text/html')&&chunk){
   const before=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk),after=analyticsMarkup(before,url.pathname);
   if(before!==after){chunk=Buffer.from(after);if(!res.headersSent)res.removeHeader('Content-Length');}
  }
  return end(chunk,encoding,callback);
 };
}
export function createAnalyticsHandler({store=null,origin='',log=console.error}={}){
 let windowStart=Date.now(),requests=0;
 const handler=async(req,res,url)=>{
  if(url.pathname==='/privacy/usage/'){
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return true;}
   const html=page('Usage statistics and your choice','How Gold Trails measures visits and resource clicks.',`<section class="resource-placeholder"><h2>Help us learn what is useful</h2><p>Optional statistics count public page visits and clicks to outside resources. Measurement starts only after you choose Allow. Declining does not restrict the library.</p><p>When you allow measurement, this browser stores a random visitor code for up to 90 days and a visit code that changes after 30 minutes without a measured action. The server stores hashes of these codes, public page paths, external destinations, referring website domains, broad screen-size categories and server timestamps.</p><p>We do not add account names, account emails, IP addresses, form answers, search text, private calendars or private member pages to this analytics dataset. Link query strings are removed except validated YouTube video identifiers and timestamps. These statistics are pseudonymous, not a claim of complete anonymity. They stay in the Gold Trails database and are not sent to an advertising analytics provider.</p><p>Usage events are retained for the most recent 90 UTC calendar days and older events are purged when analytics is used. Hosting and payment providers may maintain separate operational records. No payment information is collected here.</p><p>Use Usage preferences at the bottom of a public page to withdraw consent or decline. Withdrawal stops future events and removes the browser codes; already recorded events expire through retention. Do Not Track and Global Privacy Control signals disable this measurement.</p><p>Visitor totals are estimates of participating browsers. Different devices count separately; blocked scripts and declined measurement are absent. An outbound click is not proof of watching, purchasing or reading the destination.</p><p><a href="/">Return to Gold Trails</a></p></section>`,'','Your library access stays the same whatever you choose.').replace('</body>',`<link rel="stylesheet" href="${assetUrl('site-analytics.css')}"><script src="${assetUrl('site-analytics.js')}" defer></script></body>`);
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:html);return true;
  }
  if(url.pathname!=='/api/usage/')return false;
  const reply=status=>{res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end();};
  if(req.method!=='POST'){reply(405);return true;}
  if(!origin||req.headers.origin!==origin||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'){reply(403);return true;}
  if(req.headers['sec-gpc']==='1'||req.headers.dnt==='1'||bot.test(req.headers['user-agent']||'')||req.headers.cookie?.includes('__Host-gold-admin=')){reply(204);return true;}
  if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
  if(++requests>600){reply(429);return true;}
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){reply(415);return true;}
  if(Number(req.headers['content-length']||0)>4096){reply(413);return true;}
  let size=0,chunks=[];
  try{
   for await(const chunk of req){size+=chunk.length;if(size>4096){reply(413);return true;}chunks.push(chunk);}
   const event=validateEvent(JSON.parse(Buffer.concat(chunks).toString('utf8')),origin);
   if(!store||!await store.ready()){reply(503);return true;}
   await store.record(event);reply(204);
  }catch(error){if(error instanceof SyntaxError||error.message?.startsWith('Invalid usage'))reply(400);else{log('Gold Trails usage statistics unavailable');reply(503);}}
  return true;
 };
 handler.enabled=async()=>{try{return Boolean(store&&await store.ready());}catch{return false;}};
 return handler;
}
