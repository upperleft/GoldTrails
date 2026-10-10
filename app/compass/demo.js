import {createCompassContent} from './content.js';
import {recommend} from './recommendations.js';
// Public catalog inputs only. No member store, session, profile, AI or DB required.
const content=createCompassContent({directory:{map:async()=>({people:[],regions:[],topics:[]})}});
export async function dashboardExample(persona='river'){
 const key=persona==='detecting'?'detecting':'river';
 const answers=key==='river'?{experience:'new',region:'New England',interests:['panning','river','geology'],equipment:['pan','classifier'],goal:'first',learning:['articles','steps']}:{experience:'experienced',region:'Colorado',interests:['detecting','geology','equipment'],equipment:['detector','pinpointer','pan'],goal:'detecting',learning:['videos','articles']};
 const state={answers,revision:0,step:0,completedAt:'example',inventory:[],activity:key==='river'?[{item_id:'article:is-that-really-gold',completed:1}]:[]};
 const catalog=await content();return {persona:key,state,records:catalog.records,result:recommend(state,catalog)};
}
