import {readFile} from 'node:fs/promises';
import {hotspots,canvas,memberPromotionHotspots} from './hotspots.js';
import {escapeHtml as h} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';
import {guestPlusAccess} from '../plus/guest-access.js';
import {creatorInvitationHome,creatorNameSlug} from '../creator-invitations/context.js';
import {focusedCreatorHomePage} from '../creator-invitations/access-page.js';
import {siteNavigationMarkup} from '../site-navigation.js';

const blank='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const desktop='(min-width: 1280px) and (hover: hover) and (pointer: fine)';
const frame=[0,0,canvas.width,canvas.height];
const position=([x,y,w,height],[sx,sy,sw,sh]=frame)=>`left:${(x-sx)/sw*100}%;top:${(y-sy)/sh*100}%;width:${w/sw*100}%;height:${height/sh*100}%`;
const memberHome=({member=null,guest=false}={})=>member?.effective_level==='subscriber'||guest===true;

// This changes discovery links only. The feature handlers still enforce access.
export function homeHotspots({member=null,guest=false,creatorInvitation=false}={}){
 const premium=memberHome({member,guest});
 const pending=creatorInvitation&&!premium;
 const items=premium?[...hotspots.filter(p=>p.section!=='plus'),...memberPromotionHotspots]:hotspots;
 return items.map(item=>{
  if(pending){
   if(['nav-almanac','nav-connections'].includes(item.id))return {...item,href:'/creator-invitation/',label:item.name,showPlus:false};
   if(item.section==='plus'&&item.type==='link')return {...item,href:'/creator-invitation/',name:'Continue creator invitation',label:'Continue your complimentary creator invitation'};
   if(item.premium)return {...item,premium:false,text:'Your creator invitation includes complimentary Gold Trails Plus. Continue your invitation to create or sign in to your account and accept your free access.'};
  }
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
 const buttonLabel=p.id==='panel-destinations-button'?'Browse Creators →':p.id==='panel-articles-button'?'Read Articles →':p.id==='panel-glossary-button'?'Browse the Glossary →':p.id==='panel-plus-button'?(p.href==='/creator-invitation/'?'Continue invitation →':p.href==='/gold-almanac/'?'Open Almanac →':'Explore Almanac →'):null;
 const visible=nav?`<span class="home-nav-label">${h(name)}${p.showPlus?'<span class="home-nav-plus-badge" aria-hidden="true">Plus</span>':''}</span>`:buttonLabel?`<span class="home-button-label">${h(buttonLabel)}</span>`:`<span class="home-sr">${h(name)}</span>`;
 if(p.type==='link')return `<a ${attrs} href="${p.account&&member?'/account/':p.href}"${p.account?' data-home-account':''}>${visible}</a>`;
 return `<button ${attrs} type="button" aria-expanded="false" aria-controls="home-info"${p.type==='help'?` data-home-help="${h(p.text)}"${p.premium?' data-home-premium="plus"':''}`:' data-home-search'}>${p.type==='help'?'<span class="home-help-mark" aria-hidden="true">?</span>':visible}<span class="home-sr">${h(p.label)}</span></button>`;
 }).join('');}

function picture(id,rect){return `<picture><source media="${desktop}" srcset="/assets/homepage/${id}.webp"><img src="${blank}" width="${rect[2]}" height="${rect[3]}" alt="" aria-hidden="true" decoding="async" fetchpriority="high"></picture>`;}

