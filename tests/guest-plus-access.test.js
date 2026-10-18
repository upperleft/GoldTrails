import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuestPlusAccess} from '../app/plus/guest-access.js';
import {hasPremiumFeature} from '../app/plus/entitlements.js';
import {digest} from '../app/admin-auth.js';
import {createServer} from '../app/server.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createMemberHandler} from '../app/members.js';
import {createCalendarHandler} from '../app/calendar/handler.js';
import {createAlmanacCreators} from '../app/almanac/creators.js';
import {states} from '../app/almanac/model.js';

const origin='https://goldtrails.org';
const raw='1a'.repeat(32),unknown='2b'.repeat(32),paid='a'.repeat(64),free='b'.repeat(64);
const start=Date.parse('2026-10-17T12:00:00Z');
const guestCookie='__Host-gold-plus-guest='+raw;
const req=(cookie='',method='GET')=>({method,headers:cookie?{cookie}:{}});
function service(){
 let clock=start;
 const pass={id:'friends-october',label:'Friends of Gold Trails',tokenHash:digest(raw),expiresAt:new Date(start+7*86400000).toISOString()};
 const guests=createGuestPlusAccess({passes:[pass],now:()=>clock,origin});
 return {guests,pass,setTime:value=>{clock=value;}};
}
async function fixture(t){
 const s=service();let lookups=0,privateReads=0,privateWrites=0;
 const sessions={ready:async()=>true,session:async token=>token===paid?{id:'paid-member',username:'Paid reader',effective_level:'subscriber'}:token===free?{id:'free-member',username:'Free reader',effective_level:'free'}:null};
 const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
 const almanac=createAlmanacHandler({guests:s.guests,members:sessions,creators:createAlmanacCreators(directory),store:async()=>{lookups++;return{};}});
 const privateStore={ready:async()=>true,listCalendars:async()=>{privateReads++;return[];},createCalendar:async()=>{privateWrites++;return{};}};
 const server=createServer({guests:s.guests,almanac,directory,memberSessions:sessions,members:createMemberHandler({store:sessions,config:{origin},log:()=>{}}),calendar:createCalendarHandler({store:privateStore,members:sessions,config:{origin},log:()=>{}}),goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path,{cookie='',headers={},...options}={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...options,headers:{...(cookie?{Cookie:cookie}:{}),...headers}});
 return {...s,request,lookups:()=>lookups,privateReads:()=>privateReads,privateWrites:()=>privateWrites};
}
const assertNoSecrets=(text)=>{assert.ok(!text.includes(raw),'Must not render the invitation bearer');assert.ok(!text.includes(digest(raw)),'Must not render the configured token hash');};

test('guest grant comes only from one valid dedicated cookie and read-only HTTP methods',()=>{
 const {guests}=service();
 for(const method of ['GET','HEAD'])assert.ok(guests.read(req('unrelated=value; '+guestCookie,method)));
 for(const cookie of ['', '__Host-gold-plus-guest='+unknown,'__Host-gold-member='+raw,'__Host-gold-admin='+raw,guestCookie+'; '+guestCookie,'__Host-gold-plus-guest='+raw.toUpperCase(), '__Host-gold-plus-guest='+raw+'extra','__Host-gold-plus-guest=%31'+raw.slice(1)])assert.equal(guests.read(req(cookie)),null,cookie===guestCookie?'duplicate valid cookie':'invalid cookie');
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal(guests.read(req(guestCookie,method)),null,method);
 assert.equal(guests.read({method:'GET',headers:{'x-gold-plus-guest':raw},url:'/?pass='+raw}),null);
});

test('expiry and revocation are checked for an already-issued guest cookie on every read',()=>{
 const {guests,pass,setTime}=service();
 assert.ok(guests.read(req(guestCookie)));
 pass.revoked=true;assert.equal(guests.read(req(guestCookie)),null);
 pass.revoked=false;assert.ok(guests.read(req(guestCookie)));
 setTime(Date.parse(pass.expiresAt)-1);assert.ok(guests.read(req(guestCookie)));
 setTime(Date.parse(pass.expiresAt));assert.equal(guests.read(req(guestCookie)),null);
});

test('a guest grant unlocks only approved premium reads while revoked guest access leaves real paid membership intact',async()=>{
 const {guests,pass}=service();
 for(const feature of ['almanac','connections'])assert.equal(await hasPremiumFeature(req(guestCookie),{guests},feature),true,feature);
 assert.equal(await hasPremiumFeature(req(guestCookie),{guests},'unapproved-feature'),false);
 assert.equal(await hasPremiumFeature(req(guestCookie,'POST'),{guests},'almanac'),false);
 pass.revoked=true;
 assert.equal(await hasPremiumFeature(req(guestCookie),{members:{session:async()=>({effective_level:'subscriber'})},guests},'almanac'),true);
 assert.equal(await hasPremiumFeature(req(guestCookie),{members:{session:async()=>({effective_level:'subscriber'})},guests:{read:()=>{throw Error('Unavailable guest configuration');}}},'almanac'),true);
 assert.equal(await hasPremiumFeature(req('__Host-gold-member='+free),{members:{session:async()=>({level:'subscriber',effective_level:'free'})},guests},'almanac'),false);
});

test('invitation exchange sets only a secure guest cookie and removes the bearer from the landing URL',async t=>{
 const f=await fixture(t);
 for(const method of ['GET','HEAD']){
  const response=await f.request('/plus/guest/?pass='+raw,{method});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/');
  const cookies=response.headers.getSetCookie();assert.equal(cookies.length,1);
  assert.match(cookies[0],/^__Host-gold-plus-guest=/);
  for(const attribute of ['Path=/','Secure','HttpOnly','SameSite=Lax'])assert.ok(cookies[0].includes(attribute),attribute);
  assert.match(cookies[0],/Max-Age=[1-9]\d*/);
  assert.match(response.headers.get('cache-control'),/private.*no-store/);
  assert.match(response.headers.get('x-robots-tag'),/\bnoindex\b/);
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assertNoSecrets(await response.text());
 }
});

test('malformed, duplicate, expired and unconfigured invitations cannot redirect or issue a session',async t=>{
 const f=await fixture(t);
 const invalid=['','?pass='+unknown,'?pass=short','?pass='+raw+'&pass='+raw,'?pass='+raw+'&next=https%3A%2F%2Fevil.example%2F','?pass='+raw+'&extra=1','?token='+raw];
 for(const query of invalid){
  const response=await f.request('/plus/guest/'+query);
  assert.equal(response.status,410,query.includes('next=')?'external destination rejected':'invalid invitation');
  assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('set-cookie'),null);
  assertNoSecrets(await response.text());
 }
 f.setTime(Date.parse(f.pass.expiresAt));
 assert.equal((await f.request('/plus/guest/?pass='+raw)).status,410);
 assert.equal((await f.request('/plus/guest/?pass='+raw,{method:'POST'})).status,405);
});

