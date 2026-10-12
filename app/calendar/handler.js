import {randomBytes,timingSafeEqual} from 'node:crypto';
import {digest} from '../admin-auth.js';
import {CalendarError,validateCalendar,validateEvent,validateRange} from './model.js';
import {createRecurrencePool} from './worker-pool.js';
import {calendarPage,calendarPreview,calendarUnavailable} from './views.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const views=new Set(['dayGridMonth','timeGridWeek','timeGridDay','listMonth']);
const eventFields=['calendarId','title','description','location','startLocal','endLocal','timeZone','allDay','rrule'];
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp(`(?:^|;\\s*)__Host-gold-${name}=([a-f0-9]{64})(?:;|$)`))?.[1]||null;
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function fields(input,allowed){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new CalendarError('Use the calendar controls to submit supported fields.');
 return input;
}
function revision(input){if(!Number.isInteger(input.revision)||input.revision<1||input.revision>2147483646)throw new CalendarError('Reload the calendar before saving.');return input.revision;}
function eventInput(input){return Object.fromEntries(eventFields.filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]]));}
function preferences(input){
 fields(input,['csrf','view','timeZone','visibleCalendarIds']);
 if(!views.has(input.view)||typeof input.timeZone!=='string'||input.timeZone.length>100||!Array.isArray(input.visibleCalendarIds)||input.visibleCalendarIds.length>20||input.visibleCalendarIds.some(id=>typeof id!=='string'||!uuid.test(id))||new Set(input.visibleCalendarIds).size!==input.visibleCalendarIds.length)throw new CalendarError('Choose a calendar view, time zone, and your own calendars.');
 try{new Intl.DateTimeFormat('en',{timeZone:input.timeZone}).format();}catch{throw new CalendarError('Choose a valid IANA time zone, such as America/New_York.');}
 return {view:input.view,timeZone:input.timeZone,visibleCalendarIds:input.visibleCalendarIds};
}
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new CalendarError('Send calendar changes as JSON.',415);
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>32768)throw new CalendarError('This calendar change is too large.',413);chunks.push(chunk);}
 try{return fields(JSON.parse(Buffer.concat(chunks).toString('utf8')),['csrf',...eventFields,'name','color','revision','confirmation','view','visibleCalendarIds','occurrenceStart','cancelled','override','resetExceptions']);}catch(e){if(e instanceof CalendarError)throw e;throw new CalendarError('The calendar change could not be read.');}
}
const seriesFields=['id',...eventFields,'revision'];
const series=event=>({...Object.fromEntries(seriesFields.map(key=>[key,event[key]??null])),hasExceptions:Boolean(event.exceptions?.length)});

