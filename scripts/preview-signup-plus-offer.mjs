// Isolated, read-only browser preview of actual signup responses. No database or mail service.
import {Readable} from 'node:stream';
import {createServer} from '../app/server.js';
import {createMemberHandler} from '../app/members.js';
import {readingMarkup} from '../app/reading/handler.js';

const origin='https://gold.example',csrf='a'.repeat(64);
const members=createMemberHandler({config:{origin,open:true},log:console.error,
 mail:async()=>{},store:{ready:async()=>true,allow:async()=>true,
  signup:async()=>({id:'fictional-preview',email:'preview@example.invalid'}),issue:async()=>'b'.repeat(64)}});
async function rendered(method){
 const form=new URLSearchParams({csrf,username:'TrailPreview',email:'preview@example.invalid',password:'fictional-preview-only'});
 const req=Readable.from(method==='POST'?[Buffer.from(form.toString())]:[]);
 req.method=method;req.headers={origin,'content-type':'application/x-www-form-urlencoded',cookie:`__Host-gold-form=${csrf}`};
 let html='',headers,status;
 const res={writeHead(code,values){status=code;headers=values;},end(value){html=value||'';}};
 await members(req,res,new URL('/signup/',origin));
 if(status!==200)throw new Error('Signup preview could not render');
 return {html:readingMarkup(html),headers};
}
const success=await rendered('POST'),initial=await rendered('GET');
const server=createServer({goldPrice:async()=>({}),log:console.error});
const regular=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only fictional preview.');return;}
 const path=new URL(req.url,'http://localhost').pathname;
 const fixture=path==='/signup-offer-preview/'?success:path==='/signup-form-preview/'?initial:null;
 if(fixture){res.writeHead(200,{...fixture.headers,'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:fixture.html);return;}
 return regular(req,res);
});
server.listen(4341,'127.0.0.1',()=>console.log('Read-only Plus signup preview: http://127.0.0.1:4341/signup-offer-preview/'));
