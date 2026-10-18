// Read-only loopback preview. No production accounts, database, email or payment access.
import {createServer} from '../app/server.js';
import {createMemberHandler} from '../app/members.js';
import {createCalendarHandler} from '../app/calendar/handler.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {digest} from '../app/admin-auth.js';
const port=Number(process.env.DESIGN_PREVIEW_PORT||4344),origin=`http://127.0.0.1:${port}`;
const token='b'.repeat(64),csrf='a'.repeat(64);
const level=process.env.DESIGN_PREVIEW_ROLE==='subscriber'?'subscriber':'free';
const member={id:42,username:'TrailReader',display_name:'Alex',email:'alex@example.invalid',account_number:42,effective_level:level,csrf_token_hash:digest(csrf)};
const store={ready:async()=>true,session:async raw=>raw===token?member:null};
const members=createMemberHandler({config:{origin},store,log:console.error});
const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
const server=createServer({members,memberSessions:store,directory,almanac:createAlmanacHandler({members:store,store:async()=>({})}),calendar:createCalendarHandler({members:null,store:null,config:null}),connections:createConnectionsHandler(),homepage:createHomepageHandler({members:store,config:{origin}}),goldPrice:async()=>({}),log:console.error});
const handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only preview. No changes saved.');return;}
 if(level==='subscriber'||req.url.split('?')[0]==='/account/')req.headers.cookie=`__Host-gold-member=${token}; __Host-gold-form=${csrf}`;
 return handler(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log(`Read-only design preview (${level} account): ${origin}/`));
