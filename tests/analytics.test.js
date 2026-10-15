import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {dateRange,publicPath,targetUrl,validateEvent,summarizeEvents} from '../app/analytics/model.js';
import {createAnalyticsHandler} from '../app/analytics/handler.js';
import {createAnalyticsStore} from '../app/analytics/store.js';
import {analyticsCsv,renderAnalytics} from '../app/analytics/views.js';
import {createAdminHandler} from '../app/admin.js';
import {createServer} from '../app/server.js';
const origin='https://gold.test',visitor=randomUUID(),session=randomUUID();
const event=(extra={})=>({version:1,consent:true,id:randomUUID(),visitor,session,type:'pageview',page:'/articles/',target:'',referrer:'https://example.org/private?email=secret@example.org',device:'desktop',...extra});
const range=dateRange(new URLSearchParams('from=2026-10-01&to=2026-10-15'),new Date('2026-10-15T12:00Z'));
function memory(){const events=[];let ready=true;return{events,setReady:v=>ready=v,ready:async()=>ready,record:async e=>{if(!events.some(x=>x.id===e.id))events.push({...e,created_at:'2026-10-15T12:00:00'});},report:async r=>({...summarizeEvents(events,r),earliest:events[0]?.created_at||null})};}
async function fixture(t){
 const store=memory(),analytics=createAnalyticsHandler({store,origin,log:()=>{}});
 const admin=createAdminHandler({store:{session:async raw=>raw==='a'.repeat(64)?{authenticated:1,csrf_token:'b'.repeat(64)}:null},config:{origin,username:'owner'},analyticsStore:store,log:()=>{}});
 const server=createServer({analytics,admin,goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path,init={})=>fetch(base+path,{redirect:'manual',...init});
 const post=(data,headers={})=>request('/api/usage/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:typeof data==='string'?data:JSON.stringify(data)});
 return{store,request,post};
}
test('usage data is bounded to public paths, valid consent, pseudonymous codes and safe destinations',()=>{
 for(const path of ['/admin/','/admin/creators/','/account/','/calendar/','/compass/demo/','/login/','/articles/?q=private','/articles/#private','//evil/','/private@example.com/'])assert.equal(publicPath(path),null,path);
 assert.equal(publicPath('/'),'/');assert.equal(publicPath('/gold-almanac/'),'/gold-almanac/');
 const value=validateEvent(event(),origin);assert.equal(value.referrer,'example.org');assert.equal(value.visitor.length,64);assert(!JSON.stringify(value).includes(visitor));assert(!JSON.stringify(value).includes('secret'));
 for(const patch of [{consent:false},{email:'private@example.com'},{visitor:'IP-address'},{page:'/account/'},{type:'watched'},{target:'https://secret.test/'}])assert.throws(()=>validateEvent(event(patch),origin));
 assert.equal(targetUrl('https://www.youtube.com/watch?v=abcdefghijk&t=42s&utm_source=private&email=a',origin),'https://www.youtube.com/watch?v=abcdefghijk&t=42s');
 assert.equal(targetUrl('https://example.org/article?token=SECRET#private',origin),'https://example.org/article');
 for(const url of ['javascript:alert(1)','mailto:me@example.org','https://user:pass@example.org/','https://example.org/me%40example.com/',origin+'/articles/'])assert.equal(targetUrl(url,origin),null);
});
test('reporting dates use inclusive UTC dates with a strict 90-day retention boundary',()=>{
 assert.deepEqual(dateRange(new URLSearchParams('days=7'),new Date('2026-10-15T23:59Z')),{from:'2026-10-09',to:'2026-10-15',until:'2026-10-16',days:7});
 for(const params of ['from=2026-02-30&to=2026-10-15','from=2026-10-16&to=2026-10-16','from=2026-07-01&to=2026-10-15','days=365','from=2026-10-15'])assert.throws(()=>dateRange(new URLSearchParams(params),new Date('2026-10-15')));
});
test('visitor counts are unique across dates, clicks remain distinct from views, and returning means prior history',()=>{
 const old=validateEvent(event(),origin),a=validateEvent(event(),origin),b=validateEvent(event({session:randomUUID()}),origin),click=validateEvent(event({type:'outbound',target:'https://youtu.be/abcdefghijk?t=50'}),origin);
 const data=summarizeEvents([{...old,created_at:'2026-09-30T12:00Z'},{...a,created_at:'2026-10-01T12:00Z'},{...b,created_at:'2026-10-02T12:00Z'},{...click,created_at:'2026-10-02T12:05Z'}],range);
 assert.equal(data.views,2);assert.equal(data.visitors,1);assert.equal(data.sessions,2);assert.equal(data.returning,1);assert.equal(data.clicks,1);assert.equal(data.clickSessions,1);assert.equal(data.destinations[0].target,'https://youtu.be/abcdefghijk?t=50');assert.equal(data.days.reduce((n,d)=>n+d.visitors,0),2);
});
test('public collector rejects cross-site, malformed, private and oversized events, and deduplicates valid events',async t=>{
 const f=await fixture(t),value=event();assert.equal((await f.post(value)).status,204);assert.equal((await f.post(value)).status,204);assert.equal(f.store.events.length,1);
 assert.equal((await f.post(event(),{Origin:'https://evil.test'})).status,403);
 assert.equal((await f.post(event(),{'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await f.post(event({consent:false}))).status,400);assert.equal((await f.post(event({page:'/account/'}))).status,400);assert.equal((await f.post('{')).status,400);assert.equal((await f.post('x'.repeat(5000))).status,413);
 assert.equal((await f.request('/api/usage/')).status,405);
 f.store.setReady(false);assert.equal((await f.post(event())).status,503);assert.equal(f.store.events.length,1);
});
test('privacy signals, bots and owner sessions produce no recorded events',async t=>{
 const f=await fixture(t);for(const headers of [{'Sec-GPC':'1'},{DNT:'1'},{'User-Agent':'Googlebot'},{Cookie:'__Host-gold-admin='+ 'a'.repeat(64)}])assert.equal((await f.post(event(),headers)).status,204);assert.equal(f.store.events.length,0);
});
test('all public HTML renderers receive preference assets while private, error and disconnected pages do not',async t=>{
 const f=await fixture(t);for(const path of ['/','/glossary/','/gold-almanac/','/plus/','/donate/']){const r=await f.request(path);assert.equal(r.status,200);assert.match(await r.text(),/site-analytics\.js\?v=/);}
 const owner=await f.request('/',{headers:{Cookie:'__Host-gold-admin='+ 'a'.repeat(64)}});assert.doesNotMatch(await owner.text(),/site-analytics\.js/);
 const no=await f.request('/not-found/');assert.equal(no.status,404);assert.doesNotMatch(await no.text(),/site-analytics\.js/);
 f.store.setReady(false);assert.doesNotMatch(await(await f.request('/')).text(),/site-analytics\.js/);
 assert.match(await(await f.request('/privacy/usage/')).text(),/pseudonymous/);
});
test('usage reports and CSV require owner authentication and remain read-only, escaped and no-store',async t=>{
 const f=await fixture(t);for(const path of ['/admin/analytics/','/admin/analytics/export/']){const r=await f.request(path);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/admin/login/');}
 assert.equal((await f.request('/admin/analytics/',{headers:{Cookie:'__Host-gold-member='+ 'a'.repeat(64)}})).status,303);
 await f.post(event());await f.post(event({type:'outbound',target:'https://example.org/article?token=secret'}));
 const headers={Cookie:'__Host-gold-admin='+ 'a'.repeat(64)};let response=await f.request('/admin/analytics/',{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert.match(html,/Measured visitors/);assert.match(html,/participating browsers/);assert.doesNotMatch(html,/token=secret|site-analytics\.js/);
 response=await f.request('/admin/analytics/export/',{headers});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);assert.match(response.headers.get('content-disposition'),/attachment/);assert.match(await response.text(),/https:\/\/example.org\/article/);
 assert.equal((await f.request('/admin/analytics/?days=365',{headers})).status,400);
 f.store.setReady(false);response=await f.request('/admin/analytics/',{headers});assert.equal(response.status,503);assert.match(await response.text(),/unavailable, not zero/);
});
test('CSV neutralizes spreadsheet formulas and HTML reporting escapes untrusted labels',()=>{
 const data=summarizeEvents([],range);data.referrals=[{referrer:'=HYPERLINK("evil")',sessions:1,views:1}];data.pages=[{page:'<script>alert(1)</script>',views:1,visitors:1,clicks:1}];
 assert.match(analyticsCsv(data,range),/"'=HYPERLINK/);const html=renderAnalytics(data,range);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/not a census/);
});
test('database collector uses bound values and aggregate queries, retains 90 days and drops duplicate IDs',async()=>{
 const calls=[];const db={query:async(sql,values=[])=>{calls.push({sql,values});if(sql.startsWith('SELECT version'))return[{version:'010_site_analytics'}];if(sql.includes('COUNT(*) AS total FROM site_usage_events WHERE visitor_hash'))return[{total:0n}];if(sql.startsWith('INSERT'))return{affectedRows:1};if(sql.startsWith('DELETE'))return{};if(sql.includes('MIN(created_at)'))return[{earliest:null}];return[];}};
 const store=createAnalyticsStore(db);assert.equal(await store.ready(),true);const clean=validateEvent(event(),origin);await store.record(clean);const result=await store.report(range);assert.doesNotThrow(()=>JSON.stringify(result));assert(calls.some(c=>c.sql.includes('INTERVAL 89 DAY')));assert(calls.some(c=>c.sql.startsWith('INSERT IGNORE')));assert(calls.some(c=>c.sql.includes('COUNT(DISTINCT')));assert(!calls.some(c=>c.sql.includes(visitor)||/member_accounts|email|ip_address/.test(c.sql)));assert(calls.filter(c=>c.sql.startsWith('SELECT')&&c.sql.includes('created_at>=?')).every(c=>c.values.length>=2));
});
