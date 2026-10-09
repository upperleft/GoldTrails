export const regionKey=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,150);
export function matchesCreator(p,filters){
 const words=String(filters.q||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
 const text=[p.name,p.introduction,p.location,p.searchText,...p.topics.map(t=>t.name)].join(' ').toLowerCase();
 return words.every(word=>text.includes(word))&&
  (!filters.setting||(filters.setting==='unknown'?!p.settings.length:p.settings.includes(filters.setting)))&&
  (!filters.region||(filters.region==='unknown'?!p.location:p.regionKeys.includes(filters.region)))&&
  (!filters.topic||p.topics.some(t=>t.slug===filters.topic))&&
  (!filters.specialty||p.specialties.includes(filters.specialty));
}
export function sortCreators(people,sort){return [...people].sort((a,b)=>(sort==='za'?-1:1)*a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));}
