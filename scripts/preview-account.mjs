// Loopback-only, fictional account preview. No real members, database or mail.
import {createServer} from '../app/server.js';
import {createMemberHandler} from '../app/members.js';
import {digest} from '../app/admin-auth.js';
const csrf='a'.repeat(64),session='b'.repeat(64),origin='http://127.0.0.1:4333';
const member={username:'TrailReader',display_name:'Alex',email:'alex@example.invalid',account_number:42,effective_level:process.argv.includes('--plus')?'subscriber':'free',csrf_token_hash:digest(csrf)};
const members=createMemberHandler({config:{origin},store:{ready:async()=>true,session:async raw=>raw===session?member:null},log:console.error});
const server=createServer({members,goldPrice:async()=>({}),log:console.error}),handler=server.listeners('request')[0];
server.removeAllListeners('request');
server.on('request',(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Preview only. No account changes.');return;}
  req.headers.cookie=`__Host-gold-member=${session}; __Host-gold-form=${csrf}`;
  return handler(req,res);
});
server.listen(4333,'127.0.0.1',()=>console.log(`Fictional account preview: ${origin}/account/`));
