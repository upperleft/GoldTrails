import {DateTime,IANAZone} from 'luxon';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {states as almanacStates} from '../almanac/model.js';
export const states=almanacStates.map(({code,name,slug})=>({code,name,slug}));
export const stateFor=value=>states.find(s=>s.code===value||s.slug===value);
export const categories=['Outing','Panning lesson','Club meeting','Online talk','Equipment workshop','Cleanup','Other'];
export const levels=['All levels','Beginner','Intermediate','Experienced'];
export class ConnectionsError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export const eventUrl=id=>'/connections/events/'+id+'/';
export const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const text=(value,label,max=500,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||required&&!value.trim())throw new ConnectionsError('Check '+label+'.');return value.trim();};
export function httpsUrl(value,label='link'){
 if(!value)return '';
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&value.length<=1500)return u.href;}catch{}
 throw new ConnectionsError('Use a complete HTTPS '+label+'.');
}
function localTime(value,zone,label){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value||''))throw new ConnectionsError('Choose '+label+'.');
 const dt=DateTime.fromISO(value,{zone});
 if(!dt.isValid||dt.toFormat("yyyy-MM-dd'T'HH:mm")!==value.slice(0,16))throw new ConnectionsError(label+' falls in a daylight-saving gap. Choose another time.');
 if(dt.getPossibleOffsets().length>1)throw new ConnectionsError(label+' occurs twice when clocks change. Choose an unambiguous time or enter UTC times with the UTC zone.');
 return dt;
}
export function validateEvent(input,now=Date.now()){
 const out={};
 for(const [key,max,required]of [['title',160,true],['description',12000,true],['locationName',180,false],['street',240,false],['city',120,false],['zip',20,false],['cost',200,false],['equipment',2000,false],['accessibility',2000,false],['bring',2000,false],['safety',3000,false],['instructions',3000,false]])out[key]=text(input[key]??'',key,max,required);
 if(!stateFor(input.state))throw new ConnectionsError('Choose one of the 50 host states.');out.state=stateFor(input.state).code;
 for(const[key,allowed]of Object.entries({category:categories,level:levels,mode:['in-person','online','hybrid'],visibility:['public','plus'],addressVisibility:['public','attendees'],notificationRange:['0','1','2']})){
  if(!allowed.includes(String(input[key])))throw new ConnectionsError('Choose '+key+'.');out[key]=String(input[key]);
 }
 out.timeZone=text(input.timeZone,'time zone',100,true);if(!IANAZone.isValidZone(out.timeZone)&&out.timeZone!=='UTC')throw new ConnectionsError('Use an IANA time zone, such as America/New_York.');
 const start=localTime(input.startLocal,out.timeZone,'Start time'),end=localTime(input.endLocal,out.timeZone,'End time');
 if(end<=start||end.diff(start,'days').days>7)throw new ConnectionsError('End the event after it starts, within seven days.');
 out.startLocal=start.toFormat("yyyy-MM-dd'T'HH:mm:ss");out.endLocal=end.toFormat("yyyy-MM-dd'T'HH:mm:ss");out.startUtc=start.toUTC().toISO();out.endUtc=end.toUTC().toISO();
 if(input.status&&!['draft','published'].includes(input.status))throw new ConnectionsError('Save a draft or publish.');out.status=input.status||'draft';
 if(out.status==='published'&&start.toMillis()<=now)throw new ConnectionsError('Publish an event with a future start time.');
 out.capacity=input.capacity===''||input.capacity==null?null:Number(input.capacity);
 if(out.capacity!==null&&(!Number.isInteger(out.capacity)||out.capacity<1||out.capacity>10000))throw new ConnectionsError('Use a capacity of 1–10,000, or leave it blank.');
 out.waitlist=input.waitlist===true||input.waitlist==='yes';
 out.deadlineUtc=input.deadlineLocal?localTime(input.deadlineLocal,out.timeZone,'RSVP deadline').toUTC().toISO():null;
 if(out.deadlineUtc&&out.deadlineUtc>out.startUtc)throw new ConnectionsError('The RSVP deadline must be before the event starts.');
 out.mapUrl=httpsUrl(input.mapUrl,'map link');
 const meeting={zoomId:text(input.zoomId??'','Zoom meeting ID',30),zoomUrl:httpsUrl(input.zoomUrl,'Zoom meeting link'),passcode:text(input.passcode??'','meeting passcode',100),alternativeUrl:httpsUrl(input.alternativeUrl,'meeting link')};
 if(meeting.zoomId&&!/^[\d -]{8,30}$/.test(meeting.zoomId))throw new ConnectionsError('Check the Zoom meeting ID.');
 if(meeting.zoomUrl&&!/(^|\.)(zoom\.us|zoomgov\.com)$/.test(new URL(meeting.zoomUrl).hostname))throw new ConnectionsError('Use a zoom.us or zoomgov.com meeting link, or use Alternative meeting link.');
 out.meeting=Object.values(meeting).some(Boolean)?meeting:null;
 if(out.status==='published'&&out.mode!=='in-person'&&!meeting.zoomUrl&&!meeting.alternativeUrl)throw new ConnectionsError('Add an online meeting link before publishing an online or hybrid event.');
 out.recurrence=String(input.recurrence||'none');out.occurrences=out.recurrence==='none'?1:Number(input.occurrences);
 if(!['none','weekly','monthly'].includes(out.recurrence)||!Number.isInteger(out.occurrences)||out.occurrences<1||out.occurrences>24)throw new ConnectionsError('Choose up to 24 weekly or monthly occurrences.');
 return out;
}
export function occurrenceInputs(event){
 return Array.from({length:event.occurrences},(_,i)=>{
  const delta=event.recurrence==='weekly'?{weeks:i}:{months:i},start=DateTime.fromISO(event.startLocal,{zone:event.timeZone}).plus(delta),end=DateTime.fromISO(event.endLocal,{zone:event.timeZone}).plus(delta);
  // Keep the series wall time; reject a DST gap rather than silently moving it.
  if(start.toFormat('HH:mm')!==event.startLocal.slice(11,16)||end.toFormat('HH:mm')!==event.endLocal.slice(11,16)||start.getPossibleOffsets().length>1||end.getPossibleOffsets().length>1)throw new ConnectionsError('An occurrence falls on a clock change. Create that occurrence separately.');
  const deadlineUtc=event.deadlineUtc?DateTime.fromISO(event.deadlineUtc,{zone:'utc'}).setZone(event.timeZone).plus(delta).toUTC().toISO():null;
  return {...event,startLocal:start.toFormat("yyyy-MM-dd'T'HH:mm:ss"),endLocal:end.toFormat("yyyy-MM-dd'T'HH:mm:ss"),startUtc:start.toUTC().toISO(),endUtc:end.toUTC().toISO(),deadlineUtc,occurrences:1};
 });
}
export function meetingVault(encoded){
 const key=typeof encoded==='string'&&/^[a-f0-9]{64}$/i.test(encoded)?Buffer.from(encoded,'hex'):null;
 return {ready:Boolean(key),seal(data){if(!data)return null;if(!key)throw new ConnectionsError('Private meeting storage needs configuration before saving meeting credentials.',503);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');},open(value){if(!value)return null;if(!key)throw new ConnectionsError('Private meeting storage is unavailable.',503);try{const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());}catch{throw new ConnectionsError('Private meeting details are unavailable.',503);}}};
}
export function publicEvent(event){
 const keys=['id','organizerName','title','description','state','category','level','mode','visibility','status','locationName','city','zip','timeZone','startLocal','endLocal','startUtc','endUtc','capacity','deadlineUtc','waitlist','cost','equipment','accessibility','bring','safety','instructions','revision','yesCount','waitlistCount','imageId','imageCaption','recap'];
 const value=Object.fromEntries(keys.filter(k=>event[k]!==undefined).map(k=>[k,event[k]]));
 if(event.addressVisibility==='public'){value.street=event.street;value.mapUrl=event.mapUrl;}else{delete value.zip;value.addressRestricted=true;}
 return value;
}
export function eventFilters(params){
 const f={q:(params.get('q')||'').trim().slice(0,120),state:params.get('state')||'',range:params.get('range')||'0',mode:params.get('mode')||'',category:params.get('category')||'',level:params.get('level')||'',period:params.get('period')||'upcoming',spaces:params.get('spaces')==='yes',from:params.get('from')||'',to:params.get('to')||'',view:params.get('view')||'list',month:params.get('month')||'',page:Number(params.get('page')||1)};
 if(f.state&&!stateFor(f.state)||!['0','1','2'].includes(f.range)||f.mode&&!['online','in-person','hybrid'].includes(f.mode)||f.category&&!categories.includes(f.category)||f.level&&!levels.includes(f.level)||!['upcoming','past'].includes(f.period)||!['list','calendar'].includes(f.view)||!Number.isInteger(f.page)||f.page<1||f.page>1000)throw new ConnectionsError('Choose the listed event filters.');
 if(f.month&&(!/^\d{4}-\d\d$/.test(f.month)||!DateTime.fromISO(f.month+'-01').isValid))throw new ConnectionsError('Choose a valid calendar month.');
 if(f.view==='calendar'){if(!f.month)f.month=(f.period==='past'?DateTime.utc().minus({months:1}):DateTime.utc()).toFormat('yyyy-MM');const month=DateTime.fromISO(f.month+'-01',{zone:'utc'});f.from=month.toISODate();f.to=month.endOf('month').toISODate();}
 for(const key of ['from','to'])if(f[key]&&(!/^\d{4}-\d\d-\d\d$/.test(f[key])||!DateTime.fromISO(f[key]).isValid))throw new ConnectionsError('Choose valid filter dates.');
 if(f.from&&f.to&&f.from>f.to)throw new ConnectionsError('Choose an end date after the start date.');
 return f;
}