function liveSceneCopy(premium=false,creatorInvitation=false){
 // The original hero lettering is intentional; equivalent text remains accessible below.
 const panel=(id,rect,title,subtitle,text)=>`<section class="home-live-copy home-live-panel" style="${position(rect)}" aria-labelledby="home-live-${id}"><h2 id="home-live-${id}">${title}</h2>${subtitle?`<p class="home-panel-subtitle">${subtitle}</p>`:''}<p>${text}</p></section>`;
 return `<section class="home-sr home-hero-copy" aria-labelledby="home-welcome"><h1 id="home-welcome">Explore. Learn. Connect.</h1><p>Gold prospecting knowledge, real-world experience, and a supportive community of gold prospecting enthusiasts.</p></section>
 ${panel('creators',[327,730,289,124],'Creators &amp; Videos','','Explore linked videos from gold prospecting creators.')}
 ${panel('articles',[642,730,289,124],'Articles','Practical guides and stories','Practical how-tos, geology, and mineral science.')}
 ${panel('glossary',[957,730,282,124],'Glossary','Words from the gold trail','Clear definitions, tool names, and regional words.')}
 <div class="home-live-copy home-live-plus-heading" style="${position([1343,588,231,63])}"><h2>Almanac${premium||creatorInvitation?'':' <span class="home-card-plus-badge">Plus</span>'}</h2><p>Gold research, state by state</p></div>
 <p class="home-live-copy home-live-price${premium?' home-member-greeting':''}" style="${position([1573,573,87,88])}"><strong>${premium?'Welcome':creatorInvitation?'Free':'$5'}</strong><span>${premium?'back':creatorInvitation?'for creators':'/ month'}</span></p>
 <section class="home-live-copy home-live-plus" style="${position([1435,655,210,183])}" aria-label="Almanac features"><ul><li>50 state guides</li><li>Gold geology &amp; history</li><li>Access research &amp; source links</li><li>Creator map</li></ul></section>`;
}

export function graphicalHome({member=null,guest=false,creatorInvitation=false,calibration=false}={}){
 const premium=memberHome({member,guest});
 const items=homeHotspots({member,guest,creatorInvitation});
 const stage=`<div class="home-art-section home-art-full" style="aspect-ratio:${canvas.width}/${canvas.height}">${picture('full-home-critique-v4',frame)}${liveSceneCopy(premium,creatorInvitation)}<nav class="home-art-navigation" aria-label="Homepage navigation">${overlay(items.filter(p=>p.section==='sidebar'),frame,member)}</nav><div class="home-sidebar-tools" style="${position([34,595,235,105])}"><div class="header-tools"></div><button type="button" data-home-text-view>Text view</button></div>${overlay(items.filter(p=>p.section!=='sidebar'),frame,member)}</div>`;
 return `<main class="home-graphical${premium?' home-member-view':''}${calibration?' home-calibration':''}" aria-label="Gold Trails illustrated home">
 <a class="home-skip" href="#home-welcome">Skip illustrated navigation</a>
 <div class="home-full">${stage}</div>
 <div id="home-info" class="home-info" role="dialog" aria-labelledby="home-info-title" hidden><div class="home-info-header"><h2 id="home-info-title"><span data-home-info-title></span><span class="home-plus-badge" data-home-plus-badge hidden>${premium||creatorInvitation?'':'<span aria-hidden="true">★</span> Plus'}</span></h2><button class="home-info-close" type="button" aria-label="Close information">Close</button></div><p class="home-feature-label" data-home-feature-label hidden>${premium||creatorInvitation?'':'A Gold Trails Plus feature'}</p><p data-home-info-text></p><div data-home-search-links hidden><p>Choose a library to use its search and filters:</p><a href="/articles/">Articles</a><a href="/glossary/">Glossary</a><a href="/prospectors/">Creators</a><a href="/products/">Products</a>${premium?'<a href="/connections/">Gold Connections</a>':''}<a href="/clubs-groups/">Clubs &amp; Groups</a></div></div>
 ${calibration?'<p class="home-calibration-note">LOCAL CALIBRATION · coordinates in app/homepage/hotspots.js · not enabled in production</p>':''}</main>`;
}

