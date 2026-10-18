import {readFile} from 'node:fs/promises';
import {hotspots,canvas,memberPromotionHotspots} from './hotspots.js';
import {escapeHtml as h} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';
import {guestPlusAccess} from '../plus/guest-access.js';

const blank='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const desktop='(min-width: 1280px) and (hover: hover) and (pointer: fine)';
const frame=[0,0,canvas.width,canvas.height];
const position=([x,y,w,height],[sx,sy,sw,sh]=frame)=>`left:${(x-sx)/sw*100}%;top:${(y-sy)/sh*100}%;width:${w/sw*100}%;height:${height/sh*100}%`;
const memberHome=({member=null,guest=false}={})=>member?.effective_level==='subscriber'||guest===true;

// This changes discovery links only. The feature handlers still enforce access.
export function homeHotspots({member=null,guest=false}={}){
 const premium=memberHome({member,guest});
 const items=premium?[...hotspots.filter(p=>p.section!=='plus'),...memberPromotionHotspots]:hotspots;
 return items.map(item=>{
  if(item.id==='nav-almanac')return {...item,href:premium?'/gold-almanac/':'/plus/',label:premium?'Almanac':'Almanac — a Gold Trails Plus feature',showPlus:!premium};
  if(item.id==='nav-connections')return {...item,href:premium?'/connections/':'/plus/',label:premium?'Gold Connections':'Gold Connections — a Gold Trails Plus feature'};
  if(premium&&['nav-almanac-help','nav-connections-help'].includes(item.id))return {...item,premium:false,...(item.id==='nav-connections-help'?{text:'Find events, organize outings, RSVP, and join discussions with other members.'}:{})};
  return item;
 });
}

function overlay(items,rect,member){return items.map(p=>{
 const style=position(p.rect,rect),name=p.account&&member?'My account':p.name;
 const attrs=`class="home-hotspot home-hotspot-${p.type}${p.section!=='sidebar'&&p.type==='help'?' home-help-roomy':''}${p.fullButton?' home-feature-button':''}" style="${style}" data-home-id="${p.id}" data-home-name="${h(name)}" aria-label="${h(p.account&&member?'My account':p.label)}"`;
 const nav=p.id.startsWith('nav-')&&p.type!=='help';
 const buttonLabel=p.id==='panel-destinations-button'?'Browse Creators →':p.id==='panel-articles-button'?'Read Articles →':p.id==='panel-glossary-button'?'Browse the Glossary →':p.id==='panel-plus-button'?(p.href==='/gold-almanac/'?'Open Almanac →':'Explore Almanac →'):null;
 const visible=nav?`<span class="home-nav-label">${h(name)}${p.showPlus?'<span class="home-nav-plus-badge" aria-hidden="true">Plus</span>':''}</span>`:buttonLabel?`<span class="home-button-label">${h(buttonLabel)}</span>`:`<span class="home-sr">${h(name)}</span>`;
 if(p.type==='link')return `<a ${attrs} href="${p.account&&member?'/account/':p.href}"${p.account?' data-home-account':''}>${visible}</a>`;
 return `<button ${attrs} type="button" aria-expanded="false" aria-controls="home-info"${p.type==='help'?` data-home-help="${h(p.text)}"${p.premium?' data-home-premium="plus"':''}`:' data-home-search'}>${p.type==='help'?'<span class="home-help-mark" aria-hidden="true">?</span>':visible}<span class="home-sr">${h(p.label)}</span></button>`;
 }).join('');}

function picture(id,rect){return `<picture><source media="${desktop}" srcset="/assets/homepage/${id}.webp"><img src="${blank}" width="${rect[2]}" height="${rect[3]}" alt="" aria-hidden="true" decoding="async" fetchpriority="high"></picture>`;}

function liveSceneCopy(premium=false){
 // The original hero lettering is intentional; equivalent text remains accessible below.
 const panel=(id,rect,title,subtitle,text)=>`<section class="home-live-copy home-live-panel" style="${position(rect)}" aria-labelledby="home-live-${id}"><h2 id="home-live-${id}">${title}</h2>${subtitle?`<p class="home-panel-subtitle">${subtitle}</p>`:''}<p>${text}</p></section>`;
 return `<section class="home-sr home-hero-copy" aria-labelledby="home-welcome"><h1 id="home-welcome">Explore. Learn. Connect.</h1><p>Gold prospecting knowledge, real-world experience, and a supportive community of gold prospecting enthusiasts.</p></section>
 ${panel('creators',[327,730,289,124],'Creators &amp; Videos','','Explore linked videos from gold prospecting creators.')}
 ${panel('articles',[642,730,289,124],'Articles','Practical guides and stories','Practical how-tos, geology, and mineral science.')}
 ${panel('glossary',[957,730,282,124],'Glossary','Words from the gold trail','Clear definitions, tool names, and regional words.')}
 <div class="home-live-copy home-live-plus-heading" style="${position([1343,588,231,63])}"><h2>Almanac${premium?'':' <span class="home-card-plus-badge">Plus</span>'}</h2><p>Gold research, state by state</p></div>
 <p class="home-live-copy home-live-price${premium?' home-member-greeting':''}" style="${position([1573,573,87,88])}"><strong>${premium?'Welcome':'$5'}</strong><span>${premium?'back':'/ month'}</span></p>
 <section class="home-live-copy home-live-plus" style="${position([1435,655,210,183])}" aria-label="Almanac features"><ul><li>50 state guides</li><li>Gold geology &amp; history</li><li>Access research &amp; source links</li><li>Creator map</li></ul></section>`;
}

export function graphicalHome({member=null,guest=false,calibration=false}={}){
 const premium=memberHome({member,guest});
 const items=homeHotspots({member,guest});
 const stage=`<div class="home-art-section home-art-full" style="aspect-ratio:${canvas.width}/${canvas.height}">${picture('full-home-critique-v4',frame)}${liveSceneCopy(premium)}<nav class="home-art-navigation" aria-label="Homepage navigation">${overlay(items.filter(p=>p.section==='sidebar'),frame,member)}</nav><div class="home-sidebar-tools" style="${position([34,595,235,105])}"><div class="header-tools"></div><button type="button" data-home-text-view>Text view</button></div>${overlay(items.filter(p=>p.section!=='sidebar'),frame,member)}</div>`;
 return `<main class="home-graphical${premium?' home-member-view':''}${calibration?' home-calibration':''}" aria-label="Gold Trails illustrated home">
 <a class="home-skip" href="#home-welcome">Skip illustrated navigation</a>
 <div class="home-full">${stage}</div>
 <div id="home-info" class="home-info" role="dialog" aria-labelledby="home-info-title" hidden><div class="home-info-header"><h2 id="home-info-title"><span data-home-info-title></span><span class="home-plus-badge" data-home-plus-badge hidden>${premium?'':'<span aria-hidden="true">★</span> Plus'}</span></h2><button class="home-info-close" type="button" aria-label="Close information">Close</button></div><p class="home-feature-label" data-home-feature-label hidden>${premium?'':'A Gold Trails Plus feature'}</p><p data-home-info-text></p><div data-home-search-links hidden><p>Choose a library to use its search and filters:</p><a href="/articles/">Articles</a><a href="/glossary/">Glossary</a><a href="/prospectors/">Creators</a><a href="/products/">Products</a>${premium?'<a href="/connections/">Gold Connections</a>':''}<a href="/clubs-groups/">Clubs &amp; Groups</a></div></div>
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
