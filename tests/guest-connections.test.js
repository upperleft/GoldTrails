import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {createConnectionsStore} from '../app/connections/store.js';
import {meetingVault,validateEvent,eventUrl,publicEvent} from '../app/connections/model.js';
import {memoryConnections,accounts,tokens,csrf,fixtureInput} from '../scripts/fixtures/connections-memory.mjs';

const origin='https://goldtrails.test',grant={id:'guest-fixture',label:'Friends tour',expiresAt:'2027-01-01T00:00:00.000Z'};
async function setup(t){
 const vault=meetingVault('ab'.repeat(32)),store=memoryConnections({vault,seed:false});
 const [plusId]=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),title:'PLUS FIXTURE · Panning together',visibility:'plus'}));
 const [draftId]=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),title:'PRIVATE DRAFT TITLE',visibility:'plus',status:'draft'}));
 const [hiddenId]=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),title:'PRIVATE MODERATED TITLE',visibility:'plus'}));store.events.get(hiddenId).moderated=true;
 const photoId=await store.addPhoto(accounts.organizer.id,plusId,'cover','Fixture cover',Buffer.from('jpeg-fixture'));
 const draftPhoto=await store.addPhoto(accounts.organizer.id,draftId,'cover','Private draft photo',Buffer.from('private-image'));
 const hiddenPhoto=await store.addPhoto(accounts.organizer.id,hiddenId,'cover','Private moderated photo',Buffer.from('private-image'));
 await store.comment(accounts.organizer.id,plusId,'An event conversation guests can read.','comment');
 // The memory fixture predates read grants. Keep identity unchanged and implement
 // only its query projection; the production SQL visibility predicate is tested below.
 const originalList=store.list.bind(store),listCalls=[];
 store.list=async(filters,member,options={})=>{
  listCalls.push({member,options});if(!options.canReadPlus)return originalList(filters,member);
  const events=[];for(const event of store.events.values()){
   if(event.moderated||!['published','cancelled'].includes(event.status)||filters.state&&event.state!==filters.state)continue;
   if(filters.q&&!`${event.title} ${event.description}`.toLowerCase().includes(filters.q.toLowerCase()))continue;
   if(filters.period==='past'?Date.parse(event.endUtc)>=Date.now():Date.parse(event.endUtc)<Date.now())continue;
   events.push(publicEvent(await store.get(event.id)));
  }
  return {events,hasMore:false};
 };
 const guests={read:req=>['GET','HEAD'].includes(req.method)&&/(?:^|; )guest=valid(?:;|$)/.test(req.headers.cookie||'')?grant:null};
 const members={session:async raw=>accounts[Object.keys(tokens).find(k=>tokens[k]===raw)]||null};
 const connections=createConnectionsHandler({store,members,guests,vault,config:{origin},calendarStore:{ready:async()=>true},log:()=>{}});
 const server=createServer({connections,goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(path,{guest=true,role='',post=null,method=null,headers={}}={})=>fetch(base+path,{redirect:'manual',method:method||(post?'POST':'GET'),headers:{Cookie:[guest?'guest=valid':'',role?'__Host-gold-member='+tokens[role]+'; __Host-gold-form='+csrf:''].filter(Boolean).join('; '),...(post?{'Content-Type':'application/x-www-form-urlencoded',Origin:origin}:{}),...headers},...(post?{body:new URLSearchParams({csrf,...post})}:{})});
 return {request,base,store,listCalls,plusId,draftId,hiddenId,photoId,draftPhoto,hiddenPhoto};
}

test('guest read grants reveal Plus listings, details, photos and redacted ICS without inventing a member',async t=>{
 const {request,listCalls,plusId,photoId}=await setup(t),path=eventUrl(plusId);
 for(const location of ['/connections/','/connections/states/massachusetts/']){
  const response=await request(location),html=await response.text();assert.equal(response.status,200);assert.match(html,/PLUS FIXTURE/);assert.match(html,/Welcome to your Plus guest tour/);assert.doesNotMatch(html,/PRIVATE DRAFT TITLE|PRIVATE MODERATED TITLE|connections-invite/);
  for(const href of ['/connections/mine/','/connections/preferences/','/connections/new/'])assert.ok(!html.includes('href="'+href+'"'),href);
 }
 assert.ok(listCalls.every(call=>call.member===null&&call.options.canReadPlus===true));
 const detail=await request(path),html=await detail.text();assert.equal(detail.status,200);assert.match(detail.headers.get('cache-control'),/private, no-store/);assert.equal(detail.headers.get('vary'),'Cookie');assert.match(html,/event conversation guests can read/);assert.match(html,/Fixture cover/);assert.match(html,/RSVPing, and posting comments require your own/);assert.doesNotMatch(html,/<form method="post"|PRIVATE TEST ADDRESS|PRIVATE TEST PASSCODE|example\.zoom\.us|Manage your event|Your RSVP/);
 const image=await request('/connections/photos/'+photoId+'/');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');assert.equal(await image.text(),'jpeg-fixture');
 const ics=await request(path+'calendar.ics');assert.equal(ics.status,200);const calendar=await ics.text();assert.match(calendar,/BEGIN:VCALENDAR/);assert.doesNotMatch(calendar,/PRIVATE TEST|example\.zoom\.us/);
 const head=await request(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('ordinary visitors and free members remain outside Plus event reading',async t=>{
 const {request,plusId,photoId}=await setup(t);
 for(const role of ['','free']){
  const options={guest:false,role};assert.equal((await request(eventUrl(plusId),options)).status,403);assert.equal((await request(eventUrl(plusId)+'calendar.ics',options)).status,403);assert.equal((await request('/connections/photos/'+photoId+'/',options)).status,404);
  assert.doesNotMatch(await(await request('/connections/',options)).text(),/PLUS FIXTURE/);
 }
});

test('guest tours never reveal drafts, moderated events, organizer tools or attendee details',async t=>{
 const {request,plusId,draftId,hiddenId,draftPhoto,hiddenPhoto}=await setup(t);
 for(const role of ['','free']){
  for(const id of [draftId,hiddenId])for(const suffix of ['','calendar.ics','edit/','manage/'])assert.equal((await request(eventUrl(id)+suffix,{role})).status,404);
  for(const id of [draftPhoto,hiddenPhoto])assert.equal((await request('/connections/photos/'+id+'/',{role})).status,404);
  for(const suffix of ['edit/','manage/'])assert.equal((await request(eventUrl(plusId)+suffix,{role})).status,403);
  for(const suffix of ['attendance/','remove-attendee/','rsvp/','comments/','report/','moderate/','cancel/','calendar/','photos/']){
   const response=await request(eventUrl(plusId)+suffix,{role});assert.ok(response.status>=400&&response.status<500,suffix);assert.doesNotMatch(await response.text(),/PRIVATE TEST|Attendees<\/h2>|Your meeting details/);
  }
  assert.equal((await request('/connections/moderation/',{role})).status,401);
  for(const page of ['new','mine','preferences']){
   const response=await request('/connections/'+page+'/',{role}),html=await response.text();assert.equal(response.status,200);assert.match(html,/need your own Gold Trails account/);assert.doesNotMatch(html,/<form method="post"|PRIVATE TEST|My waitlists|Attendees<\/h2>/);
  }
 }
});

test('guest plus a free account grants no event creation, RSVP, discussion or upload rights',async t=>{
 const {request,base,store,plusId}=await setup(t),path=eventUrl(plusId),eventCount=store.events.size;
 for(const role of ['','free']){
  for(const [location,post] of [['/connections/new/',fixtureInput()],[path+'rsvp/',{action:'yes'}],[path+'comments/',{body:'Not allowed',kind:'comment'}]])assert.equal((await request(location,{role,post})).status,!role&&location==='/connections/new/'?401:403);
  const upload=await fetch(base+path+'photos/',{method:'POST',headers:{Origin:origin,Cookie:'guest=valid'+(role?'; __Host-gold-member='+tokens[role]+'; __Host-gold-form='+csrf:''),'Content-Type':'image/png','X-Connections-CSRF':csrf,'X-Photo-Kind':'cover','X-Photo-Caption':'Not allowed'},body:Buffer.from('not-an-image')});assert.equal(upload.status,403);
 }
 assert.equal(store.events.size,eventCount);assert.equal(store.rsvps.size,0);assert.equal(store.commentRows.size,1);
});

test('a real paid member with a guest cookie retains normal controls, RSVP and confirmed attendee details',async t=>{
 const {request,plusId}=await setup(t),path=eventUrl(plusId);
 let html=await(await request(path,{role:'member'})).text();assert.match(html,/RSVP Yes/);assert.match(html,/Create an event · Plus/);assert.doesNotMatch(html,/Welcome to your Plus guest tour|PRIVATE TEST PASSCODE/);
 assert.equal((await request(path+'rsvp/',{role:'member',post:{action:'yes'}})).status,303);
 html=await(await request(path,{role:'member'})).text();assert.match(html,/PRIVATE TEST ADDRESS|PRIVATE TEST PASSCODE/);assert.match(html,/Cancel my RSVP/);
 assert.equal((await request(path+'comments/',{role:'member',post:{body:'A real member comment',kind:'comment'}})).status,303);
 assert.equal((await request(path+'manage/',{role:'organizer'})).status,200);
});

test('production list query accepts a read capability separately while always filtering drafts and moderated content',async()=>{
 const queries=[],store=createConnectionsStore({query:async(sql,values)=>{queries.push({sql,values});return [];}});
 await store.list({},null);assert.match(queries.at(-1).sql,/e\.visibility='public'/);
 await store.list({},accounts.free,{canReadPlus:true});assert.doesNotMatch(queries.at(-1).sql,/e\.visibility='public'/);assert.match(queries.at(-1).sql,/e\.moderated=0/);assert.match(queries.at(-1).sql,/e\.status IN\('published','cancelled'\)/);
 await store.list({},accounts.free,{canReadPlus:false});assert.match(queries.at(-1).sql,/e\.visibility='public'/);
 await store.list({},accounts.member);assert.doesNotMatch(queries.at(-1).sql,/e\.visibility='public'/);
});
