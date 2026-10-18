import {assetUrl} from './asset-url.js';

// Shared labels and server-filtered links for the full sidebar and compact phone menu.
const destinations=[
 ['/', 'Gold Trails home'], ['/articles/', 'Articles'],
 ['/prospectors/', 'Creators &amp; Videos'], ['/glossary/', 'Prospector’s glossary'],
 ['/products/', 'Products'], ['/clubs-groups/', 'Clubs &amp; Groups'],
 ['/calendar/', 'My calendar'], ['/gold-almanac/', 'Almanac', true],
 ['/connections/', 'Gold Connections', true], ['/plus/', 'Gold Trails Plus'],
 ['/about-the-camp/', 'About Gold Trails']
];
const active=(href,path)=>href==='/'?path==='/':path===href||path.startsWith(href);
function contentBeforeSidebar(html){
 const sidebar=html.match(/<aside\b[^>]*class="[^"]*\bleft\b[^"]*"[^>]*>[\s\S]*?<\/aside>/);
 const center=html.match(/<div\b[^>]*class="[^"]*\bcenter\b[^"]*"[^>]*>/);
 if(!sidebar||!center||sidebar.index>center.index)return html;
 // Move only the sidebar. Balanced div tags retain every nested article and form intact.
 let result=html.slice(0,sidebar.index)+html.slice(sidebar.index+sidebar[0].length);
 const start=center.index-sidebar[0].length,divs=/<\/?div\b[^>]*>/g;divs.lastIndex=start;
 let depth=0,token;
 while((token=divs.exec(result))){depth+=token[0].startsWith('</')?-1:1;if(depth===0)return result.slice(0,divs.lastIndex)+sidebar[0]+result.slice(divs.lastIndex);}
 return html;
}
export function navigationLinks(path='/',{premium=false}={}){
 const home=path==='/';
 return destinations.filter(([href,,paid])=>!(home&&href==='/plus/')&&(!paid||premium||(home&&href==='/gold-almanac/'))).map(([href,label])=>{
  // Home has one named Almanac entry: a public description or the member feature.
  if(home&&href==='/gold-almanac/'){href=premium?href:'/plus/';label=premium?'Almanac':'Almanac · Plus';}
  return `<a href="${href}"${active(href,path)?' aria-current="page"':''}>${label}</a>`;
 }).join('');
}
export function siteNavigationMarkup(html,{path='/',premium=false}={}){
 if(typeof html!=='string'||!html.includes('</head>')||!html.includes('trail-menu')||html.includes('data-site-navigation'))return html;
 const links=navigationLinks(path,{premium});
 const menu=/<section\b[^>]*class="[^"]*\btrail-menu\b[^"]*"[^>]*>[\s\S]*?<\/section>/g;
 let found=false;
 let result=html.replace(menu,()=>{found=true;return `<section class="panel trail-menu" data-site-navigation><h2>At the field desk</h2><nav aria-label="Main navigation">${links}</nav></section>`;});
 if(!found)return html;
 // The artwork homepage has its own main before the classic text homepage.
 result=result.replace(/<main\b(?![^>]*class="[^"]*home-graphical)[^>]*>/,match=>match+`<details class="site-mobile-menu"><summary>Menu</summary><nav aria-label="Main navigation">${links}</nav></details>`);
 return contentBeforeSidebar(result).replace('</head>',`<link rel="stylesheet" href="${assetUrl('design-refinements.css')}"></head>`);
}
export function attachSiteNavigation(req,res,url,{premium=false}={}){
 if(!['GET','HEAD'].includes(req.method)||/^\/(?:admin|api)(?:\/|$)/.test(url.pathname))return;
 const end=res.end.bind(res),head=res.writeHead.bind(res);let type='';
 res.writeHead=function(status,message,headers){
  const supplied=typeof message==='object'?message:headers;
  type=String(Object.entries(supplied||{}).find(([key])=>key.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');
  if(type.includes('text/html')){
   res.removeHeader('Content-Length');
   if(supplied)for(const key of Object.keys(supplied))if(key.toLowerCase()==='content-length')delete supplied[key];
   // Sidebar navigation varies with the verified session, even on static article pages.
   const current=String(Object.entries(supplied||{}).find(([key])=>key.toLowerCase()==='vary')?.[1]||res.getHeader('Vary')||'');
   const vary=[...new Set(current.split(',').map(v=>v.trim()).filter(Boolean).concat('Cookie'))].join(', ');
   if(supplied){for(const key of Object.keys(supplied))if(['cache-control','vary'].includes(key.toLowerCase()))delete supplied[key];supplied['Cache-Control']='private, no-store';supplied.Vary=vary;}
   else {res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary',vary);}
  }
  return typeof message==='string'?head(status,message,headers):head(status,message);
 };
 res.end=function(chunk,encoding,callback){
  if(type.includes('text/html')&&chunk)chunk=Buffer.from(siteNavigationMarkup(Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk),{path:url.pathname,premium}));
  return end(chunk,encoding,callback);
 };
}
