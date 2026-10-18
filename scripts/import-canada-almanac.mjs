import {readFileSync,writeFileSync} from 'node:fs';
const base=new URL('../docs/research/canada-almanac-2026-10-18/',import.meta.url);
const research=JSON.parse(readFileSync(new URL('research.json',base),'utf8'));
const catalog=JSON.parse(readFileSync(new URL('sources.json',base),'utf8'));
const categories={geology:'geology',minerals:'geology',production:'production',discoveries:'history',access:'access',resources:'resources',seasons:'seasons'};
const titles={geology:'Gold geology',minerals:'Rocks & minerals',production:'Production in context',discoveries:'Discovery & mining history',access:'Before you prospect',resources:'Research tools',seasons:'Seasonal guidance'};
const regions=research.regions.map(r=>{
 const approved=r.claims.filter(c=>c.classification==='documented'&&c.status==='source_checked');
 const overview=approved.find(c=>c.category==='geology');
 if(!overview)throw new Error('Missing sourced overview: '+r.id);
 return {id:r.iso,slug:r.id,name:r.name,type:r.type,reviewedAt:research.checkedAt,overview:{...overview},researchNotes:approved.filter(c=>c!==overview).map(c=>({id:c.id,title:titles[c.category],category:categories[c.category],text:c.text,sourceIds:c.sourceIds,locator:c.locator,status:c.status,reviewedAt:c.reviewedAt,researchClaimId:c.id})),statistics:r.statistics.map(s=>({...s}))};
});
const used=new Set(regions.flatMap(r=>[...r.overview.sourceIds,...r.researchNotes.flatMap(n=>n.sourceIds)]));
const sources=catalog.sources.filter(s=>used.has(s.id)).map(s=>({...s,inspectionBasis:s.inspection,locator:s.inspection==='official_abstract'?'Publication abstract':s.inspection.includes('pdf')?'Geological publication':'Official source'}));
const output={version:1,reviewedAt:research.checkedAt,provenance:'docs/research/canada-almanac-2026-10-18/research.json',regions,sources};
writeFileSync(new URL('../app/almanac/canada-content.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(`Imported ${regions.length} Canadian guides; ${regions.reduce((n,r)=>n+1+r.researchNotes.length,0)} documented findings; ${sources.length} sources. Interpretations, gaps and ratings excluded.`);
