import{attachReadingMarkup}from'./reading/handler.js';
import{attachSiteNavigation}from'./site-navigation.js';
import {createPlusHandler,attachPlusMarkup} from './plus/handler.js';
import {hasPremiumFeature} from './plus/entitlements.js';
import {guestPlusAccess} from './plus/guest-access.js';
import http from 'node:http';
import {attachAnalyticsMarkup} from './analytics/handler.js';
import {createAlmanacHandler} from './almanac/handler.js';
import {mergeCatalog,catalogBySlug,catalogProfile} from './creator-catalog.js';
import {mapRecords} from './creator-map.js';
import {prospectorsPage,explorerCriteria} from './prospectors-page.js';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { searchCriteria } from './directory-store.js';
import { directoryPage, profilePage, messagePage, page, escapeHtml } from './directory-views.js';
import {videoLibraryFor,videoLibraryBody} from './creator-video-library.js';
import {createGoldPriceFeed} from './gold-price.js';

const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.ico':'image/x-icon' };
const samplePath = '/prospectors/jack-riverbend-morgan/';
export function createServer({ canonicalOrigin = process.env.MEMBER_ORIGIN || process.env.ADMIN_ORIGIN, guests = guestPlusAccess, plus = createPlusHandler(), suggestions = null, analytics = null, directory = null, admin = null, members = null, memberSessions = null, compass = null, products = null, calendar = null, connections = null, homepage = null, goldPrice = createGoldPriceFeed(), almanac = createAlmanacHandler({guests}), root = resolve('dist'), log = console.error } = {}) {
  root = resolve(root);
  function send(req, res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type':'text/html; charset=utf-8', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store', ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
  }
  const server = http.createServer(async (req, res) => {
    let url, path;
    try { url = new URL(req.url,'http://localhost'); path = decodeURIComponent(url.pathname); }
    catch { send(req,res,400,messagePage('That trail marker is unclear','Please check the address and try again.')); return; }
    // Keep forms and host-only sessions on the configured production origin.
    // Match only our known alias; never derive a redirect target from request headers.
    if(canonicalOrigin==='https://goldtrails.org' && req.headers.host?.toLowerCase()==='www.goldtrails.org') {
      const destination=canonicalOrigin+url.pathname+url.search;
      if(['GET','HEAD'].includes(req.method)) {res.writeHead(308,{Location:destination,'Cache-Control':'no-store',...(url.pathname==='/plus/guest/'?{'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}:{})});res.end();}
      else send(req,res,421,messagePage('Use GoldTrails.org','Open GoldTrails.org and submit the form there.'));
      return;
    }
    if(guests&&await guests.handle(req,res,url))return;
    guests?.attach(req,res,url);
    if(['GET','HEAD'].includes(req.method)&&['/creators-experts','/creators-experts/','/creators-experts/index.html'].includes(path)){
      res.writeHead(308,{Location:'/prospectors/'+url.search,'Cache-Control':'no-store'});res.end();return;
    }
    // Retired feature: old bookmarks lead to the account; old forms never write data.
    if (!compass && (path === '/compass' || path.startsWith('/compass/'))) {
      if (['GET','HEAD'].includes(req.method)) send(req,res,303,'',{Location:'/account/'});
      else send(req,res,410,messagePage('This feature has been removed','Your account and personal calendar are still available.'));
      return;
    }
    if(connections?.attach)await connections.attach(req,res,url);
    attachReadingMarkup(req,res,url);
    let navigationPremium=false;
    // Do not query membership for images, scripts, styles or anonymous requests.
    if(['GET','HEAD'].includes(req.method)&&!/^\/(?:api|admin)(?:\/|$)/.test(path)&&(!extname(path)||extname(path)==='.html')){
      try {if(req.headers.cookie)navigationPremium=await hasPremiumFeature(req,{members:memberSessions,guests},'almanac');}
      catch {log('Navigation membership check unavailable');}
    }
    attachSiteNavigation(req,res,url,{premium:navigationPremium});
    attachPlusMarkup(req,res,url);
    if(suggestions){if(await suggestions(req,res,url))return;if(await suggestions.enabled())suggestions.attach(req,res,url);}
    if(analytics){if(await analytics(req,res,url))return;if(await analytics.enabled())attachAnalyticsMarkup(req,res,url);}
    if(plus&&await plus(req,res,url))return;
    if(path === '/api/gold-price' || path === '/api/gold-price/') {
      const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=30'};
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...headers,Allow:'GET, HEAD','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Use GET or HEAD.'}));return;}
      try{const quote=await goldPrice();res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:JSON.stringify(quote));}
      catch{res.writeHead(503,{...headers,'Cache-Control':'no-store','Retry-After':'60'});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'Gold price temporarily unavailable.'}));}
      return;
    }
    if (homepage && await homepage(req,res,url)) return;
    if (connections && await connections(req,res,url)) return;
    if (await almanac(req,res,url)) return;
    if (admin && await admin(req,res,url)) return;
    if (members && await members(req,res,url)) return;
    if (compass && await compass(req,res,url)) return;
    if (products && await products(req,res,url)) return;
    if (calendar && await calendar(req,res,url)) return;
    const videoMatch=path.match(/^\/(api\/)?prospectors\/([^/]+)\/videos\/?$/);
    if(videoMatch){
      const json=Boolean(videoMatch[1]),slug=videoMatch[2];
      const reply=(status,message,headers={})=>send(req,res,status,json?JSON.stringify({error:message}):messagePage('Video library',message),{...(json?{'Content-Type':'application/json; charset=utf-8'}:{}),...headers});
      if(!['GET','HEAD'].includes(req.method)){reply(405,'Use GET or HEAD.',{Allow:'GET, HEAD'});return;}
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>160){reply(404,'This video library is not available.');return;}
      if(!path.endsWith('/')){res.writeHead(308,{Location:path+'/'+url.search});res.end();return;}
      if(!directory){reply(503,'The creator directory is temporarily unavailable.');return;}
      const library=videoLibraryFor(slug);
      if(!library){reply(404,'No selected video library is published for this creator yet.');return;}
      try{
        // A roster match never overrides a draft, excluded or archived profile.
        const profile=await directory.profile(slug);
        if(profile?.archived){reply(410,'This creator profile has been archived.');return;}
        if(!profile&&(!catalogBySlug(slug)||!directory.catalogAllowed||!await directory.catalogAllowed(slug))){reply(404,'This video library is not available.');return;}
        if(json){send(req,res,200,JSON.stringify(library),{'Content-Type':'application/json; charset=utf-8'});return;}
        const title=library.name+' · Video library';
        const body=`<section class="resource-placeholder video-library-page" data-video-page><h2>${escapeHtml(title)}</h2>${videoLibraryBody(library)}<p><a href="/prospectors/${encodeURIComponent(slug)}/">← Back to the creator profile</a></p></section><script id="creator-video-page-data" type="application/json">${JSON.stringify(library).replace(/</g,'\\u003c')}</script>`;
        send(req,res,200,page(title,'Selected videos from this creator’s checked YouTube channel.',body,'','Discover a lesson, a field story, or a fresh way to see the gold country.'));
      }catch{
        log('Gold Trails video library request unavailable');
        reply(503,'The video library is temporarily unavailable. Please try again shortly.');
      }
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow:'GET, HEAD' }); res.end(); return;
    }
    if(path==='/creator-map'||path==='/creator-map/') {
      const params=new URLSearchParams(url.searchParams);params.delete('view');
      res.writeHead(308,{Location:'/gold-almanac/'+(params.size?'?'+params.toString():'')});res.end();return;
    }
    if(path==='/prospectors/'&&url.searchParams.get('view')==='map') {
      const params=new URLSearchParams(url.searchParams);params.delete('view');
      res.writeHead(308,{Location:'/gold-almanac/'+(params.size?'?'+params.toString():'')});res.end();return;
    }
    const match = path.match(/^\/prospectors\/([^/]+)\/$/);
    const dynamic = path === '/prospectors/' || (match && path !== samplePath);
    // Canonical directory URLs also retain the active search.
    if (path === '/prospectors' || /^\/prospectors\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) {
      res.writeHead(308,{ Location: path + '/' + url.search }); res.end(); return;
    }
    if (dynamic) {
      if ((match && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(match[1])) || (match && match[1].length > 160)) {
        send(req,res,404,messagePage('Trail not found','This profile is not available.')); return;
      }
      const criteria = path === '/prospectors/' ? searchCriteria(url.searchParams) : null;
      if (path === '/prospectors/' && !criteria) {
        send(req,res,400,messagePage('Let’s adjust that search','Use a search of up to 100 characters and a valid page number.')); return;
      }
      if (!directory) {
        send(req,res,503,messagePage('The directory is being prepared','Prospector search will open when the database connection is ready. The rest of Gold Trails is yours to explore.')); return;
      }
      try {
        if (criteria && directory.map) {
          const filters=explorerCriteria(url.searchParams,criteria);
          if(!filters){send(req,res,400,messagePage('Let’s adjust those filters','Choose a valid view, setting, and sort order.'));return;}
          const data=mergeCatalog(await directory.map());
          let canFindOnMap=false;
          try { canFindOnMap=await hasPremiumFeature(req,{members:memberSessions,guests},'almanac'); }
          catch { log('Creator map membership check unavailable'); }
          send(req,res,200,prospectorsPage(mapRecords(data.people,data.regions,data.topics),filters,{canFindOnMap}),{'Cache-Control':'private, no-store',Vary:'Cookie'});
        } else if (criteria) {
          const result = await directory.search(criteria);
          if (criteria.page > Math.max(1, Math.ceil(result.total / criteria.pageSize))) {
            send(req,res,404,messagePage('No results on that page','Return to the directory to start a new search.')); return;
          }
          send(req,res,200,directoryPage(criteria,result));
        } else {
          const profile = await directory.profile(match[1]);
          if (!profile) {const entry=catalogBySlug(match[1]);if(entry && directory.catalogAllowed && await directory.catalogAllowed(match[1]))send(req,res,200,catalogProfile(entry));else send(req,res,404,messagePage('Trail not found','This profile is not available.'));}
          else if (profile.archived) send(req,res,410,messagePage('An archived trail', `${profile.display_name}’s profile has been archived. Browse the directory for current profiles.`));
          else send(req,res,200,profilePage(profile));
        }
      } catch {
        // Do not publish or log SQL, host names, credentials, or private records.
        log('Gold Trails directory request unavailable');
        send(req,res,503,messagePage('A pause along the trail','The directory is temporarily unavailable. Please try again shortly.'));
      }
      return;
    }
    try {
      let file = resolve(root, '.' + path);
      if (file !== root && !file.startsWith(root + sep)) { send(req,res,403,'Forbidden'); return; }
      const info = await stat(file);
      if (info.isDirectory()) {
        if (!path.endsWith('/')) { res.writeHead(308,{ Location:encodeURI(path + '/') + url.search }); res.end(); return; }
        file = resolve(file,'index.html');
      }
      const actualFile = await realpath(file);
      if (!actualFile.startsWith(root + sep)) { send(req,res,403,'Forbidden'); return; }
      const data = await readFile(actualFile);
      res.writeHead(200,{ 'Content-Type':types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { send(req,res,404,messagePage('Trail not found','That page is not available.')); }
  });
  server.on('close', () => { calendar?.close?.().catch(() => {}); });
  return server;
}
