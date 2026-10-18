import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {geoAlbers,geoPath} from 'd3-geo';

// Offline compiler. Refresh the vendored official GeoJSON and its inspection
// record deliberately; an ordinary website build must never request a map API.
const root=new URL('../',import.meta.url);
const sourcePath=new URL('database/map-data/canada-provinces-2021.geojson',root);
const inspectionPath=new URL('database/map-data/canada-boundary-source-2026-10-18.json',root);
const originalUsa=await readFile(new URL('app/almanac/states.json',root));
const sourceBytes=await readFile(sourcePath);
const source=JSON.parse(sourceBytes);
const inspection=JSON.parse(await readFile(inspectionPath,'utf8'));
assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),inspection.sha256,'Source bytes differ from the inspected official download');
assert.equal(source.type,'FeatureCollection');
assert.equal(source.features.length,13,'All 10 provinces and 3 territories are required');
const codes={'10':'NL','11':'PE','12':'NS','13':'NB','24':'QC','35':'ON','46':'MB','47':'SK','48':'AB','59':'BC','60':'YT','61':'NT','62':'NU'};
const projection=geoAlbers().parallels([29.5,45.5]).rotate([96,0]).center([-0.6,38.7]).scale(1300).translate([487.5,305]);
const path=geoPath(projection).digits(1);
const round=n=>Math.round(n*10)/10;
let sourceRings=0,collapsedRings=0;
function normalizeRing(ring){
 sourceRings++;
 assert.ok(ring.length>=4);
 for(const coordinate of ring)assert.ok(coordinate.length===2&&coordinate.every(Number.isFinite)&&Math.abs(coordinate[0])<=180&&Math.abs(coordinate[1])<=90,'Source coordinates must be WGS84 longitude/latitude');
 const [x,y]=ring[0];
 // Subtract a local origin before shoelace arithmetic so tiny coastal triangles
 // do not lose their signed area to cancellation at longitudes around -120.
 const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+(p[0]-x)*(q[1]-y)-(q[0]-x)*(p[1]-y);},0)/2;
 if(Math.abs(area)<1e-8){collapsedRings++;return null;}
 // Project each ring independently; SVG evenodd restores holes by nesting.
 // This avoids the source's generalized tiny hole/island grouping artifacts
 // becoming spherical world complements. Never alter the vendored source.
 return area>0?[...ring].reverse():ring;
}
const provinces=source.features.map(feature=>{
 const uid=String(feature.properties.PRUID),code=codes[uid],name=feature.properties.PRENAME;
 assert.ok(code&&typeof name==='string'&&name.trim(),'Unknown or unlabeled source province');
 const kind=feature.geometry.type;
 assert.ok(['Polygon','MultiPolygon'].includes(kind));
 const polygons=(kind==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates).flat().map(normalizeRing).filter(Boolean).map(ring=>[ring]);
 const geometry={type:'MultiPolygon',coordinates:polygons};
 const outline=path(geometry),bounds=path.bounds(geometry),center=path.centroid(geometry);
 assert.ok(outline?.startsWith('M')&&outline.endsWith('Z')&&bounds.flat().every(Number.isFinite)&&center.every(Number.isFinite));
 assert.ok(bounds[0][0]>-500&&bounds[1][0]<1500&&bounds[0][1]>-1000&&bounds[1][1]<400,'A source ring produced a non-Canadian/world-complement path');
 // Atlantic labels are moved slightly apart, with leader lines rendered by the
 // caller using the same center/label contract as the existing small US states.
 const label=code==='PE'?[center[0]+30,center[1]-20]:code==='NS'?[center[0]+30,center[1]+15]:center;
 return {id:'CA-'+code,code,name,slug:name.toLowerCase().replaceAll(' ','-'),sourceUid:uid,path:outline,fillRule:'evenodd',label:label.map(round),center:center.map(round),bounds:[bounds[0].map(n=>Math.floor(n*10)/10),bounds[1].map(n=>Math.ceil(n*10)/10)]};
}).sort((a,b)=>a.name.localeCompare(b.name,'en'));
assert.equal(new Set(provinces.map(p=>p.id)).size,13);
assert.equal(new Set(provinces.map(p=>p.slug)).size,13);
const compiled=JSON.stringify(provinces)+'\n';
await writeFile(new URL('app/almanac/canada-provinces.json',root),compiled);
assert.ok(originalUsa.equals(await readFile(new URL('app/almanac/states.json',root))),'The existing US outlines must remain byte-for-byte unchanged');
console.log(JSON.stringify({provinces:provinces.length,sourceBytes:sourceBytes.length,compiledBytes:Buffer.byteLength(compiled),sourceRings,collapsedRings,bounds:[
 [Math.min(...provinces.map(p=>p.bounds[0][0])),Math.min(...provinces.map(p=>p.bounds[0][1]))],
 [Math.max(...provinces.map(p=>p.bounds[1][0])),Math.max(...provinces.map(p=>p.bounds[1][1]))]
],usaUnchanged:true},null,2));
