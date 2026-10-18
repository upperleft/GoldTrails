import {readFileSync} from 'node:fs';
import {communityCatalog} from '../community-catalog.js';

const states=JSON.parse(readFileSync(new URL('./states.json',import.meta.url),'utf8'));
const normalize=value=>String(value||'').trim().toLowerCase();
const stateByName=new Map(states.map(state=>[normalize(state.name),state]));
const stateByIdentifier=new Map(states.flatMap(state=>[state.id,state.code,state.name,state.slug].map(value=>[normalize(value),state])));
const alphabetic=new Intl.Collator('en',{sensitivity:'base',numeric:true});

function resolveState(state){
 const identifier=state&&typeof state==='object'?(state.id||state.code||state.slug||state.name):state;
 return stateByIdentifier.get(normalize(identifier));
}

function explicitRegionStates(region){
 // Only explicit state names in the catalog's reviewed region field qualify.
 // Broad regions, locations, names and nationwide organizations are not inferred.
 const names=String(region||'').split(/\s*&\s*/).map(normalize);
 if(!names.length||names.some(name=>!stateByName.has(name)))return [];
 return names.map(name=>stateByName.get(name).id);
}

export function communitiesForState(state){
 const resolved=resolveState(state);
 if(!resolved)return [];
 // Filter and sort a new array; each entry remains the public catalog's object.
 return communityCatalog.entries
  .filter(entry=>entry.status==='listed'&&explicitRegionStates(entry.region).includes(resolved.id))
  .sort((a,b)=>alphabetic.compare(a.name,b.name)||(a.id<b.id?-1:a.id>b.id?1:0));
}
