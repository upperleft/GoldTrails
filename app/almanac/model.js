import {readFileSync} from 'node:fs';
import {creatorCatalog} from '../creator-catalog.js';
import {publishedArticles} from '../compass/content.js';
import {safeUrl} from '../directory-views.js';
export const states=JSON.parse(readFileSync(new URL('./states.json',import.meta.url),'utf8'));
export const stateBySlug=slug=>states.find(s=>s.slug===slug);
export const stateById=id=>states.find(s=>s.id===id);
export const stateUrl=state=>'/gold-almanac/'+state.slug+'/';
export function validateContent(data){
 const ids=new Set(),sources=new Map(data.sources.map(s=>[s.id,s])),articles=new Set(publishedArticles().map(a=>a.id)),archives=new Map(data.archives.map(a=>[a.id,a]));
 const register=r=>{if(!r.id||ids.has(r.id))throw new Error('Duplicate or missing Almanac ID');ids.add(r.id);};
 const reviewed=r=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(r.reviewedAt||''))throw new Error('Review date required');};
 for(const s of data.sources){register(s);if(!safeUrl(s.url)||!s.publisher||!/^\d{4}-\d{2}-\d{2}$/.test(s.checkedAt))throw new Error('Invalid Almanac source');}
 for(const a of data.archives){register(a);reviewed(a);if(!stateById(a.stateId)||!safeUrl(a.url)||a.status!=='metadata_only')throw new Error('Invalid archival lead');}
 for(const r of data.states){register(r);if(!stateById(r.id))throw new Error('Invalid Almanac state');
  if(r.articleIds.some(id=>!articles.has(id))||r.archiveIds.some(id=>!archives.has(id)||archives.get(id).stateId!==r.id)||r.accessSourceIds.some(id=>!sources.has(id)))throw new Error('Invalid Almanac relationship');
  if(r.accessNotes!==undefined&&(!Array.isArray(r.accessNotes)||r.accessNotes.some(n=>n.status!=='source_checked')))throw new Error('Invalid Almanac access note');
  if(r.researchNotes!==undefined&&(!Array.isArray(r.researchNotes)||r.researchNotes.some(n=>!['geology','seasons','resources','history','access'].includes(n.category)||!n.title?.trim()||!n.text?.trim()||!n.locator?.trim()||n.status!=='source_checked'||n.researchClaimId!==n.id||n.sourceIds?.some(id=>sources.get(id)?.inspectionBasis==='catalog_metadata'))))throw new Error('Invalid published research note');
  if(r.mines!==undefined&&!Array.isArray(r.mines))throw new Error('Invalid historic mine collection');
  if(r.destinations!==undefined&&!Array.isArray(r.destinations))throw new Error('Invalid panning destinations');
  if(r.discovery!==undefined){
   const v=r.discovery;
   if(!v||!['authenticated_discovery','documented_report','reported_discovery','early_mining','regional_discovery'].includes(v.basis)||['label','dateText','text','locator'].some(k=>typeof v[k]!=='string'||!v[k].trim()||v[k].length>(k==='text'?1200:180))||v.status!=='source_checked'||!Array.isArray(v.sourceIds)||!v.sourceIds.length||v.sourceIds.some(id=>!sources.has(id)||sources.get(id).inspectionBasis==='catalog_metadata')||r.facts.some(f=>f.key==='first-discovery'))throw new Error('Invalid discovery record');
  }

  for(const destination of r.destinations||[]){
   const authority=sources.get(destination.permissionSourceId)?.authority;
   if(!destination.title||!destination.text||destination.status!=='source_checked'||!['public_hand_panning','operator_river_access','supervised_practice'].includes(destination.kind)||!destination.sourceIds?.includes(destination.permissionSourceId)||!({public_hand_panning:['land_manager'],operator_river_access:['operator'],supervised_practice:['operator','land_manager']}[destination.kind]||[]).includes(authority)||!destination.locator||destination.coordinates!==undefined)throw new Error('Invalid destination access evidence');
   const keys=['where','entry','equipment','fees','season','facilities'];
   if(!Array.isArray(destination.tripFacts)||destination.tripFacts.length!==keys.length||new Set(destination.tripFacts.map(f=>f.key)).size!==keys.length||destination.tripFacts.some(f=>!keys.includes(f.key)||!f.text||!f.locator||!f.sourceIds?.length||f.sourceIds.some(id=>!destination.sourceIds.includes(id))))throw new Error('Invalid destination trip facts');
   if(!Array.isArray(destination.beforeYouGo)||!destination.beforeYouGo.length||destination.beforeYouGo.some(t=>typeof t!=='string'||!t.trim())||!Array.isArray(destination.articleIds)||destination.articleIds.some(id=>!articles.has(id)||!r.articleIds.includes(id)))throw new Error('Invalid destination preparation');
  }
  for(const mine of r.mines||[]){
   const loc=mine.location;
   if(mine.status!=='source_checked'||!mine.title||!mine.text||!mine.dates||!['gold_mine','gold_silver_mine','gold_prospect','disputed_gold_working'].includes(mine.kind)||!loc?.description||!['unresolved','recorded_approximate'].includes(loc.precision))throw new Error('Invalid historic mine record');
   if(loc.precision==='unresolved'&&loc.coordinates!==undefined)throw new Error('Unresolved mine cannot have a map coordinate');
   if(loc.precision==='recorded_approximate'&&(!Array.isArray(loc.coordinates)||loc.coordinates.length!==2||!loc.coordinates.every(Number.isFinite)||Math.abs(loc.coordinates[0])>90||Math.abs(loc.coordinates[1])>180||loc.datum!=='WGS84'||!mine.sourceIds?.includes(loc.sourceId)||!loc.locator||!(loc.accuracyMeters===null||(Number.isFinite(loc.accuracyMeters)&&loc.accuracyMeters>0))))throw new Error('Invalid sourced mine coordinate');
   if(mine.historyNotes!==undefined&&(!Array.isArray(mine.historyNotes)||mine.historyNotes.some(n=>!n.title||!n.text||!n.locator||n.status!=='source_checked'||!n.sourceIds?.length||n.sourceIds.some(id=>!mine.sourceIds?.includes(id)))))throw new Error('Invalid mine history note');
   if(mine.furtherReading!==undefined&&(!Array.isArray(mine.furtherReading)||mine.furtherReading.some(link=>!mine.sourceIds?.includes(link.sourceId)||!sources.has(link.sourceId)||!link.locator||!['document_reviewed','catalog_only'].includes(link.inspection)||(sources.get(link.sourceId)?.inspectionBasis==='catalog_metadata'&&link.inspection!=='catalog_only')||(link.page!==undefined&&!sourceDocumentUrl(sources.get(link.sourceId)?.url,link.page)))))throw new Error('Invalid mine archival link');
   if(mine.researchNote!==undefined&&(typeof mine.researchNote!=='string'||!mine.researchNote.trim()))throw new Error('Invalid mine research note');
  }
  for(const item of [r.overview,r.discovery,...r.facts,...r.history,...r.places,...(r.destinations||[]),...(r.accessNotes||[]),...(r.researchNotes||[]),...(r.mines||[]),...(r.mines||[]).flatMap(m=>m.historyNotes||[])].filter(Boolean)){
   register(item);reviewed(item);if(!['source_checked','reported_occurrence'].includes(item.status))throw new Error('Unreviewed Almanac claim');if(!item.sourceIds?.length||item.sourceIds.some(id=>!sources.has(id)))throw new Error('Unattributed Almanac claim');
   if(item.value!==undefined&&(!Number.isFinite(item.value)||item.value<0||!item.period||!item.unit||item.scope!==r.id||!item.definition||!item.locator||item.status!=='source_checked'))throw new Error('Invalid Almanac statistic');
  }
 }
 return data;
}
export const content=validateContent(JSON.parse(readFileSync(new URL('./content.json',import.meta.url),'utf8')));
export function statesInCoverage(text){
 // Longest names first prevents West Virginia also becoming Virginia. Broad regions are never expanded.
 let remaining=String(text||'');const ids=[];
 for(const state of [...states].sort((a,b)=>b.name.length-a.name.length)){
  const re=new RegExp('\\b'+state.name+'\\b','gi');if(re.test(remaining)){ids.push(state.id);remaining=remaining.replace(re,' ');}
 }
 return ids;
}
export function sourceDocumentUrl(url,page){
 const safe=safeUrl(url);if(!safe)return null;
 const u=new URL(safe);
 if(page!==undefined){
  if(!Number.isInteger(page)||page<1||page>10000||!/\.pdf$/i.test(u.pathname))return null;
  u.hash='page='+page;
 }
 return u.href;
}
export function sourceVideoUrl(url,seconds,basis){
 const safe=safeUrl(url);if(!safe)return null;
 const u=new URL(safe);
 if(basis==='footage'&&Number.isInteger(seconds)&&seconds>=0&&(/(^|\.)youtube\.com$/.test(u.hostname)||u.hostname==='youtu.be'))u.searchParams.set('t',seconds+'s');
 return u.href;
}
export function assembleState(state,live=null,availability='offline'){
 const record=content.states.find(r=>r.id===state.id)||{id:state.id,facts:[],history:[],places:[],articleIds:[],archiveIds:[],accessSourceIds:[]};
 const creators=new Map();
 // The roster's region field denotes reviewed coverage, never account/home coordinates.
 // Business headquarters alone are insufficient evidence of prospecting work.
 if(availability!=='unavailable')for(const c of creatorCatalog()){
  if(!['verified','published'].includes(c.status)||['mbmmllc','gerrys-detectors'].includes(c.slug)||!statesInCoverage(c.region).includes(state.id)||live?.excludedSlugs?.includes(c.slug))continue;
  creators.set(c.slug,{id:'creator:'+c.slug,slug:c.slug,name:c.name,url:availability==='connected'?'/prospectors/'+c.slug+'/':null,channelUrl:c.official_url,coverage:c.region,sourceUrl:c.region_source||c.official_url,checkedAt:c.checked_at,basis:'Reviewed roster coverage; individual experiences are not yet linked.'});
 }
 for(const c of live?.creators||[])creators.set(c.slug,{id:'creator:'+c.slug,slug:c.slug,name:c.display_name,url:'/prospectors/'+c.slug+'/',channelUrl:c.channel_url,coverage:c.region_name,sourceUrl:c.source_url,checkedAt:c.checked_at,basis:'Published, sourced '+c.relationship_type.replaceAll('_',' ')+' relationship.'});
 const articles=publishedArticles().filter(a=>record.articleIds.includes(a.id));
 return {state,record,creators:[...creators.values()].sort((a,b)=>a.name.localeCompare(b.name)),articles,archives:content.archives.filter(a=>record.archiveIds.includes(a.id)),sources:content.sources,regions:live?.regions||[],waterways:live?.waterways||[],resources:live?.resources||[],availability,reviewedAt:record.researchReviewedAt||record.overview?.reviewedAt||content.reviewedAt};
}
