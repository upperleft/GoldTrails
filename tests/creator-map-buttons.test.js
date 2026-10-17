import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from '../app/server.js';

const paid='a'.repeat(64),free='b'.repeat(64),expired='c'.repeat(64),offline='d'.repeat(64);
async function fixture(t){
 const memberSessions={session:async token=>{if(token===offline)throw Error('private database detail');return token===paid?{effective_level:'subscriber'}:token===expired?{level:'subscriber',effective_level:'free'}:token===free?{effective_level:'free'}:null;}};
 const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
 const server=createServer({memberSessions,directory,goldPrice:async()=>({}),log:()=>{}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 return (path,token,extra={})=>fetch('http://127.0.0.1:'+server.address().port+path,{headers:{...(token?{cookie:'__Host-gold-member='+token}:{}),...extra}});
}
test('only an authenticated Plus member receives creator map buttons; cached markup cannot cross accounts',async t=>{
 const request=await fixture(t);
 for(const token of [null,free,expired,'f'.repeat(64),offline,paid,null]){
  const r=await request('/prospectors/?level=subscriber',token),html=await r.text();assert.equal(r.status,200);
  assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');
  assert.equal(html.includes('class="map-find"'),token===paid);
  assert.match(html,/class="creator-actions"><a class="creator-video-link"/);assert.match(html,/data-video-library/);
  assert.doesNotMatch(html,/private database detail/);
 }
 const ownerOnly=await request('/prospectors/',null,{cookie:'__Host-gold-admin='+paid});assert.doesNotMatch(await ownerOnly.text(),/class="map-find"/);
});
test('creator profiles and video libraries still work for visitors and free members',async t=>{
 const request=await fixture(t);
 for(const token of [null,free])for(const path of ['/prospectors/dan-hurd/','/prospectors/dan-hurd/videos/','/api/prospectors/dan-hurd/videos/']){
  const r=await request(path,token);assert.equal(r.status,200,path);assert.doesNotMatch(await r.text(),/class="map-find"/);
 }
});
