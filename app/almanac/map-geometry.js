import {readFileSync} from 'node:fs';
import {geoAlbers} from 'd3-geo';

// Match geoAlbersUsa's lower-48 component exactly. Canada must not pass through
// the USA composite projection: its northern clip regions include AK/HI insets.
const canadianProjection=geoAlbers()
 .parallels([29.5,45.5]).rotate([96,0]).center([-0.6,38.7])
 .scale(1300).translate([487.5,305]);

export function projectCanadianPoint(lngLat){
 if(!Array.isArray(lngLat)||lngLat.length!==2||!lngLat.every(Number.isFinite)||Math.abs(lngLat[0])>180||Math.abs(lngLat[1])>90)return null;
 return canadianProjection(lngLat);
}

export const canadaProvinces=JSON.parse(readFileSync(new URL('./canada-provinces.json',import.meta.url),'utf8'));
if(canadaProvinces.length!==13||new Set(canadaProvinces.map(p=>p.id)).size!==13||canadaProvinces.some(p=>!/^CA-[A-Z]{2}$/.test(p.id)||!p.path?.startsWith('M')||!p.bounds?.flat().every(Number.isFinite)))throw new Error('Canadian map geometry must cover all 13 provinces and territories');

// Retain the original USA canvas, including its repositioned AK/HI, while
// extending north/east to the actual Canadian polygons and their labels.
const corners=canadaProvinces.flatMap(p=>[...p.bounds,p.label]);
const padding=24;
export const mapBounds=[
 [Math.floor(Math.min(-70,...corners.map(p=>p[0]))-padding),Math.floor(Math.min(0,...corners.map(p=>p[1]))-padding)],
 [Math.ceil(Math.max(1030,...corners.map(p=>p[0]))+padding),Math.ceil(Math.max(650,...corners.map(p=>p[1]))+padding)]
];
export const mapViewBox=[...mapBounds[0],mapBounds[1][0]-mapBounds[0][0],mapBounds[1][1]-mapBounds[0][1]].join(' ');
