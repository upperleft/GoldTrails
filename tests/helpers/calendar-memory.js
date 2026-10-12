import {randomUUID} from 'node:crypto';
import {CalendarError} from '../../app/calendar/model.js';
export function calendarMemoryStore(){
 const calendars=new Map(),events=new Map(),prefs=new Map(),exceptions=new Map();
 const ownCalendar=(owner,id)=>{const c=calendars.get(id);if(!c||c.owner!==owner)throw new CalendarError('That calendar does not exist.',404);return c;};
 const ownEvent=(owner,id)=>{const e=events.get(id);if(!e)throw new CalendarError('That event does not exist.',404);ownCalendar(owner,e.calendarId);return e;};
 const check=(row,revision)=>{if(row.revision!==revision)throw new CalendarError('This item changed on another screen.',409);};
 return {
 calendars,events,prefs,exceptions,ready:async()=>true,allowWrite:async()=>true,allowRead:async()=>true,
 async listCalendars(owner){return {calendars:[...calendars.values()].filter(c=>c.owner===owner).map(({owner,...c})=>structuredClone(c)),preferences:prefs.get(owner)||{view:'dayGridMonth',timeZone:'America/New_York'},hasSavedPreferences:prefs.has(owner)};},
 async createCalendar(owner,input){const c={...input,id:randomUUID(),owner,visible:true,revision:1};calendars.set(c.id,c);const {owner:ignored,...out}=c;return structuredClone(out);},
 async saveCalendar(owner,id,input){const c=ownCalendar(owner,id);check(c,input.revision);Object.assign(c,{name:input.name,color:input.color,revision:c.revision+1});const {owner:ignored,...out}=c;return structuredClone(out);},
 async deleteCalendar(owner,id,revision){const c=ownCalendar(owner,id);check(c,revision);for(const [eventId,e]of events)if(e.calendarId===id){events.delete(eventId);exceptions.delete(eventId);}calendars.delete(id);},
 async savePreferences(owner,input){for(const id of input.visibleCalendarIds)ownCalendar(owner,id);for(const c of calendars.values())if(c.owner===owner)c.visible=input.visibleCalendarIds.includes(c.id);prefs.set(owner,{view:input.view,timeZone:input.timeZone});},
 async listEvents(owner){return [...events.values()].filter(e=>{const c=calendars.get(e.calendarId);return c.owner===owner&&c.visible;}).map(e=>structuredClone({...e,color:calendars.get(e.calendarId).color,exceptions:exceptions.get(e.id)||[]}));},
 async loadEvent(owner,id){try{return structuredClone({...ownEvent(owner,id),exceptions:exceptions.get(id)||[]});}catch(e){if(e.status===404)return null;throw e;}},
 async createEvent(owner,input){ownCalendar(owner,input.calendarId);const event={...input,id:randomUUID(),revision:1};events.set(event.id,event);return structuredClone(event);},
 async saveEvent(owner,id,input,revision,{resetExceptions=false}={}){const e=ownEvent(owner,id);check(e,revision);ownCalendar(owner,input.calendarId);const changed=['startLocal','endLocal','timeZone','allDay','rrule'].some(k=>e[k]!==input[k]);if(changed&&exceptions.get(id)?.length&&!resetExceptions)throw new CalendarError('Confirm before clearing occurrence edits.',409);if(changed&&resetExceptions)exceptions.delete(id);Object.assign(e,input,{revision:e.revision+1});return structuredClone(e);},
 async deleteEvent(owner,id,revision){const e=ownEvent(owner,id);check(e,revision);events.delete(id);exceptions.delete(id);},
 async saveOccurrence(owner,id,input){const e=ownEvent(owner,id);check(e,input.revision);const rows=exceptions.get(id)||[],existing=rows.findIndex(x=>x.occurrenceStart===input.occurrenceStart);const value={occurrenceStart:input.occurrenceStart,cancelled:input.cancelled,override:input.override};if(existing<0)rows.push(value);else rows[existing]=value;exceptions.set(id,rows);e.revision++;}
 };
}
