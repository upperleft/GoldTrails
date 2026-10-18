import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryPage,groupsPage,nav} from '../app/connections/views.js';
import {eventFilters,stateFor,meetingVault} from '../app/connections/model.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {createServer} from '../app/server.js';
import {memoryConnections,accounts,tokens} from '../scripts/fixtures/connections-memory.mjs';

const filters=query=>eventFilters(new URLSearchParams(query));
const empty={events:[],hasMore:false};
const grant={id:'test-tour',expiresAt:'2026-11-01T00:00:00Z'};
const center=html=>html.match(/<div class="connections">([\s\S]*?)<\/div><\/div><\/div><\/main>/)?.[1]||html;
const hrefs=html=>[...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
const personalPaths=links=>links.filter(h=>/^\/connections\/(?:mine|preferences|new)\//.test(h));

test('browsing remains primary while only active Plus members get collapsed personal shortcuts',()=>{
 for(const options of [{},{member:accounts.free},{member:{level:'subscriber'}},{guest:grant},{guest:grant,member:accounts.free}]){
  const html=nav(options);assert.match(html,/All events/);assert.match(html,/50 state groups/);
  assert.equal(personalPaths(hrefs(html)).length,0);assert.doesNotMatch(html,/connections-personal/);
 }
 const paid=nav({member:accounts.member,state:stateFor('MA')});
 assert.match(paid,/<details class="connections-personal"><summary>Your events &amp; preferences<\/summary>/);
 assert.doesNotMatch(paid,/<details[^>]*\bopen\b/);
 assert.ok(paid.indexOf('All events')<paid.indexOf('My events &amp; RSVPs'));
 for(const path of ['/connections/mine/','/connections/preferences/?state=MA','/connections/new/?state=MA'])assert.ok(hrefs(paid).includes(path),path);
});

test('directory purpose precedes filters without a second state introduction panel',()=>{
 const html=directoryPage(filters(),empty,{member:accounts.member});
 assert.ok(html.indexOf('Create prospecting outings, club meetings and online gatherings')<html.indexOf('class="connections-search"'));
 assert.equal((html.match(/Create prospecting outings, club meetings and online gatherings/g)||[]).length,1);
 assert.match(html,/role="search" aria-label="Find Gold Connections events"/);
 const state=directoryPage(filters('state=MA'),empty,{state:stateFor('MA'),member:accounts.member});
 assert.match(state,/<h1>Massachusetts Gold Connections<\/h1>/);
 assert.match(state,/gatherings hosted in Massachusetts/);
 assert.doesNotMatch(state,/class="connections-state"|Local outings, online conversations and familiar faces/);
 assert.ok(hrefs(state).includes('/gold-almanac/massachusetts/'));
});

test('empty default, past, filtered and paginated views describe only their actual query scope',()=>{
 const upcoming=directoryPage(filters(),empty,{member:accounts.member});
 assert.match(upcoming,/No upcoming gatherings are listed in this view/);
 assert.match(upcoming,/Only published events available to you appear here/);
 assert.doesNotMatch(upcoming,/No events match these filters|no events anywhere|no events in the database/i);
 const past=directoryPage(filters('period=past'),empty,{member:accounts.member});
 assert.match(past,/No past gatherings are listed in this view/);
 const matched=directoryPage(filters('q=river&mode=online&spaces=yes'),empty,{member:accounts.member});
 assert.match(matched,/No events match these filters/);assert.match(matched,/Try a broader search/);
 assert.ok(hrefs(matched).includes('/connections/'));
 const later=directoryPage(filters('q=river&page=3&mode=online'),empty,{member:accounts.member});
 assert.match(later,/No events on this results page/);assert.match(later,/matching events on an earlier page/);
 const first=hrefs(later).find(h=>h.startsWith('/connections/?q=river'));
 assert.ok(first);assert.equal(new URL(first,'https://example.test').searchParams.get('page'),null);assert.equal(new URL(first,'https://example.test').searchParams.get('mode'),'online');
 assert.match(later,/← Previous/);
});

test('state clearing keeps the state route; calendar clearing keeps month and period while removing extra restrictions',()=>{
 const state=stateFor('MA');
 const listing=directoryPage(filters('state=MA&q=river&mode=online'),empty,{state,member:accounts.member});
 assert.ok(hrefs(listing).includes('/connections/states/massachusetts/'));
 assert.ok(hrefs(listing).includes('/connections/'));assert.ok(hrefs(listing).includes('/connections/new/?state=MA'));
 const calendar=directoryPage(filters('state=MA&view=calendar&month=2027-06&period=past&q=river&category=Outing'),empty,{state,member:accounts.member});
 assert.match(calendar,/No matching events in June 2027/);assert.match(calendar,/class="connections-month"/);
 assert.match(calendar,/Calendar dates use UTC/);
 const cleared=hrefs(calendar).find(h=>h.startsWith('/connections/states/massachusetts/?period=past&view=calendar&month='));
 assert.ok(cleared);const params=new URL(cleared,'https://example.test').searchParams;
 assert.equal(params.get('month'),'2027-06');assert.equal(params.get('view'),'calendar');assert.equal(params.get('period'),'past');assert.equal(params.get('q'),null);assert.equal(params.get('category'),null);
 assert.match(calendar,/Try another month or clear the extra filters/);
});

test('empty create actions use effective Plus entitlement and guest tours remain browse-only',()=>{
 for(const options of [{},{member:accounts.free},{member:{level:'subscriber'}},{guest:grant},{member:accounts.free,guest:grant}]){
  const html=directoryPage(filters('state=MA'),empty,options);
  assert.equal(personalPaths(hrefs(center(html))).length,0);
 }
 const paid=directoryPage(filters(),empty,{member:accounts.member,guest:grant});
 assert.ok(hrefs(paid).includes('/connections/new/'));assert.doesNotMatch(paid,/Welcome to your Plus guest tour/);
 const guest=directoryPage(filters(),empty,{guest:grant});
 assert.match(guest,/Guest access · browse only/);assert.match(guest,/private addresses, and meeting credentials private/);
 const groups=groupsPage({guest:grant});assert.equal(personalPaths(hrefs(groups)).length,0);
 assert.equal(hrefs(groups).filter(h=>/^\/connections\/states\/[a-z-]+\/$/.test(h)).length,50);
});

test('an unavailable repository never masquerades as an empty event list',()=>{
 const html=directoryPage(filters('state=MA&q=river'),empty,{ready:false,member:accounts.member});
 assert.match(html,/Event listings are unavailable right now/);assert.match(html,/This does not mean there are no events/);
 assert.doesNotMatch(html,/No events match these filters|No upcoming gatherings|no event listings have been loaded/);
 assert.match(html,/value="river"/);
});

test('HTTP discovery preserves public reads, entitlement-specific tools and read-only guest restrictions',async t=>{
 const store=memoryConnections({vault:meetingVault('ab'.repeat(32)),seed:false});
 const members={session:async raw=>accounts[Object.keys(tokens).find(key=>tokens[key]===raw)]||null};
 const guests={read:req=>req.headers.cookie?.includes('guest=valid')?grant:null};
 const handler=createConnectionsHandler({store,members,guests,config:{origin:'https://goldtrails.test'},log:()=>{}});
 const server=createServer({connections:handler,goldPrice:async()=>({}),log:()=>{}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 for(const [cookie,paid]of [['',false],['__Host-gold-member='+tokens.free,false],['guest=valid',false],['__Host-gold-member='+tokens.member,true]]){
  const r=await fetch(base+'/connections/?q=river',{headers:{Cookie:cookie}}),html=await r.text();assert.equal(r.status,200);
  assert.equal(personalPaths(hrefs(html)).length>0,paid);assert.match(html,/No events match these filters/);
  assert.match(r.headers.get('cache-control'),/private, no-store/);assert.match(r.headers.get('vary'),/Cookie/);
 }
 assert.equal(store.events.size,0);assert.equal(store.rsvps.size,0);assert.equal(store.commentRows.size,0);
});

test('nonempty paginated results report only the current page count without inventing a total',()=>{
 const event={id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',title:'Test gathering',startUtc:'2027-06-12T14:00:00Z',timeZone:'America/New_York',mode:'in-person',state:'MA',category:'Outing',organizerName:'Test host',status:'published',capacity:null,yesCount:0};
 const html=directoryPage(filters(),{events:[event],hasMore:true},{member:accounts.member});
 assert.match(html,/1 matching event on this results page\. More events are available on the next page/);
 assert.match(html,/More events →/);assert.match(html,/Test gathering/);
 assert.doesNotMatch(html,/No upcoming gatherings|No events match these filters|1\+ matching event/);
});