test('all 50 state APIs stay gated normally and open with a guest pass without copying or caching authorization',async t=>{
 const f=await fixture(t);
 for(const state of states){
  const path='/api/gold-almanac/'+state.slug+'/';
  const closed=await f.request(path);assert.equal(closed.status,403,state.name);assert.equal((await closed.json()).code,'plus_required');
  const opened=await f.request(path,{cookie:guestCookie});assert.equal(opened.status,200,state.name);
  assert.match(opened.headers.get('cache-control'),/private.*no-store/);assert.equal(opened.headers.get('vary'),'Cookie');
  const body=await opened.json();assert.equal(body.state.slug,state.slug);assert.match(body.html,/almanac-section/);assertNoSecrets(JSON.stringify(body));
 }
 assert.equal(f.lookups(),50);
 let response=await f.request('/gold-almanac/california/',{cookie:guestCookie});assert.equal(response.status,200);const html=await response.text();assert.match(html,/id="state-details"/);assertNoSecrets(html);
 f.pass.revoked=true;
 response=await f.request('/api/gold-almanac/california/',{cookie:guestCookie});assert.equal(response.status,403);assert.equal(f.lookups(),50);
 assert.equal((await f.request('/gold-almanac/california/',{cookie:guestCookie})).status,403);
 assert.equal((await f.request('/api/gold-almanac/california/',{cookie:'__Host-gold-member='+paid})).status,200);
});

