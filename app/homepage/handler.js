import {readFile} from 'node:fs/promises';
import {hotspots,canvas} from './hotspots.js';
import {escapeHtml as h} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';
import {guestPlusAccess} from '../plus/guest-access.js';

const blank='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const desktop='(min-width: 1280px) and (hover: hover) and (pointer: fine)';
const frame=[0,0,canvas.width,canvas.height];
const position=([x,y,w,height],[sx,sy,sw,sh]=frame)=>`left:${(x-sx)/sw*100}%;top:${(y-sy)/sh*100}%;width:${w/sw*100}%;height:${height/sh*100}%`;

// This changes discovery links only. The feature handlers still enforce access.
export function homeHotspots({member=null,guest=false}={}){
 const premium=member?.effective_level==='subscriber'||guest===true;
 return hotspots.map(item=>{
  if(premium||!['nav-almanac','nav-almanac-help','nav-connections','nav-connections-help'].includes(item.id))return item;
  const products=item.id.startsWith('nav-almanac');
  const name=products?'Products':'Clubs & Groups';
  return {...item,name:item.type==='help'?name+' help':name,label:item.type==='help'?'About '+name:name,
   href:products?'/products/':'/clubs-groups/',premium:false,
   text:products?'Explore the free product catalog, photographs and linked demonstrations.':'Find gold prospecting clubs, organizations and online groups. The public directory is free to explore.'};
 });
}

function overlay(items,rect,member){return items.map(p=>{
 const style=position(p.rect,rect),name=p.account&&member?'My account':p.name;
 const attrs=`class="home-hotspot home-hotspot-${p.type}${p.section!=='sidebar'&&p.type==='help'?' home-help-roomy':''}" style="${style}" data-home-id="${p.id}" data-home-name="${h(name)}" aria-label="${h(p.account&&member?'My account':p.label)}"`;
 const nav=p.id.startsWith('nav-')&&p.type!=='help';
 const buttonLabel=p.id==='hero-articles'?'Read articles →':p.id==='hero-glossary'?'Browse the glossary →':p.id==='panel-destinations-button'?'Browse creators →':p.id==='panel-articles-button'?'Read articles →':p.id==='panel-glossary-button'?'Browse the glossary →':p.id==='panel-plus-button'?'Explore Gold Trails Plus →':null;
 const visible=nav?`<span class="home-nav-label">${h(name)}</span>`:buttonLabel?`<span class="home-button-label${p.id==='hero-glossary'?' home-button-green':''}">${h(buttonLabel)}</span>`:`<span class="home-sr">${h(name)}</span>`;
 if(p.type==='link')return `<a ${attrs} href="${p.account&&member?'/account/':p.href}"${p.account?' data-home-account':''}>${visible}</a>`;
 return `<button ${attrs} type="button" aria-expanded="false" aria-controls="home-info"${p.type==='help'?` data-home-help="${h(p.text)}"${p.premium?' data-home-premium="plus"':''}`:' data-home-search'}>${p.type==='help'?'<span class="home-help-mark" aria-hidden="true">?</span>':visible}<span class="home-sr">${h(p.label)}</span></button>`;
 }).join('');}

function picture(id,rect){return `<picture><source media="${desktop}" srcset="/assets/homepage/${id}.webp"><img src="${blank}" width="${rect[2]}" height="${rect[3]}" alt="" aria-hidden="true" decoding="async" fetchpriority="high"></picture>`;}

