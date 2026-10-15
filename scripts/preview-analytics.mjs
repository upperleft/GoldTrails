// Local-only synthetic fixture. Never use this as the deployment entry point.
import {randomUUID} from 'node:crypto';
import {createServer} from '../app/server.js';
import {createAdminHandler} from '../app/admin.js';
import {createAnalyticsHandler} from '../app/analytics/handler.js';
import {validateEvent} from '../app/analytics/model.js';
import {analyticsMemory} from '../tests/helpers/analytics-memory.js';
const port=Number(process.env.ANALYTICS_PREVIEW_PORT||4323),origin='http://127.0.0.1:'+port;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a local preview port.');
const store=analyticsMemory(),visitors=Array.from({length:8},()=>randomUUID());
for(let days=5;days>=0;days--)for(let i=0;i<days+3;i++){
 const base={version:1,consent:true,id:randomUUID(),visitor:visitors[i%8],session:randomUUID(),type:'pageview',page:i%2?'/articles/where-gold-settles/':'/gold-almanac/',target:'',referrer:i%3?'https://www.youtube.com/':'',device:i%2?'mobile':'desktop'};
 const created_at=new Date(Date.now()-days*86400000-300000).toISOString();store.events.push({...validateEvent(base,origin),created_at});
 if(i%2)store.events.push({...validateEvent({...base,id:randomUUID(),type:'outbound',target:'https://www.youtube.com/watch?v=abcdefghijk&t=42s'},origin),created_at});
}
const admin=createAdminHandler({store:{session:async()=>({authenticated:1,csrf_token:'b'.repeat(64)})},config:{origin,username:'Local preview'},analyticsStore:store,log:()=>{}});
const handler=async(req,res,url)=>{
 if(url.pathname.startsWith('/admin/')){const end=res.end.bind(res);res.end=(body,...args)=>end(typeof body==='string'&&url.pathname.endsWith('/export/')?'"LOCAL DEMONSTRATION: synthetic events, not production traffic"\r\n'+body:typeof body==='string'?body.replace('<h2>Traffic &amp; clicks</h2>','<h2>Traffic &amp; clicks</h2><p class="usage-notice">LOCAL DEMONSTRATION — synthetic events, not production traffic. Owner authorization is simulated only in this loopback fixture.</p>'):body,...args);}
 return admin(req,res,url);
};
const server=createServer({analytics:createAnalyticsHandler({store,origin,log:()=>{}}),admin:handler,goldPrice:async()=>{throw new Error('No preview price feed');},log:()=>{}});
server.listen(port,'127.0.0.1',()=>console.log('Local analytics preview: '+origin+'/admin/analytics/'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