test('the full map and creator data work for guests while the public creator directory remains free',async t=>{
 const f=await fixture(t);
 const root=await f.request('/gold-almanac/',{cookie:guestCookie}),html=await root.text();assert.equal(root.status,200);assert.match(html,/class="almanac-map"/);assert.equal((html.match(/data-state="/g)||[]).length,50);
 const creatorApi=await f.request('/api/gold-almanac/creators/',{cookie:guestCookie});assert.equal(creatorApi.status,200);assert.ok((await creatorApi.json()).records.length>0);
 assert.equal((await f.request('/api/gold-almanac/creators/')).status,403);
 for(const path of ['/prospectors/','/prospectors/dan-hurd/','/prospectors/dan-hurd/videos/','/api/prospectors/dan-hurd/videos/'])assert.equal((await f.request(path)).status,200,path);
 const publicDirectory=await(await f.request('/prospectors/')).text();assert.doesNotMatch(publicDirectory,/class="map-find"/);
 const guestDirectory=await(await f.request('/prospectors/',{cookie:guestCookie})).text();assert.match(guestDirectory,/class="map-find"/);assertNoSecrets(guestDirectory);
});

test('guest-only HTML decoration is private and does not inject markup into JSON or personal sign-in screens',async t=>{
 const f=await fixture(t);
 for(const path of ['/','/articles/','/glossary/','/plus/']){
  const response=await f.request(path,{cookie:guestCookie});assert.equal(response.status,200,path);
  assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.match(response.headers.get('vary'),/Cookie/);assert.match(response.headers.get('x-robots-tag'),/\bnoindex\b/);assert.equal(response.headers.get('referrer-policy'),'strict-origin');
  const html=await response.text();assert.match(html,/\/plus\/guest\/leave\//);assertNoSecrets(html);
  const ordinary=await(await f.request(path)).text();assert.doesNotMatch(ordinary,/\/plus\/guest\/leave\//);
 }
 for(const path of ['/login/','/signup/','/calendar/']){
  const response=await f.request(path,{cookie:guestCookie});assert.equal(response.status,200,path);assert.doesNotMatch(await response.text(),/\/plus\/guest\/leave\//);
 }
 const api=await f.request('/api/gold-almanac/nevada/',{cookie:guestCookie});assert.equal(api.status,200);assert.ok((await api.json()).html);
});

test('guest access cannot impersonate a member or open a private calendar or account',async t=>{
 const f=await fixture(t);
 const account=await f.request('/account/',{cookie:guestCookie});assert.equal(account.status,303);assert.equal(account.headers.get('location'),'/login/');
 const calendars=await f.request('/calendar/api/calendars',{cookie:guestCookie});assert.equal(calendars.status,401);assert.equal(f.privateReads(),0);
 const write=await f.request('/calendar/api/calendars',{cookie:guestCookie,method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({csrf:raw,name:'Not a member calendar',color:'#785434'})});assert.equal(write.status,401);assert.equal(f.privateWrites(),0);
 const forged=await f.request('/api/gold-almanac/california/',{cookie:'__Host-gold-member='+raw});assert.equal(forged.status,403);
 const expired=await f.request('/api/gold-almanac/california/',{cookie:guestCookie});assert.equal(expired.status,200);f.setTime(Date.parse(f.pass.expiresAt));assert.equal((await f.request('/api/gold-almanac/california/',{cookie:guestCookie})).status,403);
});

test('leaving the guest preview requires same-origin POST and clears no member or administrator cookie',async t=>{
 const f=await fixture(t),cookie=guestCookie+'; __Host-gold-member='+paid+'; __Host-gold-admin='+'d'.repeat(64);
 for(const method of ['GET','HEAD','PUT','DELETE'])assert.equal((await f.request('/plus/guest/leave/',{method,cookie})).status,405,method);
 for(const badOrigin of ['', 'null','https://evil.example']){
  const response=await f.request('/plus/guest/leave/',{cookie,method:'POST',headers:badOrigin?{Origin:badOrigin}:{}});assert.equal(response.status,403);assert.equal(response.headers.get('set-cookie'),null);
 }
 const left=await f.request('/plus/guest/leave/',{cookie,method:'POST',headers:{Origin:origin}});assert.equal(left.status,303);assert.equal(left.headers.get('location'),'/');
 const cookies=left.headers.getSetCookie();assert.equal(cookies.length,1);assert.match(cookies[0],/^__Host-gold-plus-guest=;/);assert.match(cookies[0],/Max-Age=0/);assert.doesNotMatch(cookies[0],/__Host-gold-(?:member|admin|form)=/);
 assertNoSecrets(await left.text());
});
