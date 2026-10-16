import test from 'node:test';
import http from 'node:http';
const request=(url,options={})=>new Promise((resolve,reject)=>{const req=http.request(url,{method:options.method||'GET',headers:options.headers},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:{get:name=>res.headers[name]??null}}));});req.on('error',reject);req.end(options.body);});
import assert from 'node:assert/strict';
import {createServer} from '../app/server.js';
test('www redirects to the fixed production origin before sessions or feature handlers run',async t=>{
 let calls=0;
 const server=createServer({canonicalOrigin:'https://goldtrails.org',plus:async(req,res)=>{calls++;res.writeHead(200);res.end('canonical');return true;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 for(const method of ['GET','HEAD']) {
  const r=await request(base+'/login/?next=%2Fcalendar%2F',{method,redirect:'manual',headers:{Host:'www.goldtrails.org'}});
  assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://goldtrails.org/login/?next=%2Fcalendar%2F');assert.equal(r.headers.get('set-cookie'),null);
 }
 const post=await request(base+'/login/',{method:'POST',redirect:'manual',headers:{Host:'www.goldtrails.org'},body:'csrf=invalid'});
 assert.equal(post.status,421);assert.equal(post.headers.get('location'),null);assert.equal(calls,0);
 const canonical=await request(base+'/login/',{headers:{Host:'goldtrails.org'}});assert.equal(canonical.status,200);assert.equal(calls,1);
 const unknown=await request(base+'/login/',{headers:{Host:'www.evil.example'}});assert.equal(unknown.status,200);assert.equal(unknown.headers.get('location'),null);
});
test('local and unconfigured deployments never redirect to the production domain',async t=>{
 const server=createServer({canonicalOrigin:'https://preview.example',plus:async(req,res)=>{res.writeHead(200);res.end('preview');return true;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const r=await request('http://127.0.0.1:'+server.address().port+'/login/',{redirect:'manual',headers:{Host:'www.goldtrails.org'}});assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);
});
