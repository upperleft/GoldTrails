import {hasPremiumFeature} from '../plus/entitlements.js';
import {searchCriteria} from '../directory-store.js';
import {explorerCriteria} from '../prospectors-page.js';
import {stateBySlug,stateUrl,assembleState} from './model.js';
import {canadianRegionBySlug,assembleCanada} from './canada.js';
import {almanacPage,dashboard} from './views.js';
import {messagePage} from '../directory-views.js';
import {lockedState} from '../plus/views.js';
import {guestPlusAccess} from '../plus/guest-access.js';
export function createAlmanacHandler({store=null,members=null,owners=null,guests=guestPlusAccess,creators=async()=>({available:false,records:[]}),log=()=>{}}={}){
 // Cache only public state projections. Entries are bounded by the 50-state registry.
 const cache=new Map();
 async function load(state){
  if(state.id.startsWith('CA-'))return assembleCanada(state,await creators());
  const cached=cache.get(state.id);if(cached&&cached.expires>Date.now())return cached.data;
  let live=null,availability=store?'connected':'offline';
  if(store)try{live=await store(state);}catch{availability='unavailable';log('Gold Almanac public connections unavailable');}
  const data=assembleState(state,live,availability);
  cache.set(state.id,{data,expires:Date.now()+(availability==='unavailable'?15000:60000)});return data;
 }
 return async(req,res,url)=>{
  const api=url.pathname.startsWith('/api/gold-almanac/');
  if(!api&&!/^\/gold-almanac(?:\/|$)/.test(url.pathname))return false;
  const send=(status,body,json=false)=>{res.writeHead(status,{'Content-Type':json?'application/json; charset=utf-8':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Vary':'Cookie',...(!root?{'X-Robots-Tag':'noindex'}:{})});res.end(req.method==='HEAD'?undefined:body);};
  const root=['/gold-almanac','/gold-almanac/'].includes(url.pathname);
  const access=()=>hasPremiumFeature(req,{members,owners,guests},'almanac');
  const filters=explorerCriteria(url.searchParams,searchCriteria(url.searchParams)||{q:'',region:'',topic:'',specialty:''})||{q:'',region:'',topic:'',specialty:'',sort:'az',setting:''};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');send(405,api?JSON.stringify({error:'Use GET or HEAD.'}):'Use GET or HEAD.',api);return true;}
  if(url.pathname==='/api/gold-almanac/creators/') {
   try{if(!await access()){send(403,JSON.stringify({code:'plus_required'}),true);return true;}const result=await creators();send(result.available?200:503,JSON.stringify(result),true);}catch{send(503,JSON.stringify({error:'Creator connections are temporarily unavailable.'}),true);}return true;
  }
  const slug=api?url.pathname.match(/^\/api\/gold-almanac\/([a-z-]+)\/?$/)?.[1]:url.pathname.match(/^\/gold-almanac\/([a-z-]+)\/?$/)?.[1];
  if(root&&!url.searchParams.get('state')){
   if(url.pathname==='/gold-almanac'){res.writeHead(308,{'Cache-Control':'no-store',Location:'/gold-almanac/'+url.search});res.end();return true;}
   let allowed=false;try{allowed=await access();}catch{log('Gold Almanac membership check unavailable');}
   const connections=allowed?await creators():null;send(200,almanacPage({state:null},{preview:!allowed,connections,filters,returnTo:url.pathname+url.search}));return true;
  }
  const canonicalParams=new URLSearchParams(url.searchParams);canonicalParams.delete('state');const canonicalQuery=canonicalParams.size?'?'+canonicalParams.toString():'';
  const requested=root?url.searchParams.get('state'):slug;
  const state=stateBySlug(requested)||canadianRegionBySlug(requested);
  if(state?.id.startsWith('CA-')&&!filters.region)filters.region=state.slug;
  if(!state){send(404,api?JSON.stringify({error:'State not found.'}):messagePage('Guide not found','Choose a U.S. state or a Canadian province or territory from the Gold Almanac.'),api);return true;}
  if(!api&&(root||url.pathname!==stateUrl(state))){res.writeHead(308,{'Cache-Control':'no-store',Location:stateUrl(state)+canonicalQuery});res.end();return true;}
  try{
   if(!await access()){
    send(403,api?JSON.stringify({code:'plus_required',state:{id:state.id,slug:state.slug,name:state.name},url:stateUrl(state),html:lockedState(state)}):almanacPage({state},{locked:true}),api);return true;
   }
   const data=await load(state);send(200,api?JSON.stringify({state:{id:state.id,slug:state.slug,name:state.name},url:stateUrl(state),html:dashboard(data)}):almanacPage(data,{connections:await creators(),filters}),api);
  }
  catch{log('Gold Almanac request unavailable');send(503,api?JSON.stringify({error:'State notes are temporarily unavailable. Please try again.'}):messagePage('A pause at the field desk','The Almanac is temporarily unavailable. Please try again.'),api);}
  return true;
 };
}
