import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {featureLabelPage,featureLabelMember,featureLabelText,featureLabelMarkup} from '../app/plus/feature-label.js';
import {createServer} from '../app/server.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createGuestPlusAccess} from '../app/plus/guest-access.js';

const paid='a'.repeat(64),creator='b'.repeat(64),expired='c'.repeat(64),free='d'.repeat(64),rawOnly='e'.repeat(64),offline='f'.repeat(64),guestToken='12'.repeat(32);
const memberCookie=token=>'__Host-gold-member='+token;
const guestCookie='__Host-gold-plus-guest='+guestToken;
const members=new Map([
 [paid,{effective_level:'subscriber',grant_source:'payment'}],
 [creator,{effective_level:'subscriber',grant_source:'complimentary'}],
 [expired,{effective_level:'free',level:'subscriber',grant_source:'complimentary'}],
 [free,{effective_level:'free',grant_source:'payment'}],
 [rawOnly,{level:'subscriber',grant_source:'complimentary'}]
]);
const html='<!doctype html><html><head><title>Feature fixture</title></head><body class="category-page"><main><section class="category-intro rust"><div><span class="eyebrow">THE LIBRARY</span><h1>Feature heading</h1></div></section><div class="layout"><aside class="left"><section class="panel trail-menu">Old navigation</section></aside><div class="center"><p>Existing content and public event details.</p></div></div></main><footer></footer></body></html>';
const label=html=>html.match(/<p class="plus-feature-label"[\s\S]*?<\/p>/)?.[0]||'';

test('only canonical Almanac and Connections HTML feature destinations receive a label',()=>{
 for(const path of ['/gold-almanac','/gold-almanac/','/gold-almanac/california/','/gold-almanac/british-columbia/'])assert.equal(featureLabelPage(path),'almanac',path);
 for(const path of ['/connections/','/connections/states/','/connections/states/maine/','/connections/new/','/connections/mine/','/connections/preferences/','/connections/events/12345678-1234-1234-1234-123456789012/','/connections/events/12345678-1234-1234-1234-123456789012/manage/'])assert.equal(featureLabelPage(path),'connections',path);
 for(const path of ['/','/articles/','/products/','/prospectors/','/calendar/','/plus/','/login/','/admin/','/api/gold-almanac/california/','/gold-almanac-extra/','/gold-almanac.css','/gold-almanac/map.js','/connections-extra/','/connections/coverage/','/connections/moderation/','/connections/unsubscribe/','/connections/photos/12345678-1234-1234-1234-123456789012/','/connections/events/12345678-1234-1234-1234-123456789012/calendar.ics'])assert.equal(featureLabelPage(path),null,path);
});

test('labels use effective membership and distinguish complimentary, included, guest and regular access',()=>{
 assert.equal(featureLabelText({member:members.get(creator)}),'Complimentary access (normally $5/month)');
 assert.equal(featureLabelText({member:members.get(paid)}),'Included with your membership');
 for(const token of [expired,free,rawOnly])assert.equal(featureLabelText({member:members.get(token)}),'$5/month');
 assert.equal(featureLabelText({guest:{id:'validated-read-only-pass'}}),'Read-only guest preview (normally $5/month)');
 assert.equal(featureLabelText({member:members.get(creator),guest:{id:'pass'}}),'Complimentary access (normally $5/month)');
 assert.equal(featureLabelText({member:members.get(paid),guest:{id:'pass'}}),'Included with your membership');
});

test('session lookup requires the existing member cookie and never accepts query or admin credentials',async()=>{
 const calls=[],store={session:async token=>{calls.push(token);return {effective_level:'subscriber'};}};
 for(const cookie of ['',memberCookie('malformed'),'__Host-gold-admin='+creator])assert.equal(await featureLabelMember({headers:{cookie},url:'/?member='+creator},store),null);
 assert.equal(calls.length,0);
 assert.equal((await featureLabelMember({headers:{cookie:memberCookie(creator)}},store)).effective_level,'subscriber');assert.deepEqual(calls,[creator]);
});

test('small label precedes the feature heading once and preserves content, sources and a clear public-browsing distinction',()=>{
 const output=featureLabelMarkup(html,{feature:'connections',member:members.get(creator)});
 assert.equal((output.match(/data-plus-feature-label/g)||[]).length,1);assert.ok(output.indexOf('data-plus-feature-label')<output.indexOf('<h1>'));
 assert.match(label(output),/href="\/plus\/"/);assert.match(label(output),/Gold Trails Plus/);assert.match(label(output),/Complimentary access \(normally \$5\/month\)/);
 assert.match(label(output),/Event participation · Public event browsing is free\./);assert.match(output,/Existing content and public event details\./);
 assert.equal((output.match(/href="\/plus\.css\?v=[a-f0-9]{12}"/g)||[]).length,1);
 assert.equal(featureLabelMarkup(output,{feature:'connections'}),output);
 assert.equal(featureLabelMarkup(html,{feature:null}),html);assert.equal(featureLabelMarkup('<html><head></head><body>No heading</body></html>',{feature:'almanac'}),'<html><head></head><body>No heading</body></html>');
});

