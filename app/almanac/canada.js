import {readFileSync} from 'node:fs';
import {canadaProvinces} from './map-geometry.js';
import {catalogBySlug} from '../creator-catalog.js';
import {safeUrl} from '../directory-views.js';
export const canadianContent=JSON.parse(readFileSync(new URL('./canada-content.json',import.meta.url),'utf8'));
const sources=new Map(canadianContent.sources.map(s=>[s.id,s]));
const ids=new Set();
for(const source of canadianContent.sources){if(ids.has(source.id)||!safeUrl(source.url)||!source.publisher||!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt))throw new Error('Invalid Canadian source');ids.add(source.id);}
if(canadianContent.regions.length!==13)throw new Error('Canadian guides must cover 13 jurisdictions');
for(const r of canadianContent.regions){
 const geometry=canadaProvinces.find(p=>p.slug===r.slug);
 if(!geometry||geometry.id!==r.id||ids.has(r.id))throw new Error('Invalid Canadian jurisdiction');ids.add(r.id);
 for(const c of [r.overview,...r.researchNotes]){
  if(ids.has(c.id)||c.status!=='source_checked'||!c.text?.trim()||!c.locator||!c.sourceIds?.length||c.sourceIds.some(id=>!sources.has(id))||!/^\d{4}-\d{2}-\d{2}$/.test(c.reviewedAt))throw new Error('Invalid Canadian claim');ids.add(c.id);
 }
 for(const s of r.statistics){if(!Number.isFinite(s.value)||s.value<=0||!s.geographicScope||!s.period||!s.unit||!s.qualifier||!r.researchNotes.some(c=>c.id===s.claimId&&c.category==='production'))throw new Error('Invalid Canadian production scope');}
}
export const canadianRegionBySlug=slug=>{const geometry=canadaProvinces.find(p=>p.slug===slug),record=canadianContent.regions.find(r=>r.slug===slug);return geometry&&record?{...geometry,name:record.name,country:'CA',type:record.type}:undefined;};
export function assembleCanada(state,connections={available:false,records:[]}){
 const r=canadianContent.regions.find(r=>r.id===state.id);
 const match=p=>p.mapCountry==='CA'&&p.regions?.some(region=>region.slug===state.slug||region.label===state.name||p.regionKeys?.includes(state.slug)||(state.slug==='british-columbia'&&region.label==='Vancouver Island'));
 const creators=(connections.records||[]).filter(match).map(p=>({id:'creator:'+p.slug,slug:p.slug,name:p.name,url:p.profileUrl||'/prospectors/'+p.slug+'/',channelUrl:catalogBySlug(p.slug)?.official_url,coverage:p.location,basis:'Reviewed public creator region; not a claim or a place open to prospecting.',checkedAt:p.mapRegion?.checkedAt||catalogBySlug(p.slug)?.checked_at,sourceUrl:catalogBySlug(p.slug)?.region_source||catalogBySlug(p.slug)?.official_url}));
 return {state:{...state,country:'CA',type:r.type},record:{...r,facts:[],history:[],places:[],articleIds:[],archiveIds:[],accessSourceIds:[]},creators,communities:[],articles:[],archives:[],sources:canadianContent.sources,regions:[],waterways:[],resources:[],availability:connections.available?'connected':'unavailable',reviewedAt:r.reviewedAt};
}
