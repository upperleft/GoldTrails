import {processEventPhoto} from '../app/connections/photos.js';
import sharp from 'sharp';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {meetingVault,validateEvent,eventUrl} from '../app/connections/model.js';
import {memoryConnections,accounts,tokens,csrf,fixtureInput} from '../scripts/fixtures/connections-memory.mjs';
const event='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',origin='https://goldtrails.test';
const creatorToken='e'.repeat(64),expiredToken='9'.repeat(64);
async function setup(t,{seed=true}={}){const vault=meetingVault('ab'.repeat(32)),store=memoryConnections({vault,seed}),members={session:async raw=>raw===creatorToken?{...accounts.member,grant_source:'complimentary'}:raw===expiredToken?{...accounts.organizer,effective_level:'free'}:accounts[Object.keys(tokens).find(k=>tokens[k]===raw)]||null},connections=createConnectionsHandler({store,members,processPhoto:processEventPhoto,owners:{session:async raw=>raw==='d'.repeat(64)?{authenticated:1,csrf_token:csrf}:null},config:{origin},vault,calendarStore:{ready:async()=>true},log:()=>{}}),server=createServer({connections,goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const request=async(path,{role='',post=null,headers={},owner=false}={})=>fetch(base+path,{redirect:'manual',method:post?'POST':'GET',headers:{...(owner?{Cookie:'__Host-gold-admin='+'d'.repeat(64)}:{}),...(role?{Cookie:'__Host-gold-member='+(role==='creator'?creatorToken:role==='expired'?expiredToken:tokens[role])+'; __Host-gold-form='+csrf}:{}),...(post?{'Content-Type':'application/x-www-form-urlencoded',Origin:origin}:{}),...headers},...(post?{body:new URLSearchParams({csrf,...post})}:{})});return{store,request,base};}
test('public discovery exposes all state groups and public details without emails, exact locations or meeting credentials',async t=>{const {request}=await setup(t);const groups=await(await request('/connections/states/')).text();assert.equal((groups.match(/href="\/connections\/states\/[a-z-]+\/"/g)||[]).length,50);const response=await request(eventUrl(event)),html=await response.text();assert.equal(response.status,200);for(const value of ['PRIVATE TEST ADDRESS','PRIVATE TEST PASSCODE','example.zoom.us','private-member-email'])assert.ok(!html.includes(value),value);assert.match(html,/Exact address and map/);for(const state of ['massachusetts','alaska','hawaii'])assert.equal((await request('/connections/states/'+state+'/')).status,200);assert.equal((await request('/connections/states/district-of-columbia/')).status,404);assert.equal((await request('/connections/coverage/?state=MA&range=1')).status,200);});
test('create, RSVP and discussion actions require active Plus, current CSRF and same-origin requests',async t=>{const {request,store}=await setup(t);assert.equal((await request('/connections/new/')).status,401);assert.equal((await request('/connections/new/',{role:'free'})).status,403);assert.equal((await request('/connections/new/',{role:'member'})).status,200);assert.equal((await request(eventUrl(event)+'rsvp/',{role:'free',post:{action:'yes'}})).status,403);assert.equal((await request(eventUrl(event)+'rsvp/',{role:'member',post:{action:'yes'},headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await request(eventUrl(event)+'rsvp/',{role:'member',post:{action:'yes',csrf:'0'.repeat(64)}})).status,403);assert.equal(store.rsvps.size,0);const response=await request('/connections/new/',{role:'member',post:{...fixtureInput(),waitlist:'yes',title:'Created by a member',organizerId:accounts.organizer.id}});assert.equal(response.status,303);const id=response.headers.get('location').split('/')[3];assert.equal((await store.get(id)).organizerId,accounts.member.id);});
test('draft and Plus-only events cannot leak through detail, discovery or calendar exports',async t=>{const{request,store}=await setup(t);const ids=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),visibility:'plus'})),draft=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),status:'draft'}));for(const suffix of ['', 'calendar.ics'])assert.equal((await request(eventUrl(ids[0])+suffix)).status,403);assert.equal((await request(eventUrl(draft[0]))).status,404);const listing=await(await request('/connections/')).text();assert.ok(!listing.includes(eventUrl(ids[0])));assert.ok(!listing.includes(eventUrl(draft[0])));assert.equal((await request(eventUrl(ids[0]),{role:'member'})).status,200);});
test('only confirmed Plus attendees or organizer can retrieve private meeting and address details',async t=>{const{request}=await setup(t);let html=await(await request(eventUrl(event),{role:'member'})).text();assert.ok(!html.includes('PRIVATE TEST PASSCODE'));assert.equal((await request(eventUrl(event)+'rsvp/',{role:'member',post:{action:'yes'}})).status,303);html=await(await request(eventUrl(event),{role:'member'})).text();assert.ok(html.includes('PRIVATE TEST PASSCODE'));assert.ok(html.includes('PRIVATE TEST ADDRESS'));assert.equal((await request(eventUrl(event)+'rsvp/',{role:'member',post:{action:'cancel'}})).status,303);html=await(await request(eventUrl(event),{role:'member'})).text();assert.ok(!html.includes('PRIVATE TEST PASSCODE'));assert.ok((await(await request(eventUrl(event),{role:'organizer'})).text()).includes('PRIVATE TEST PASSCODE'));});
test('organizers cannot edit or inspect attendees for other members’ events',async t=>{const{request}=await setup(t);for(const suffix of ['edit/','manage/'])assert.equal((await request(eventUrl(event)+suffix,{role:'member'})).status,404);assert.equal((await request(eventUrl(event)+'cancel/',{role:'member',post:{confirmation:'CANCEL EVENT',revision:1}})).status,404);assert.equal((await request(eventUrl(event)+'manage/',{role:'organizer'})).status,200);});
test('duplicate RSVPs do not consume more spaces; cancellation promotes the next waitlisted participant',async t=>{const{request,store}=await setup(t);store.events.get(event).capacity=1;await request(eventUrl(event)+'rsvp/',{role:'organizer',post:{action:'yes'}});await request(eventUrl(event)+'rsvp/',{role:'organizer',post:{action:'yes'}});assert.equal((await store.get(event)).yesCount,1);await request(eventUrl(event)+'rsvp/',{role:'member',post:{action:'yes'}});assert.equal((await store.participation(accounts.member.id,event)).status,'waitlisted');assert.ok(!(await(await request(eventUrl(event),{role:'member'})).text()).includes('PRIVATE TEST PASSCODE'));await request(eventUrl(event)+'rsvp/',{role:'organizer',post:{action:'cancel'}});assert.equal((await store.participation(accounts.member.id,event)).status,'yes');assert.equal((await store.get(event)).yesCount,1);});
test('comment ownership, attendance verification and cancellation are enforced',async t=>{const{request,store}=await setup(t);await request(eventUrl(event)+'comments/',{role:'member',post:{body:'<script>alert(1)</script> Hello',kind:'comment'}});let html=await(await request(eventUrl(event))).text();assert.ok(!html.includes('<script>alert(1)</script>'));const comment=[...store.commentRows.values()][0];assert.equal((await request(eventUrl(event)+'comments/'+comment.id+'/',{role:'organizer',post:{body:'Spoof',revision:1,action:'edit'}})).status,404);assert.equal((await request(eventUrl(event)+'attendance/',{role:'organizer',post:{accountId:accounts.member.id,attended:'yes'}})).status,409);await request(eventUrl(event)+'cancel/',{role:'organizer',post:{revision:1,confirmation:'CANCEL EVENT'}});assert.equal((await request(eventUrl(event)+'rsvp/',{role:'member',post:{action:'yes'}})).status,409);});
test('preferences default off and free accounts may opt out; calendar copies require Plus and stay idempotent',async t=>{
 const {request,store}=await setup(t),detail=eventUrl(event),copyPath=detail+'calendar/';
 assert.deepEqual((await store.preferences(accounts.member.id)).states,[]);
 assert.equal((await request('/connections/preferences/',{role:'member',post:{states:'MA',new_events:'yes'}})).status,303);
 assert.equal((await store.preferences(accounts.member.id)).new_events,true);
 assert.equal((await request('/connections/preferences/',{role:'free',post:{}})).status,303);
 assert.equal((await request('/connections/preferences/',{role:'free',post:{states:'MA'}})).status,403);
 const free=await request(detail,{role:'free'});assert.equal(free.status,200);
 assert.doesNotMatch(await free.text(),/Add to my Gold Trails calendar/);
 assert.equal((await request(copyPath,{post:{}})).status,401);
 assert.equal((await request(copyPath,{role:'free',post:{}})).status,403);
 assert.equal(store.calendarCopies.size,0);
 for(const role of ['member','creator']){
  const plus=await request(detail,{role});assert.match(await plus.text(),/Add to my Gold Trails calendar/);
  assert.equal((await request(copyPath,{role,post:{}})).status,303);
 }
 assert.equal(store.calendarCopies.size,1);
 const ics=await(await request(detail+'calendar.ics')).text();assert.match(ics,/BEGIN:VCALENDAR/);assert.ok(!ics.includes('PRIVATE TEST'));
});
test('owner review is private, uses owner CSRF, and can suppress a reported event',async t=>{const{request}=await setup(t);assert.equal((await request('/connections/moderation/')).status,401);await request(eventUrl(event)+'report/',{role:'member',post:{targetType:'event',targetId:event,reason:'Test report for owner review'}});const queue=await(await request('/connections/moderation/',{owner:true})).text();assert.match(queue,/Test report for owner review/);assert.equal((await request('/connections/moderation/',{owner:true,post:{csrf:'0'.repeat(64),eventId:event,targetId:event,targetType:'event',action:'hide'}})).status,403);assert.equal((await request('/connections/moderation/',{owner:true,post:{eventId:event,targetId:event,targetType:'event',action:'hide'}})).status,303);assert.equal((await request(eventUrl(event))).status,404);});
test('binary photo route authorizes organizer, decodes the image and controls later visibility',async t=>{const{base,store,request}=await setup(t);const png=await sharp({create:{width:50,height:30,channels:3,background:'#cda845'}}).png().toBuffer();const upload=role=>fetch(base+eventUrl(event)+'photos/',{method:'POST',headers:{Origin:origin,Cookie:'__Host-gold-member='+tokens[role]+'; __Host-gold-form='+csrf,'Content-Type':'image/png','X-Connections-CSRF':csrf,'X-Photo-Kind':'cover','X-Photo-Caption':'Local%20test%20image'},body:png});assert.equal((await upload('member')).status,403);assert.equal((await upload('organizer')).status,201);assert.ok((await(await request(eventUrl(event))).text()).includes("Local test image</figcaption>"));const p=[...store.photoRows.values()][0],response=await request('/connections/photos/'+p.id+'/');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');const image=await response.arrayBuffer();assert.equal((await sharp(Buffer.from(image)).metadata()).format,'jpeg');await request(eventUrl(event)+'photos/'+p.id+'/',{role:'organizer',post:{}});assert.equal((await request('/connections/photos/'+p.id+'/')).status,404);});
test('homepage shows a small selection of real repository events, and calendar month filtering is explicit',async t=>{const{request}=await setup(t);const home=await(await request('/')).text();assert.match(home,/Let’s meet up!/);assert.match(home,/LOCAL TEST · Panning together/);const calendar=await(await request('/connections/?view=calendar&month=2027-06')).text();assert.match(calendar,/connections-month/);assert.match(calendar,/June 2027/);assert.match(calendar,/LOCAL TEST · Panning together/);});

test('an empty Connections directory exposes Create before filters for paid and complimentary Plus members',async t=>{
 const {request,store}=await setup(t,{seed:false});
 for(const role of ['member','creator']){
  const response=await request('/connections/?state=MA',{role});assert.equal(response.status,200);const html=await response.text();
  const navigation=html.match(/<div class="connections-navigation">[\s\S]*?<\/details><\/div><\/div>/)?.[0]||'';
  assert.match(navigation,/<a class="gold-button connections-create-event" href="\/connections\/new\/\?state=MA">Create an event<\/a>/);
  assert.ok(html.indexOf('connections-create-event')<html.indexOf('class="connections-search"'));
  const personal=navigation.match(/<details\b[\s\S]*?<\/details>/)?.[0]||'';
  assert.doesNotMatch(personal,/href="\/connections\/new\//,'Create is not hidden in the personal-tools disclosure');
  assert.match(html,/Have a gathering in mind\?/);assert.match(html,/includes creating events/);
  if(role==='creator')assert.match(html,/Your complimentary Plus membership/);
  const form=await request('/connections/new/?state=MA',{role});assert.equal(form.status,200);const formHtml=await form.text();
  assert.match(formHtml,/action="\/connections\/new\/"/);assert.match(formHtml,/name="title"/);
  assert.doesNotMatch(formHtml,/action="\/calendar\//);
  const created=await request('/connections/new/',{role,post:{...fixtureInput(),status:'draft',title:'Local '+role+' test gathering'}});
  assert.equal(created.status,303);assert.match(created.headers.get('location'),/^\/connections\/events\/[a-f0-9-]{36}\/manage\/$/);
 }
 assert.equal(store.events.size,2);assert.equal(store.rsvps.size,0);
});

test('anonymous and free Connections visitors receive clear sign-in or Plus paths instead of unusable creation controls',async t=>{
 const {request}=await setup(t,{seed:false});
 const anonymous=await request('/connections/'),anonymousHtml=await anonymous.text();assert.equal(anonymous.status,200);
 assert.match(anonymousHtml,/href="\/login\/\?next=%2Fconnections%2Fnew%2F">Sign in to create an event/);
 assert.doesNotMatch(anonymousHtml,/connections-create-event|href="\/connections\/new\//);
 const free=await request('/connections/',{role:'free'}),freeHtml=await free.text();assert.equal(free.status,200);
 assert.match(freeHtml,/Your free account can browse public events/);assert.match(freeHtml,/href="\/plus\/">Learn about Plus event creation/);
 assert.doesNotMatch(freeHtml,/connections-create-event|href="\/connections\/new\//);
 assert.equal((await request('/connections/new/')).status,401);assert.equal((await request('/connections/new/',{role:'free'})).status,403);
});

test('published public event pages expose a canonical share link without private details or request-host influence',async t=>{
 const {request}=await setup(t);
 for(const role of ['','free','member','creator','organizer']){
  const response=await request(eventUrl(event)+'?token=private-query-value',{role,headers:{Host:'untrusted.example'}});assert.equal(response.status,200);
  const html=await response.text(),share=html.match(/<section\b[^>]*data-event-share[\s\S]*?<\/section>/)?.[0]||'';
  assert.match(share,/Share this public event/);assert.ok(share.includes('value="'+origin+eventUrl(event)+'"'));
  assert.match(share,/\breadonly\b[^>]*data-event-share-url/);assert.match(share,/type="button" data-event-share-copy hidden/);
  for(const value of ['untrusted.example','private-query-value','PRIVATE TEST ADDRESS','PRIVATE TEST PASSCODE','example.zoom.us'])assert.ok(!share.includes(value),value);
 }
 const manage=await request(eventUrl(event)+'manage/',{role:'organizer'});assert.equal(manage.status,200);const html=await manage.text();
 assert.match(html,/data-event-share/);assert.ok(html.includes('href="'+eventUrl(event)+'edit/"'));
});

test('draft, Plus-only, cancelled and moderated events never expose public sharing controls',async t=>{
 const {request,store}=await setup(t);
 for(const variant of [{status:'draft'},{visibility:'plus'}]){
  const [id]=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),...variant}));
  for(const suffix of ['', 'manage/']){
   const response=await request(eventUrl(id)+suffix,{role:'organizer'});assert.equal(response.status,200);
   assert.doesNotMatch(await response.text(),/data-event-share|Public event link/);
  }
 }
 for(const variant of [{status:'cancelled',moderated:false},{status:'published',moderated:true}]){
  Object.assign(store.events.get(event),variant);
  for(const suffix of ['', 'manage/']){
   const response=await request(eventUrl(event)+suffix,{role:'organizer'});assert.equal(response.status,200);
   assert.doesNotMatch(await response.text(),/data-event-share|Public event link/);
  }
 }
 assert.equal((await request(eventUrl(event))).status,404);
});

test('an organizer without active Plus retains management but does not receive editing or duplicate-event links',async t=>{
 const {request}=await setup(t);
 const response=await request(eventUrl(event)+'manage/',{role:'expired'});assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/Editing and duplicating events require Gold Trails Plus/);assert.match(html,/Cancel this event/);
 assert.doesNotMatch(html,/href="\/connections\/events\/[a-f0-9-]+\/edit\/"|href="\/connections\/new\//);
 assert.equal((await request(eventUrl(event)+'edit/',{role:'expired'})).status,403);
});

test('only entitled organizers receive draft or restricted-event instructions to publish a public share link',async t=>{
 const {request,store}=await setup(t);
 for(const variant of [{status:'draft'},{visibility:'plus'}]){
  const [id]=await store.create(accounts.organizer.id,validateEvent({...fixtureInput(),...variant}));
  const response=await request(eventUrl(id)+'manage/',{role:'organizer'});assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/Get a public event link/);assert.match(html,/Anyone—public event/);assert.match(html,/<strong>Publish<\/strong> under Save as/);
  assert.match(html,/then save to get a link anyone can open/);assert.doesNotMatch(html,/data-event-share/);
  const editHref='href="'+eventUrl(id)+'edit/"';assert.equal(html.split(editHref).length-1,1);
  assert.ok(html.includes(editHref+'>Edit and publish</a>'));
  for(const [role,suffix] of [['member','manage/'],['',''],['expired','manage/']]){
   const other=await request(eventUrl(id)+suffix,{role});assert.doesNotMatch(await other.text(),/connections-publication-note|Edit and publish/);
  }
 }
 for(const variant of [{status:'cancelled',moderated:false},{status:'published',moderated:true}]){
  Object.assign(store.events.get(event),variant);
  const response=await request(eventUrl(event)+'manage/',{role:'organizer'});assert.equal(response.status,200);
  assert.doesNotMatch(await response.text(),/connections-publication-note|Edit and publish|data-event-share/);
 }
});
