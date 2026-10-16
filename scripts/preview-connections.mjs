// Isolated local test workspace. No production DB, Stripe, mail or real members.
import {createServer} from '../app/server.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {meetingVault} from '../app/connections/model.js';
import {processEventPhoto} from '../app/connections/photos.js';
import {memoryConnections,accounts,tokens,csrf} from './fixtures/connections-memory.mjs';
const origin='http://127.0.0.1:4329',vault=meetingVault('ab'.repeat(32)),store=memoryConnections({vault});
const members={session:async raw=>accounts[Object.keys(tokens).find(k=>tokens[k]===raw)]||null};
const connections=createConnectionsHandler({store,members,config:{origin},vault,processPhoto:processEventPhoto,calendarStore:{ready:async()=>true},log:()=>{}});
const server=createServer({connections,goldPrice:async()=>({}),log:()=>{}}),handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 const url=new URL(req.url,origin);
 if(url.pathname==='/_connections-preview/'){
  if(req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>2000){res.writeHead(413);res.end();return;}}const role=new URLSearchParams(body).get('role');if(!['public','organizer','member','free'].includes(role)){res.writeHead(400);res.end();return;}res.writeHead(303,{'Set-Cookie':'gold-preview-role='+role+'; HttpOnly; SameSite=Lax; Path=/','Location':'/connections/','Cache-Control':'no-store'});res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><title>Gold Connections local test controls</title><h1>Local test workspace</h1><p>Fictional events only. No real accounts, emails or payments.</p><form method="post"><label>Test role <select name="role"><option value="public">Public visitor</option><option value="organizer">Plus organizer</option><option value="member">Plus member</option><option value="free">Free member</option></select></label><button>Open Gold Connections</button></form></html>');return;
 }
 const role=(req.headers.cookie||'').match(/(?:^|;\s*)gold-preview-role=(organizer|member|free)/)?.[1];if(role)req.headers.cookie='__Host-gold-member='+tokens[role]+'; __Host-gold-form='+csrf;
 const end=res.end.bind(res),head=res.writeHead.bind(res);let responseType='';res.writeHead=(status,headers)=>{responseType=String(Object.entries(headers||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||'');return head(status,headers);};res.end=(chunk,encoding,callback)=>{if(responseType.includes('text/html')&&chunk){let html=Buffer.isBuffer(chunk)?chunk.toString():String(chunk);html=html.replace('<body', '<body').replace(/(<body[^>]*>)/,'$1<div class="connections-preview-banner">LOCAL TEST · Fictional events · No emails or payments · <a href="/_connections-preview/">Change test role</a></div>');chunk=Buffer.from(html);}return end(chunk,encoding,callback);};
 return handler(req,res);
});
server.listen(4329,'127.0.0.1',()=>console.log('Isolated Gold Connections preview: '+origin+'/connections/'));
