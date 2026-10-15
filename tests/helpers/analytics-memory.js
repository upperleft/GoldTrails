import {summarizeEvents} from '../../app/analytics/model.js';
export function analyticsMemory(events=[]){
 return {events,ready:async()=>true,record:async e=>{if(!events.some(x=>x.id===e.id))events.push({...e,created_at:new Date().toISOString()});},report:async range=>({...summarizeEvents(events,range),earliest:events.map(e=>e.created_at).sort()[0]||null})};
}
