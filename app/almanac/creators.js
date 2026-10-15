import {geoAlbersUsa} from 'd3-geo';
import {mergeCatalog} from '../creator-catalog.js';
import {mapRecords} from '../creator-map.js';
import {creatorPlacements} from '../../dist/creator-map-shared.js';
import {states} from './model.js';
const usRegions=new Set([...states.map(s=>s.name.toLowerCase()),'new england','midwestern usa','pacific northwest']);
export function unifiedCreatorRecords(data){
 const merged=mergeCatalog(data),records=mapRecords(merged.people,merged.regions,merged.topics);
 const unique=[...new Map(records.map(p=>[p.slug,p])).values()];
 const regionFor=p=>p.regions.find(r=>usRegions.has(r.label.toLowerCase()));
 const placements=creatorPlacements(unique,regionFor),project=geoAlbersUsa().scale(1300).translate([487.5,305]);
 return unique.map(p=>{const point=placements.get(p.slug),xy=point?project([point[1],point[0]]):null;return {...p,mapRegion:regionFor(p)||null,mapPoint:xy?xy.map(n=>Math.round(n*100)/100):null};});
}
export function createAlmanacCreators(directory){return async()=>{
 if(!directory?.map)return {available:false,records:[]};
 try{return {available:true,records:unifiedCreatorRecords(await directory.map())};}catch{return {available:false,records:[]};}
};}
