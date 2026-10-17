// Read-only loopback preview; fictional account and public catalog only.
import {createServer} from '../app/server.js';
import {createMemberHandler} from '../app/members.js';
import {createCompassHandler} from '../app/compass/handler.js';
import {createCalendarHandler} from '../app/calendar/handler.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {digest} from '../app/admin-auth.js';
const token='b'.repeat(64),csrf='a'.repeat(64),origin='http://127.0.0.1:4335';
const member={username:'TrailReader',display_name:'Alex',email:'alex@example.invalid',account_number:42,effective_level:'free',csrf_token_hash:digest(csrf)};
const members=createMemberHandler({config:{origin},store:{ready:async()=>true,session:async raw=>raw===token?member:null},log:console.error});
const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
const server=createServer({members,directory,compass:createCompassHandler({}),calendar:createCalendarHandler({members:null,store:null,config:null}),homepage:createHomepageHandler(),goldPrice:async()=>({}),log:console.error});
const handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only preview. No account changes.');return;}
 if(req.url.split('?')[0]==='/account/')req.headers.cookie=`__Host-gold-member=${token}; __Host-gold-form=${csrf}`;
 return handler(req,res);
});
server.listen(4335,'127.0.0.1',()=>console.log(`Read-only reading-options preview: ${origin}/`));
