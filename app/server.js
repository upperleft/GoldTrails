import http from 'node:http';
import {mergeCatalog,catalogBySlug,catalogProfile} from './creator-catalog.js';
import {creatorMapPage,mapRecords} from './creator-map.js';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { searchCriteria } from './directory-store.js';
import { directoryPage, profilePage, messagePage } from './directory-views.js';

const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon' };
const samplePath = '/prospectors/jack-riverbend-morgan/';
export function createServer({ directory = null, admin = null, members = null, root = resolve('dist'), log = console.error } = {}) {
  root = resolve(root);
  function send(req, res, status, body, headers = {}) {
    res.writeHead(status, { 'Content-Type':'text/html; charset=utf-8', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store', ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
  }
  return http.createServer(async (req, res) => {
    let url, path;
    try { url = new URL(req.url,'http://localhost'); path = decodeURIComponent(url.pathname); }
    catch { send(req,res,400,messagePage('That trail marker is unclear','Please check the address and try again.')); return; }
    if (admin && await admin(req,res,url)) return;
    if (members && await members(req,res,url)) return;
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow:'GET, HEAD' }); res.end(); return;
    }
    if(path==='/creator-map') {res.writeHead(308,{Location:'/creator-map/'+url.search});res.end();return;}
    if(path==='/creator-map/') {
      if(!directory?.map){send(req,res,503,messagePage('The atlas is being prepared','The creator map needs the directory database connection.'));return;}
      try {const data=mergeCatalog(await directory.map());send(req,res,200,creatorMapPage(mapRecords(data.people,data.regions,data.topics)));}
      catch {log('Gold Trails creator map unavailable');send(req,res,503,messagePage('A pause along the trail','The creator map is temporarily unavailable.'));}
      return;
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
        if (criteria) {
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
}
