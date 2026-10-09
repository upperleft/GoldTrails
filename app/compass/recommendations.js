import {createHash} from 'node:crypto';
import {ownedCategories,experience,goals,equipment} from './profile.js';
export const activityMap=state=>new Map(state.activity.map(a=>[a.item_id,a]));
export function fingerprint(state,content){return createHash('sha256').update(JSON.stringify([state.answers,state.inventory,state.activity,content.version,'compass-1'])).digest('hex');}
export function recommend(state,content){const p=state.answers,activity=activityMap(state),owned=ownedCategories(p,state.inventory),advanced=['intermediate','experienced','expert'].includes(p.experience),interests=new Set(p.interests||[]);const ranking=[];
 for(const r of content.records){const a=activity.get(r.id);if(a?.dismissed||a?.already_known||a?.completed)continue;
 if(r.kind==='product'){
  if(owned.has(r.category)||r.category==='other')continue;
  // Core tools first. Large powered equipment needs an explicit interest and existing basics.
  const desired=new Set(['pan','classifier','snuffer']);if(interests.has('sluicing')||p.goal==='sluice'){desired.add('sluice');if(advanced)desired.add('highbanker');}if(interests.has('detecting')||p.goal==='detecting'){desired.add('detector');desired.add('pinpointer');}if(advanced&&interests.has('river'))desired.add('crevice');
  if(!desired.has(r.category))continue;
  if(p.budget!=null&&p.currency&&r.price!=null&&r.currency===p.currency&&r.price>p.budget)continue;
 }
 let score=0;const reasons=[];
 const matches=r.tags.filter(t=>interests.has(t));if(matches.length){score+=matches.length*4;reasons.push('Matches your interest in '+matches.map(t=>({river:'rivers and streams',detecting:'gold detecting',panning:'panning'})[t]||t).join(', ')+'.');}
 if(r.goals?.includes(p.goal)){score+=8;reasons.push('Supports your goal: '+goals[p.goal].toLowerCase()+'.');}
 const region=String(p.region||'').trim().toLowerCase();if(region.length>=3&&r.regions?.some(x=>{const s=x.toLowerCase();return s.includes(region)||region.includes(s);})){score+=10;reasons.push('The public profile covers your region. This describes content coverage, not permission to prospect.');}
 if(p.favoriteCreators?.includes(r.id)){score+=20;reasons.push('One of your chosen creators.');}
 if(r.kind==='article'){score+=advanced?(r.title.startsWith('How to Compare')?9:3):6-r.order;reasons.push(advanced?'A focused refresher using the published library.':'Part of the foundational learning sequence.');}
 if((p.learning||[]).includes('videos')&&r.kind==='video')score+=4;
 if(r.kind==='product'){score+=r.category==='pan'?6:r.category==='classifier'?4:2;reasons.push('Your inventory does not list '+equipment[r.category].toLowerCase()+'.');if(r.price==null||!r.currency)reasons.push('Price or currency is unconfirmed; check the manufacturer.');}
 for(const feedback of state.activity.filter(x=>x.preference)){const liked=content.records.find(x=>x.id===feedback.item_id);if(liked){score+=liked.tags.filter(t=>r.tags.includes(t)).length*Number(feedback.preference)*2;if(feedback.item_id===r.id)score+=Number(feedback.preference)*5;}}
 if(!reasons.length)reasons.push(r.kind==='creator'?'Explore a public creator profile from the research roster; a specific technique match is not established.':'Available in the current Gold Trails library.');
 ranking.push({id:r.id,score,reasons});
 }
 ranking.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));const ids=kind=>ranking.filter(x=>content.records.find(r=>r.id===x.id)?.kind===kind).slice(0,kind==='article'?5:3);
 const lessons=ids('article');if(!advanced)lessons.sort((a,b)=>content.records.find(r=>r.id===a.id).order-content.records.find(r=>r.id===b.id).order);
 const adventure=lessons[0]||ids('video')[0]||null;
 return {persona:advanced?'Seasoned Trail Reader':p.goal==='detecting'?'Gold Signal Seeker':p.goal==='first'||p.experience==='new'?'First-Gold Explorer':'Curious Prospector',experience:experience[p.experience]||'Your pace, your trail',adventure,lessons,creators:ids('creator'),products:ids('product'),videos:ids('video'),destinations:ids('destination'),owned:[...owned].map(k=>equipment[k]).filter(Boolean),generatedAt:new Date().toISOString()};
}
export function achievements(state,records){const a=activityMap(state),completed=id=>Boolean(a.get(id)?.completed),savedDestination=state.activity.some(x=>x.saved&&records.some(r=>r.id===x.item_id&&r.kind==='destination'));
 return [{id:'first',name:'FIRST STEPS',note:'Completed your prospecting profile.',earned:Boolean(state.completedAt)},{id:'stream',name:'STREAM READER',note:'Marked the stream-reading article complete.',earned:completed('article:where-gold-settles')},{id:'sand',name:'BLACK SAND STUDENT',note:'Completed the article and knowledge check.',earned:completed('article:black-sands')&&completed('challenge:black-sand')},{id:'gear',name:'GEAR INVENTORY',note:'Reviewed and confirmed your equipment inventory.',earned:completed('challenge:inventory')},{id:'explorer',name:'TRAIL EXPLORER',note:'Saved a destination with current access evidence.',earned:savedDestination}];
}
export async function recommendations(store,id,state,content){const key=fingerprint(state,content);const cached=await store.cache(id,key);if(cached&&[cached.adventure,...(cached.lessons||[]),...(cached.creators||[]),...(cached.products||[]),...(cached.videos||[]),...(cached.destinations||[])].filter(Boolean).every(x=>content.records.some(r=>r.id===x.id)))return cached;const result=recommend(state,content);await store.putCache(id,key,result);return result;}
