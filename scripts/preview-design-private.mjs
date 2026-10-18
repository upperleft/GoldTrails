// Loopback-only visual QA: fictional accounts and in-memory data, no production services.
// Only temporary calendar view preferences can change in memory. No event/account writes,
// email, payments, production connections, or real member records are available.
import {createServer} from '../app/server.js';
import {createMemberHandler} from '../app/members.js';
import {createCalendarHandler} from '../app/calendar/handler.js';
import {createHomepageHandler} from '../app/homepage/handler.js';
import {createConnectionsHandler} from '../app/connections/handler.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createAlmanacCreators} from '../app/almanac/creators.js';
import {meetingVault} from '../app/connections/model.js';
import {calendarMemoryStore} from '../tests/helpers/calendar-memory.js';
import {memoryConnections,accounts,tokens,csrf} from './fixtures/connections-memory.mjs';

const port=Number(process.env.DESIGN_PREVIEW_PORT||4346),origin=`http://127.0.0.1:${port}`;
const role=process.env.DESIGN_PREVIEW_ROLE==='subscriber'?'member':'free';
const identity={...accounts[role],display_name:'Alex',email:'alex@example.invalid',account_number:42};
const memberSessions={ready:async()=>true,session:async raw=>raw===tokens[role]?identity:null};
const config={origin,open:true},mail=async()=>{throw Error('Mail is disabled in this read-only preview.');};
const members=createMemberHandler({config,store:memberSessions,mail});
const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
const calendarStore=calendarMemoryStore();
const personal=await calendarStore.createCalendar(identity.id,{name:'Sample outings',color:'#37645b'});
await calendarStore.createEvent(identity.id,{calendarId:personal.id,title:'Sample creek outing',description:'Fictional preview entry; not a real event.',location:'Sample location',startLocal:'2026-10-22T10:00',endLocal:'2026-10-22T12:00',timeZone:'America/New_York',allDay:false,rrule:null});
const vault=meetingVault('ab'.repeat(32)),connectionsStore=memoryConnections({vault});
const server=createServer({members,memberSessions,directory,
 calendar:createCalendarHandler({members:memberSessions,store:calendarStore,config}),
 almanac:createAlmanacHandler({members:memberSessions,creators:createAlmanacCreators(directory)}),
 connections:createConnectionsHandler({members:memberSessions,store:connectionsStore,config,vault,calendarStore}),
 homepage:createHomepageHandler({members:memberSessions,config}),goldPrice:async()=>({})});
const handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 const viewPreference=req.method==='POST'&&req.url.split('?')[0]==='/calendar/api/preferences';
 if(!['GET','HEAD'].includes(req.method)&&!viewPreference){res.writeHead(405,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Local preview. Event and account changes are disabled.'}));return;}
 // Keep the public signup/login forms inspectable without establishing a browser session.
 if(!/^\/(?:signup|login|forgot-password|resend-verification)\//.test(req.url))req.headers.cookie=`__Host-gold-member=${tokens[role]}; __Host-gold-form=${csrf}`;
 return handler(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log(`Read-only design QA (${identity.effective_level}, fictional data): ${origin}/`));
