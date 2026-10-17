import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from '../app/server.js';
import {accountView} from '../app/account-view.js';

test('retired Compass bookmarks go to the account and old forms cannot reach member handlers',async t=>{
 let called=0;
 const server=createServer({members:async(req,res,url)=>{called++;if(['/account/','/calendar/'].includes(url.pathname)){res.writeHead(200);res.end('Available');return true;}return false;},goldPrice:async()=>({}),log:()=>{}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 for(const path of ['/compass','/compass/','/compass/demo/','/compass/profile/?step=2','/compass/passport/','/compass/privacy/'])for(const method of ['GET','HEAD']){
  const r=await fetch(origin+path,{method,redirect:'manual'});assert.equal(r.status,303,path);assert.equal(r.headers.get('location'),'/account/');assert.equal(r.headers.get('cache-control'),'no-store');
 }
 for(const path of ['/compass/profile/','/compass/export/','/compass/delete/','/compass/guide/']){
  const r=await fetch(origin+path,{method:'POST',body:'action=save',redirect:'manual'});assert.equal(r.status,410);assert.match(await r.text(),/feature has been removed/);
 }
 assert.equal(called,0);
 for(const path of ['/account/','/calendar/'])assert.equal((await fetch(origin+path)).status,200);
});
test('production startup and public account descriptions no longer offer Compass',async()=>{
 const startup=await readFile('server.js','utf8');assert.doesNotMatch(startup,/createCompass|compassStore/);
 const about=await readFile('dist/about-the-camp/index.html','utf8');assert.doesNotMatch(about,/My Gold Trail|personal dashboard|recommendations shaped/);
 const html=accountView({display_name:'Alex',username:'reader',account_number:42,email:'alex@example.invalid',effective_level:'free'},'token');
 assert.doesNotMatch(html,/href="\/compass\/|My Gold Trail|recommendations/);assert.match(html,/href="\/calendar\/"/);
});