export function createCalendarHandler({members=null,store=null,config=null,log=console.error}={}){
 const pool=createRecurrencePool();
 // A small process-local cache contains only authenticated, owner-keyed
 // expansion results. Revision changes invalidate it without a public cache.
 const expansions=new Map();
 const expanded=async(owner,rows,range)=>{
  const result=new Map(),pending=[];
  const key=event=>[owner,event.id,event.revision,range.start,range.end].join('|');
  for(const event of rows){const cached=expansions.get(key(event));if(cached&&cached.expires>Date.now())result.set(event.id,cached.events);else pending.push(event);}
  if(pending.length){
   const calculated=await pool.run('expand',{events:pending,range});
   const byId=new Map(pending.map(event=>[event.id,event]));
   for(const {eventId,occurrences} of calculated){
    result.set(eventId,occurrences);
    if(occurrences.length<=256){if(expansions.size>=64)expansions.delete(expansions.keys().next().value);expansions.set(key(byId.get(eventId)),{events:occurrences,expires:Date.now()+15000});}
   }
  }
  return result;
 };
 const handler=async(req,res,url)=>{
  if(url.pathname==='/calendar'){res.writeHead(308,{Location:'/calendar/'+url.search,'Cache-Control':'no-store'});res.end();return true;}
  if(!url.pathname.startsWith('/calendar/'))return false;
  const api=url.pathname.startsWith('/calendar/api/');
  const nonce=randomBytes(18).toString('base64');
  const send=(status,value,extra={})=>{
   const headers={'Content-Type':api?'application/json; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin','Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'`,...extra};
   const output=api?JSON.stringify(value):value.replace('<head>',`<head><meta name="csp-nonce" content="${nonce}">`);
   res.writeHead(status,headers);res.end(req.method==='HEAD'?undefined:output);
  };
  const fail=(status,message)=>send(status,api?{error:message}:calendarUnavailable(message));
  try{
   const route=url.pathname.match(/^\/calendar\/api\/(calendars|events)(?:\/([a-f0-9-]{36})(?:\/(delete|occurrence))?)?\/?$/);
   const prefs=url.pathname==='/calendar/api/preferences';
   if(url.pathname!=='/calendar/'&&!route&&!prefs){fail(404,'That calendar page does not exist.');return true;}
   if(!['GET','HEAD','POST'].includes(req.method)){fail(405,'Use the calendar controls.');return true;}
   const member=members&&config?await members.session(read(req,'member')):null;
   if(!member){if(!api&&req.method!=='POST')send(200,calendarPreview());else fail(401,'Sign in to use your private calendar.');return true;}
   if(!store||!await store.ready()){fail(503,'Your calendar is being prepared. Your account and other Gold Trails pages are available.');return true;}
   const owner=member.id,csrf=read(req,'form');
   if(!api){if(req.method==='POST')throw new CalendarError('Use the calendar controls.',405);send(200,calendarPage({member,csrf}));return true;}
   let input=null;
   if(req.method==='POST'){
    if(req.headers.origin!==config.origin)throw new CalendarError('Open the calendar on Gold Trails before saving.',403);
    input=await body(req);
    if(!equal(csrf,input.csrf)||!equal(digest(csrf||''),member.csrf_token_hash))throw new CalendarError('Your sign-in has expired. Sign in again before saving.',403);
    if(!await store.allowWrite(owner))throw new CalendarError('Take a short break before making more changes.',429);
   }
   if(prefs){if(!input)throw new CalendarError('Save display choices from the calendar.',405);await store.savePreferences(owner,preferences(input));send(200,{ok:true});return true;}
   const [,collection,id,action]=route;
   if(id&&!uuid.test(id))throw new CalendarError('That calendar item does not exist.',404);
   if(collection==='calendars'){
    if(action==='occurrence')throw new CalendarError('That calendar control does not exist.',404);
    if(!input){if(id)throw new CalendarError('Use the calendar list.',405);send(200,await store.listCalendars(owner));return true;}
    if(action==='delete'){
     fields(input,['csrf','revision','confirmation']);if(input.confirmation!=='DELETE CALENDAR')throw new CalendarError('Confirm that you want to delete this calendar and its events.');
     await store.deleteCalendar(owner,id,revision(input));send(200,{ok:true});return true;
    }
    fields(input,['csrf','name','color',...(id?['revision']:[])]);
    const data=validateCalendar({name:input.name,color:input.color});
    const calendar=id?await store.saveCalendar(owner,id,{...data,revision:revision(input)}):await store.createCalendar(owner,data);
    send(id?200:201,{calendar});return true;
   }
   if(!input){
    if(id)throw new CalendarError('Choose events from the calendar view.',405);
    const range=validateRange(url.searchParams.get('start'),url.searchParams.get('end'));
    if(!await store.allowRead(owner))throw new CalendarError('Take a short break before loading more date ranges.',429);
    const rows=await store.listEvents(owner,range),events=[];
    const calculated=await expanded(owner,rows,range);
    for(const event of rows){
     const occurrences=calculated.get(event.id)||[];
     for(const occurrence of occurrences)events.push({...occurrence,color:event.color,editable:false,series:series(event)});
     if(events.length>5000)throw new CalendarError('Choose a shorter date range or display fewer calendars.',422);
    }
    events.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
    send(200,{events});return true;
   }
   if(action==='delete'){
    fields(input,['csrf','revision','confirmation']);if(input.confirmation!=='DELETE EVENT')throw new CalendarError('Confirm that you want to delete this event or series.');
    await store.deleteEvent(owner,id,revision(input));send(200,{ok:true});return true;
   }
   if(action==='occurrence'){
    fields(input,['csrf','revision','occurrenceStart','cancelled','override','resetExceptions']);const rev=revision(input);
    const event=await store.loadEvent(owner,id);if(!event)throw new CalendarError('That event does not exist.',404);
    if(event.revision!==rev)throw new CalendarError('This event changed on another screen. Reload before saving.',409);
    if(!event.rrule||typeof input.occurrenceStart!=='string'||!await pool.run('occurrence',{event,occurrenceStart:input.occurrenceStart}))throw new CalendarError('Choose an occurrence of this recurring event.');
    const cancel=input.cancelled===true;
    if(cancel&&input.override!=null||!cancel&&input.cancelled!==false&&input.cancelled!=null)throw new CalendarError('Choose whether to edit or cancel this occurrence.');
    let override=null;
    if(!cancel){fields(input.override,eventFields.filter(k=>k!=='rrule'));override=validateEvent({...input.override,rrule:null});if(override.calendarId!==event.calendarId)throw new CalendarError('Move the entire series to another calendar, or create a separate event.');}
    await store.saveOccurrence(owner,id,{revision:rev,occurrenceStart:input.occurrenceStart,cancelled:cancel,override});send(200,{ok:true});return true;
   }
   fields(input,['csrf',...eventFields,...(id?['revision','resetExceptions']:[])]);
   if(id&&input.resetExceptions!=null&&typeof input.resetExceptions!=='boolean')throw new CalendarError('Confirm whether occurrence edits should be reset.');
   const data=validateEvent(eventInput(input));
   const event=id?await store.saveEvent(owner,id,data,revision(input),{resetExceptions:input.resetExceptions===true}):await store.createEvent(owner,data);
   send(id?200:201,{event});return true;
  }catch(e){if(e instanceof CalendarError)fail(e.status,e.message);else{log('Gold Trails calendar request unavailable');fail(503,'The calendar is temporarily unavailable. Reload to check your saved changes.');}return true;}
 };
 handler.close=()=>{expansions.clear();return pool.close();};
 return handler;
}
