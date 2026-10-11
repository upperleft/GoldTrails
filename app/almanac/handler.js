import {stateBySlug,stateUrl,assembleState} from './model.js';
import {almanacPage,dashboard} from './views.js';
import {messagePage} from '../directory-views.js';
export function createAlmanacHandler({store=null,log=()=>{}}={}){
 // Cache only public state projections. Entries are bounded by the 50-state registry.
 const cache=new Map();
 async function load(state){
  const cached=cache.get(state.id);if(cached&&cached.expires>Date.now())return cached.data;
  let live=null,availability=store?'connected':'offline';
  if(store)try{live=await store(state);}catch{availability='unavailable';log('Gold Almanac public connections unavailable');}
  const data=assembleState(state,live,availability);
  cache.set(state.id,{data,expires:Date.now()+(availability==='unavailable'?15000:60000)});return data;
 }
 return async(req,res,url)=>{
  const api=url.pathname.startsWith('/api/gold-almanac/');
  if(!api&&!/^\/gold-almanac(?:\/|$)/.test(url.pathname))return false;
  const send=(status,body,json=false)=>{res.writeHead(status,{'Content-Type':json?'application/json; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');send(405,api?JSON.stringify({error:'Use GET or HEAD.'}):'Use GET or HEAD.',api);return true;}
  const slug=api?url.pathname.match(/^\/api\/gold-almanac\/([a-z-]+)\/?$/)?.[1]:url.pathname.match(/^\/gold-almanac\/([a-z-]+)\/?$/)?.[1];
  const root=['/gold-almanac','/gold-almanac/'].includes(url.pathname);
  const state=stateBySlug(root?(url.searchParams.get('state')||'california'):slug);
  if(!state){send(404,api?JSON.stringify({error:'State not found.'}):messagePage('State not found','Choose one of the 50 states from the Gold Almanac.'),api);return true;}
  if(!api&&(root||url.pathname!==stateUrl(state))){res.writeHead(308,{Location:stateUrl(state)});res.end();return true;}
  try{const data=await load(state);send(200,api?JSON.stringify({state:{id:state.id,slug:state.slug,name:state.name},url:stateUrl(state),html:dashboard(data)}):almanacPage(data),api);}
  catch{log('Gold Almanac request unavailable');send(503,api?JSON.stringify({error:'State notes are temporarily unavailable. Please try again.'}):messagePage('A pause at the field desk','The Almanac is temporarily unavailable. Please try again.'),api);}
  return true;
 };
}
