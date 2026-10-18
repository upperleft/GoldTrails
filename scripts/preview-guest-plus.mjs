// Isolated read-only guest invitation preview. Fictional events, no real accounts/database/mail.
import {createHash} from 'node:crypto';
import {createServer} from '../app/server.js';
import {createGuestPlusAccess} from '../app/plus/guest-access.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createAlmanacCreators} from '../app/almanac/creators.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {meetingVault} from '../app/connections/model.js';
import {memoryConnections} from './fixtures/connections-memory.mjs';

const origin='http://127.0.0.1:4343',raw='1'.repeat(64);
const guests=createGuestPlusAccess({passes:[{id:'fictional-preview',label:'Local preview only',tokenHash:createHash('sha256').update(raw).digest('hex'),expiresAt:new Date(Date.now()+86400000).toISOString()}],origin});
const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
const vault=meetingVault('ab'.repeat(32)),store=memoryConnections({vault}),originalList=store.list;
// The isolated fixture predates the production store's explicit read-only option.
store.list=(filters,member,options={})=>originalList(filters,options.canReadPlus?{effective_level:'subscriber'}:member);
store.events.values().next().value.visibility='plus';
const connections=createConnectionsHandler({store,guests,vault,config:{origin},log:console.error});
const server=createServer({guests,homepage:createHomepageHandler(),directory,connections,almanac:createAlmanacHandler({guests,creators:createAlmanacCreators(directory)}),goldPrice:async()=>({}),log:console.error});
const regular=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)&&req.url!=='/plus/guest/leave/'){res.writeHead(405);res.end('Read-only local preview.');return;}
 return regular(req,res);
});
server.listen(4343,'127.0.0.1',()=>console.log('Fictional guest Plus preview: '+origin+'/plus/guest/?pass='+raw));