export function inertHomepageMarkup(html){
 const attributes=raw=>[...raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g)].filter(match=>/^(?:class|id|style|title|aria-label|aria-hidden|data-home-id|data-home-name)$/.test(match[1])).map(match=>match[0]).join(' ');
 return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<a\b[^>]*class="[^"]*\b(?:skip-link|home-skip)\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi,'')
  .replace(/<(a|button)\b([^>]*)>/gi,(_match,tag,attrs)=>`<span ${attributes(attrs)} role="${tag.toLowerCase()==='a'?'link':'button'}" aria-disabled="true">`).replace(/<\/(?:a|button)>/gi,'</span>')
  .replace(/<(?:input|select|textarea)\b([^>]*)>/gi,(match,attrs)=>match.replace(/\s(?:tabindex|autofocus|formaction|formtarget)\b(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'').replace(/>$/,' disabled>'))
  .replace(/<form\b[^>]*>/gi,'<div class="creator-inert-form">').replace(/<\/form>/gi,'</div>')
  .replace(/<(details|summary|main)\b([^>]*)>/gi,(_match,tag,attrs)=>`<${tag.toLowerCase()==='summary'?'p':'section'} ${attributes(attrs)}>`).replace(/<\/summary>/gi,'</p>').replace(/<\/(?:details|main)>/gi,'</section>')
  .replace(/\sdata-home-(?:help|search|text-view|account|premium)(?:-[a-z-]+)?(?:="[^"]*")?/gi,'');
}
function creatorInvitationHomepage(original){
 const normal=siteNavigationMarkup(original,{path:'/',creatorInvitation:true});
 const classic=normal.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
 const scene=inertHomepageMarkup(graphicalHome({creatorInvitation:true}));
 const banner='<section class="home-invitation-welcome" aria-labelledby="creator-home-welcome"><div><h1 id="creator-home-welcome">Welcome to Gold Trails</h1><p>Your complimentary Gold Trails Plus invitation is waiting. Accept your free membership first, then explore the site and your creator profile. No subscription fee or card required.</p><p class="creator-invitation-instruction">The homepage navigation opens after you accept.</p><a class="gold-button" href="/creator-invitation/">Continue to your free creator account</a></div><div class="header-tools"></div></section>';
 return focusedCreatorHomePage('Welcome to Gold Trails',`<main class="creator-access-home-main" id="main-content">${banner}${scene}<div class="home-classic creator-inert-classic">${inertHomepageMarkup(classic).replace(/id="main-content"/g,'id="creator-preview-main-content"')}</div></main>`);
}
function creatorReadyBanner({member=null,acceptedProfile=null}={}){
 if(member?.effective_level!=='subscriber'||member.grant_source!=='complimentary'||!creatorNameSlug(acceptedProfile?.slug)||typeof acceptedProfile.display_name!=='string'||!acceptedProfile.display_name.trim()||acceptedProfile.display_name.length>180)return '';
 return `<section class="home-creator-ready" data-creator-membership-ready role="status"><h2>Your complimentary creator membership is ready</h2><p>Welcome, ${h(acceptedProfile.display_name)}. Your Plus access is active.</p><a href="/prospectors/${h(acceptedProfile.slug)}/">View your creator profile</a></section>`;
}
export function homepageMarkup(html,options={}){if(options.creatorInvitation)return creatorInvitationHomepage(html);if(html.includes('home-graphical'))return html;const ready=creatorReadyBanner(options);return html.replace('</head>',`<link rel="stylesheet" href="${assetUrl('home-art.css')}"><script src="${assetUrl('home-art.js')}" defer></script>${ready?`<link rel="stylesheet" href="${assetUrl('creator-access.css')}">`:''}</head>`).replace(/(<body[^>]*>)/,`$1${ready}${graphicalHome(options)}<div class="home-classic">`).replace('</body>','</div></body>');}

export function createHomepageHandler({members=null,config=null,guests=guestPlusAccess,invitations=null,root='dist',calibration=false}={}){return async(req,res,url)=>{
 if(url.pathname!=='/'||!['GET','HEAD'].includes(req.method))return false;
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-gold-member=([a-f0-9]{64})(?:;|$)/)?.[1];
 let member=null,guest=false;
 if(token&&members&&config)try{member=await members.session(token);}catch{}
 try{guest=Boolean(guests?.read(req));}catch{}
 const creatorInvitation=req[creatorInvitationHome]===true;
 let acceptedProfile=null;
 if(!creatorInvitation&&url.searchParams.get('creator')==='accepted'&&member?.id&&member.effective_level==='subscriber'&&member.grant_source==='complimentary'&&invitations?.acceptedProfile)try{if(!invitations.ready||await invitations.ready())acceptedProfile=await invitations.acceptedProfile(member.id);}catch{}
 const html=homepageMarkup(await readFile(root+'/index.html','utf8'),{member,guest,creatorInvitation,calibration,acceptedProfile});
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff',...(creatorInvitation?{'Referrer-Policy':'strict-origin','X-Robots-Tag':'noindex, nofollow'}:{})});
 res.end(req.method==='HEAD'?undefined:html);return true;
};}
