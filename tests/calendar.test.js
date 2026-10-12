import test from 'node:test';
import assert from 'node:assert/strict';
import {digest} from '../app/admin-auth.js';
import {createServer} from '../app/server.js';
import {createCalendarHandler} from '../app/calendar/handler.js';
import {calendarMemoryStore} from './helpers/calendar-memory.js';
const csrf='a'.repeat(64),alice='b'.repeat(64),bob='c'.repeat(64),origin='https://gold.example';
async function fixture(t,{store=calendarMemoryStore(),config={origin}}={}){
 const sessions=new Map([[alice,{id:'alice',username:'Alice',effective_level:'free',csrf_token_hash:digest(csrf)}],[bob,{id:'bob',username:'Bob',effective_level:'subscriber',csrf_token_hash:digest(csrf)}]]);
 const server=createServer({calendar:createCalendarHandler({members:{session:async raw=>sessions.get(raw)},store,config,log:()=>{}})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path,input,session=alice,headers={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{redirect:'manual',headers:{Cookie:`__Host-gold-member=${session}; __Host-gold-form=${csrf}`,...(input?{Origin:origin,'Content-Type':'application/json'}:{}),...headers},...(input?{method:'POST',body:JSON.stringify({csrf,...input})}:{})});
 const newCalendar=async(name='Personal',session=alice)=>{const r=await request('/calendar/api/calendars',{name,color:'#785434'},session);assert.equal(r.status,201);return (await r.json()).calendar;};
 return {store,request,newCalendar};
}
const event=calendarId=>({calendarId,title:'Private appointment',description:'Private notes',location:'At the field desk',startLocal:'2026-10-18T09:00',endLocal:'2026-10-18T10:00',timeZone:'America/New_York',allDay:false,rrule:null});
const range='/calendar/api/events?start=2026-10-01T00:00:00Z&end=2026-11-01T00:00:00Z';

test('free and subscriber members create persistent calendars and events; appointments are strictly isolated',async t=>{
 const {request,newCalendar}=await fixture(t);const a=await newCalendar();const b=await newCalendar('Bob private',bob);
 let r=await request('/calendar/api/events',event(a.id));assert.equal(r.status,201);const created=(await r.json()).event;
 r=await request(range);assert.equal((await r.json()).events[0].title,'Private appointment');
 assert.deepEqual((await (await request(range,null,bob)).json()).events,[]);
 assert.equal((await request('/calendar/api/events/'+created.id,{...event(b.id),revision:1},bob)).status,404);
 assert.equal((await request('/calendar/api/events/'+created.id+'/delete',{revision:1,confirmation:'DELETE EVENT'},bob)).status,404);
 assert.equal((await request('/calendar/api/events',event(b.id))).status,404);
 assert.equal((await request('/calendar/api/calendars/'+a.id+'/delete',{revision:1,confirmation:'DELETE CALENDAR'},bob)).status,404);
 assert.equal((await request('/calendar/api/preferences',{view:'listMonth',timeZone:'America/New_York',visibleCalendarIds:[a.id]},bob)).status,404);
 assert.equal((await request('/calendar/api/events/'+created.id,{...event(a.id),title:'Edited appointment',revision:1})).status,200);
 assert.equal((await request('/calendar/api/events/'+created.id,{...event(a.id),revision:1})).status,409);
 assert.equal((await request('/calendar/api/events/'+created.id+'/delete',{revision:2,confirmation:'DELETE EVENT'})).status,200);
 assert.deepEqual((await (await request(range)).json()).events,[]);
});
test('all writes require validated session, exact origin and session-bound CSRF; owner spoofing is rejected',async t=>{
 const {request,store}=await fixture(t);
 assert.equal((await request('/calendar/api/calendars',{name:'Invalid',color:'#785434'},'0'.repeat(64))).status,401);
 assert.equal((await request('/calendar/api/calendars',{name:'Invalid',color:'#785434'},alice,{Origin:'https://evil.example'})).status,403);
 assert.equal((await request('/calendar/api/calendars',{csrf:'d'.repeat(64),name:'Invalid',color:'#785434'})).status,403);
 assert.equal((await request('/calendar/api/calendars',{name:'Invalid',color:'#785434',ownerId:'bob'})).status,400);
 assert.equal(store.calendars.size,0);
 assert.equal((await request('/calendar/api/events?start=bad&end=bad')).status,400);
 assert.equal((await request('/calendar/api/events?start=2026-01-01T00:00:00Z&end=2027-01-01T00:00:00Z')).status,400);
 const publicPage=await request('/calendar/',null,'0'.repeat(64));assert.equal(publicPage.status,200);assert.match(await publicPage.text(),/sign in|Sign in/);
});
test('display preferences persist per member and independently hide calendars without deleting their events',async t=>{
 const {request,newCalendar,store}=await fixture(t);const a=await newCalendar(),b=await newCalendar('Prospecting Trips');
 await request('/calendar/api/events',event(a.id));await request('/calendar/api/events',{...event(b.id),title:'Trip'});
 assert.equal((await (await request(range)).json()).events.length,2);
 assert.equal((await request('/calendar/api/preferences',{view:'listMonth',timeZone:'Europe/London',visibleCalendarIds:[b.id]})).status,200);
 const data=await (await request('/calendar/api/calendars')).json();assert.equal(data.preferences.view,'listMonth');assert.equal(data.calendars.find(c=>c.id===a.id).visible,false);
 assert.deepEqual((await (await request(range)).json()).events.map(e=>e.title),['Trip']);assert.equal(store.events.size,2);
 assert.equal((await (await request('/calendar/api/calendars',null,bob)).json()).preferences.view,'dayGridMonth');
});
test('recurring occurrences support edits, cancellation, revision conflicts and explicit schedule-reset consent',async t=>{
 const {request,newCalendar}=await fixture(t);const c=await newCalendar();
 let r=await request('/calendar/api/events',{...event(c.id),rrule:'FREQ=WEEKLY;COUNT=3'});const created=(await r.json()).event;
 let rows=(await (await request(range)).json()).events;assert.equal(rows.length,2);assert.equal(rows[0].start,'2026-10-18T13:00:00.000Z');
 assert.equal((await request('/calendar/api/events/'+created.id+'/occurrence',{revision:1,occurrenceStart:'2026-10-25T09:00',cancelled:true})).status,200);
 assert.equal((await request('/calendar/api/events/'+created.id+'/occurrence',{revision:2,occurrenceStart:'2026-10-19T09:00',cancelled:true})).status,400);
 const override={...event(c.id),title:'One changed appointment',startLocal:'2026-10-19T11:00',endLocal:'2026-10-19T12:00'};delete override.rrule;
 assert.equal((await request('/calendar/api/events/'+created.id+'/occurrence',{revision:2,occurrenceStart:'2026-10-18T09:00',cancelled:false,override})).status,200);
 rows=(await (await request(range)).json()).events;assert.equal(rows.length,1);assert.equal(rows[0].title,'One changed appointment');assert.equal(rows[0].occurrenceStart,'2026-10-18T09:00');
 assert.equal((await request('/calendar/api/events/'+created.id,{...event(c.id),rrule:'FREQ=DAILY;COUNT=3',revision:3})).status,409);
 assert.equal((await request('/calendar/api/events/'+created.id,{...event(c.id),rrule:'FREQ=DAILY;COUNT=3',revision:3,resetExceptions:true})).status,200);
 assert.equal((await (await request(range)).json()).events.length,3);
});
test('private responses block caching and framing; missing migration and rate limits fail safely',async t=>{
 const {request}=await fixture(t);const r=await request('/calendar/');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.doesNotMatch(r.headers.get('content-security-policy'),/script-src[^;]*unsafe-inline/);
 const unavailable=await fixture(t,{store:{ready:async()=>false}});assert.equal((await unavailable.request('/calendar/api/calendars')).status,503);
 const s=calendarMemoryStore();s.allowWrite=async()=>false;const limited=await fixture(t,{store:s});assert.equal((await limited.request('/calendar/api/calendars',{name:'Personal',color:'#785434'})).status,429);assert.equal(s.calendars.size,0);
 const reads=calendarMemoryStore();reads.allowRead=async()=>false;reads.listEvents=async()=>{throw Error('A throttled request must not load or expand events');};const readLimited=await fixture(t,{store:reads});assert.equal((await readLimited.request(range)).status,429);assert.equal((await readLimited.request('/calendar/api/calendars')).status,200);
});
test('destructive actions need confirmation and calendars delete only their own contained events',async t=>{
 const {request,newCalendar,store}=await fixture(t);const a=await newCalendar(),b=await newCalendar('Trips');await request('/calendar/api/events',event(a.id));await request('/calendar/api/events',event(b.id));
 assert.equal((await request('/calendar/api/calendars/'+a.id+'/delete',{revision:1})).status,400);
 assert.equal((await request('/calendar/api/calendars/'+a.id+'/delete',{revision:1,confirmation:'DELETE CALENDAR'})).status,200);
 assert.equal(store.events.size,1);assert.equal((await (await request(range)).json()).events[0].calendarId,b.id);
});
