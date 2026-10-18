import {geoAlbersUsa} from 'd3-geo';
import {mergeCatalog} from '../creator-catalog.js';
import {mapRecords} from '../creator-map.js';
import {creatorPlacements} from '../../dist/creator-map-shared.js';
import {states} from './model.js';
import {canadaProvinces,projectCanadianPoint} from './map-geometry.js';
const usRegions=new Set([...states.map(s=>s.name.toLowerCase()),'new england','midwestern usa','pacific northwest']);
const canadianRegions=new Set([...canadaProvinces.map(p=>p.name.toLowerCase()),'vancouver island']);
// Dan's own site identifies Peachland; NRCan's town reference is rounded here.
// This is a public regional display point, never an address or a gold claim.
const publicTown={slug:'dan-hurd',label:'Peachland, British Columbia',lat:49.77,lng:-119.74,countryCode:'CA',sourceUrl:'https://danhurdprospecting.com/about/',coordinateSource:'https://geonames.nrcan.gc.ca/search-place-names/unique?id=JCVCF',checkedAt:'2026-10-18'};
export function unifiedCreatorRecords(data){
 const merged=mergeCatalog(data),records=mapRecords(merged.people,merged.regions,merged.topics);
 const unique=[...new Map(records.map(p=>[p.slug,p])).values()];
 const regionFor=p=>{
  if(p.slug===publicTown.slug&&p.regions.some(r=>r.label==='British Columbia'))return publicTown;
  const us=p.regions.find(r=>usRegions.has(r.label.toLowerCase()));if(us)return us;
  const regions=p.regions.filter(r=>canadianRegions.has(r.label.toLowerCase()));
  return regions.find(r=>p.location.toLowerCase().startsWith(r.label.toLowerCase()))||regions[0];
 };
 const placements=creatorPlacements(unique,regionFor),project=geoAlbersUsa().scale(1300).translate([487.5,305]);
 return unique.map(p=>{const region=regionFor(p),country=region?(region.countryCode|| (canadianRegions.has(region.label.toLowerCase())?'CA':'US')):null,point=placements.get(p.slug),xy=point?(country==='CA'?projectCanadianPoint:project)([point[1],point[0]]):null;return {...p,mapCountry:xy?country:null,mapRegion:region||null,mapPoint:xy?xy.map(n=>Math.round(n*100)/100):null};});
}
export function createAlmanacCreators(directory){return async()=>{
 if(!directory?.map)return {available:false,records:[]};
 try{return {available:true,records:unifiedCreatorRecords(await directory.map())};}catch{return {available:false,records:[]};}
};}