async function fixture(t){
 const root=await realpath(await mkdtemp(join(tmpdir(),'gold-plus-label-')));
 for(const path of ['articles','products','prospectors','calendar','login','gold-almanac-extra']){await mkdir(join(root,path));await writeFile(join(root,path,'index.html'),html);}
 await writeFile(join(root,'probe.css'),'a{color:gold}');
 let sessionCalls=0;
 const sessions={session:async token=>{sessionCalls++;if(token===offline)throw Error('PRIVATE_SESSION_FAILURE');return members.get(token)||null;}};
 const guests=createGuestPlusAccess({passes:[{id:'feature-label-guest',label:'Read-only fixture',tokenHash:createHash('sha256').update(guestToken).digest('hex'),expiresAt:'2026-11-05T00:00:00Z'}],now:()=>Date.parse('2026-11-03T12:00:00Z')});
 const almanac=createAlmanacHandler({members:sessions,guests});
 const connections=async(req,res,url)=>{
  if(!url.pathname.startsWith('/connections/'))return false;
  const payload=url.pathname==='/connections/coverage/'?'{"states":["ME"]}':html;
  const type=url.pathname==='/connections/coverage/'?'application/json':'text/html';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=60','Content-Length':Buffer.byteLength(payload)});res.end(req.method==='HEAD'?undefined:payload);return true;
 };
 const server=createServer({root,memberSessions:sessions,guests,almanac,connections,goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
 return {request:(path,cookie='',options={})=>fetch('http://127.0.0.1:'+server.address().port+path,{redirect:'manual',...options,headers:{...(cookie?{Cookie:cookie}:{}),...options.headers}}),calls:()=>sessionCalls};
}

test('HTTP labels distinguish real effective memberships and guests while reusing navigation session reads',async t=>{
 const f=await fixture(t);
 for(const [cookie,expected] of [['','$5/month'],[memberCookie(paid),'Included with your membership'],[memberCookie(creator),'Complimentary access (normally $5/month)'],[memberCookie(expired),'$5/month'],[memberCookie(rawOnly),'$5/month'],[memberCookie(offline),'$5/month'],[guestCookie,'Read-only guest preview (normally $5/month)'],[guestCookie+'; '+memberCookie(creator),'Complimentary access (normally $5/month)'],[guestCookie+'; '+memberCookie(paid),'Included with your membership']]){
  const before=f.calls(),response=await f.request('/connections/?level=subscriber&grant_source=complimentary',cookie),body=await response.text();assert.equal(response.status,200);
  assert.ok(label(body).includes(expected),expected);assert.ok(!body.includes('PRIVATE_SESSION_FAILURE'));
  assert.equal(f.calls()-before,cookie.includes('__Host-gold-member=')?1:0,'Feature label and navigation share one session lookup');
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/);
  assert.match(body,/Existing content and public event details\./);
 }
});

test('Almanac locks, HEAD bodies, JSON, assets and free pages keep their existing behavior',async t=>{
 const f=await fixture(t);
 for(const [cookie,status,text]of [['',403,'$5/month'],[memberCookie(creator),200,'Complimentary access (normally $5/month)'],[memberCookie(paid),200,'Included with your membership'],[guestCookie,200,'Read-only guest preview (normally $5/month)'],[memberCookie(expired),403,'$5/month']]){
  const response=await f.request('/gold-almanac/california/',cookie),body=await response.text();assert.equal(response.status,status);assert.ok(label(body).includes(text));
 }
 const head=await f.request('/connections/',memberCookie(creator),{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('cache-control'),'private, no-store');assert.equal(head.headers.get('content-length'),null);
 const before=f.calls(),json=await f.request('/connections/coverage/',memberCookie(creator));assert.equal(await json.text(),'{"states":["ME"]}');assert.equal(json.headers.get('content-type'),'application/json');assert.equal(json.headers.get('cache-control'),'public, max-age=60');assert.equal(f.calls()-before,1,'No additional feature-label session read on JSON');
 const api=await f.request('/api/gold-almanac/california/',memberCookie(creator)),apiBody=await api.text();assert.match(api.headers.get('content-type'),/application\/json/);assert.ok(!apiBody.includes('data-plus-feature-label'));
 for(const path of ['/articles/','/products/','/prospectors/','/calendar/','/login/','/gold-almanac-extra/']){const response=await f.request(path,memberCookie(creator));assert.ok(!(await response.text()).includes('data-plus-feature-label'),path);}
 const assetBefore=f.calls(),asset=await f.request('/probe.css',memberCookie(creator));assert.equal(await asset.text(),'a{color:gold}');assert.equal(f.calls(),assetBefore);
});
