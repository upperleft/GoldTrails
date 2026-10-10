import {ProfileError} from './profile.js';
// The registry is also the Phase 1 inventory. Previews never masquerade as live tools.
export const dashboardGroups={personal:'My trail',research:'Research',learning:'Learning',equipment:'Equipment',field:'Trips & fieldwork',community:'Community',privacy:'Privacy'};
export const dashboardModules=[
 ['next','Your next adventure','personal','working','◈'],['progress','Learning progress','personal','working','▤'],
 ['maps','My Gold Maps','research','working','⌖'],['locations','Saved Rivers and Locations','research','working','≈'],['river','Research a River','research','preview','≈'],['regional','Regional Prospecting Guides','research','preview','⌂'],['history','Historical Gold Discoveries','research','preview','◇'],['conditions','Weather and River Conditions','research','preview','☀'],['regulations','Prospecting Regulations','research','preview','§'],
 ['trail','My Learning Trail','learning','working','➜'],['articles','Recommended Articles','learning','working','▤'],['videos','Recommended Videos','learning','working','▷'],['creators','Favorite Creators','learning','working','✦'],['bookshelf','Digital Bookshelf','learning','preview','▥'],['glossary','Prospecting Glossary','learning','working','Aa'],['guide','Ask the Old Timer AI','learning','working','✧'],['achievements','Learning Achievements','learning','working','☆'],
 ['shed','My Equipment Shed','equipment','working','⚒'],['wishlist','Equipment Wish List','equipment','working','♡'],['comparison','Equipment Comparison','equipment','preview','⇄'],['gear','Recommended Equipment','equipment','working','⚒'],['maintenance','Equipment Maintenance Notes','equipment','preview','◷'],
 ['planner','Trip Planner','field','preview','⌖'],['calendar','Prospecting Calendar','field','preview','▦'],['packing','Packing Checklist','field','demo','✓'],['journal','Field Journal','field','preview','▤'],['finds','Gold Finds Log','field','preview','◇'],['photos','Photo Gallery','field','preview','▧'],['trips','Trip History','field','preview','➜'],
 ['discussions','Community Discussions','community','preview','☷'],['reports','Member Field Reports','community','preview','⚑'],['followed','Followed Locations','community','preview','⌖'],['updates','Creator Updates','community','preview','✦'],
 ['vault','Prospector’s Vault','privacy','preview','▣'],['privacy','Privacy Settings','privacy','working','◈'],['account','Data Export and Account Controls','privacy','working','↗']
].map(([id,title,group,status,icon])=>({id,title,group,status,icon}));
export const defaultVisible=['next','progress','maps','trail','articles','creators','glossary','guide','achievements','shed','wishlist','gear','packing','planner','discussions','vault','privacy','account'];
export const defaultLayout=()=>({version:1,order:dashboardModules.map(m=>m.id),hidden:dashboardModules.filter(m=>!defaultVisible.includes(m.id)).map(m=>m.id)});
export function validateLayout(value){
 const ids=dashboardModules.map(m=>m.id);
 if(!value||value.version!==1||!Array.isArray(value.order)||value.order.length!==ids.length||new Set(value.order).size!==ids.length||value.order.some(id=>!ids.includes(id))||!Array.isArray(value.hidden)||new Set(value.hidden).size!==value.hidden.length||value.hidden.some(id=>!ids.includes(id)))throw new ProfileError('Choose only the dashboard modules listed here.');
 return {version:1,order:[...value.order],hidden:[...value.hidden]};
}
export function layoutFor(state){try{return validateLayout(state.answers.dashboardLayout);}catch{return defaultLayout();}}
export function layoutFromForm(f){
 if(f.get('intent')==='defaults')return defaultLayout();
 if(f.get('intent')!=='save')throw new ProfileError('Use a dashboard layout action.');
 const ids=dashboardModules.map(m=>m.id);
 for(const k of f.keys())if((k.startsWith('position_')||k.startsWith('visible_'))&&!ids.includes(k.replace(/^(position|visible)_/,'')))throw new ProfileError('Unknown dashboard module.');
 const ranked=ids.map((id,i)=>{const v=f.get('position_'+id);if(!/^\d{1,2}$/.test(v||'')||Number(v)<1||Number(v)>ids.length)throw new ProfileError('Choose a listed position for every module.');if(f.has('visible_'+id)&&f.get('visible_'+id)!=='yes')throw new ProfileError('Choose valid visibility.');return {id,position:Number(v),index:i};});
 ranked.sort((a,b)=>a.position-b.position||a.index-b.index);
 return validateLayout({version:1,order:ranked.map(r=>r.id),hidden:ids.filter(id=>!f.has('visible_'+id))});
}