function liveSceneCopy(){
 const panel=(id,rect,title,subtitle,text)=>`<section class="home-live-copy home-live-panel" style="${position(rect)}" aria-labelledby="home-live-${id}"><h2 id="home-live-${id}">${title}</h2><p class="home-panel-subtitle">${subtitle}</p><p>${text}</p></section>`;
 return `<section class="home-live-copy home-live-hero" style="${position([812,195,724,219])}" aria-labelledby="home-welcome"><p class="home-live-brand">Gold Trails</p><h1 id="home-welcome">Explore. Learn. Connect.</h1><p>Gold prospecting knowledge, stories, and a friendly community—all in one place.</p></section>
 ${panel('creators',[327,730,289,124],'Creators &amp; Videos','Free to explore','Meet prospectors and explore their linked videos.')}
 ${panel('articles',[642,730,289,124],'Articles','Practical guides &amp; stories','Practical how-tos, geology and equipment guides.')}
 ${panel('glossary',[957,730,282,124],'Glossary','Words from the gold trail','Clear definitions, tool names and regional words.')}
 <div class="home-live-copy home-live-plus-heading" style="${position([1343,588,231,63])}"><h2>Gold Trails Plus</h2><p>Almanac &amp; Connections</p></div>
 <p class="home-live-copy home-live-price" style="${position([1573,573,87,88])}"><strong>$5</strong><span>/ month</span></p>
 <section class="home-live-copy home-live-plus" style="${position([1440,660,199,178])}" aria-label="Gold Trails Plus benefits"><ul><li><strong>50-state Almanac</strong><span>Geology, history, access research &amp; creator map</span></li><li><strong>Gold Connections</strong><span>Create events, RSVP &amp; join discussions</span></li></ul></section>`;
}

export function graphicalHome({member=null,guest=false,calibration=false}={}){
 const premium=member?.effective_level==='subscriber'||guest===true;
 const stage=`<div class="home-art-section home-art-full" style="aspect-ratio:${canvas.width}/${canvas.height}">${picture('full',frame)}${liveSceneCopy()}${overlay(homeHotspots({member,guest}),frame,member)}</div>`;
 return `<main class="home-graphical${calibration?' home-calibration':''}" aria-label="Gold Trails illustrated home">
 <a class="home-skip" href="#home-welcome">Skip illustrated navigation</a>
 <div class="home-art-tools" id="home-libraries"><div class="header-tools"></div><nav aria-label="Explore Gold Trails"><a class="home-creators-first" href="/prospectors/">Creators &amp; Videos</a><a href="/articles/">Articles</a><a href="/glossary/">Glossary</a><a href="/plus/">Gold Trails Plus · $5/month</a></nav><button type="button" data-home-text-view>Text view</button></div>
 <div class="home-full">${stage}</div>
 <div id="home-info" class="home-info" role="dialog" aria-labelledby="home-info-title" hidden><div class="home-info-header"><h2 id="home-info-title"><span data-home-info-title></span><span class="home-plus-badge" data-home-plus-badge hidden><span aria-hidden="true">★</span> Plus</span></h2><button class="home-info-close" type="button" aria-label="Close information">Close</button></div><p class="home-feature-label" data-home-feature-label hidden>A Gold Trails Plus feature</p><p data-home-info-text></p><div data-home-search-links hidden><p>Choose a library to use its search and filters:</p><a href="/articles/">Articles</a><a href="/glossary/">Glossary</a><a href="/prospectors/">Creators &amp; Videos</a><a href="/products/">Products</a>${premium?'<a href="/connections/">Gold Connections</a>':''}<a href="/clubs-groups/">Clubs &amp; Groups</a></div></div>
 ${calibration?'<p class="home-calibration-note">LOCAL CALIBRATION · coordinates in app/homepage/hotspots.js · not enabled in production</p>':''}</main>`;
}

export function homepageMarkup(html,options){if(html.includes('home-graphical'))return html;return html.replace('</head>',`<link rel="stylesheet" href="${assetUrl('home-art.css')}"><script src="${assetUrl('home-art.js')}" defer></script></head>`).replace(/(<body[^>]*>)/,`$1${graphicalHome(options)}<div class="home-classic">`).replace('</body>','</div></body>');}

export function createHomepageHandler({members=null,config=null,guests=guestPlusAccess,root='dist',calibration=false}={}){return async(req,res,url)=>{
 if(url.pathname!=='/'||!['GET','HEAD'].includes(req.method))return false;
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-gold-member=([a-f0-9]{64})(?:;|$)/)?.[1];
 let member=null,guest=false;
 if(token&&members&&config)try{member=await members.session(token);}catch{}
 try{guest=Boolean(guests?.read(req));}catch{}
 const html=homepageMarkup(await readFile(root+'/index.html','utf8'),{member,guest,calibration});
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff'});
 res.end(req.method==='HEAD'?undefined:html);return true;
};}
