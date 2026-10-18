// Read-only loopback preview using a fictional Plus member. No database or account changes.
import {createServer} from '../app/server.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createPlusHandler} from '../app/plus/handler.js';

const token='a'.repeat(64);
const members={session:async raw=>raw===token?{effective_level:'subscriber'}:null};
const server=createServer({
 almanac:createAlmanacHandler({members}),
 plus:createPlusHandler({members}),
 goldPrice:async()=>({}),
 log:console.error
});
const regular=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only fictional preview.');return;}
 // This stub exists only in this separate preview process, bound to loopback.
 req.headers.cookie=`__Host-gold-member=${token}`;
 return regular(req,res);
});
server.listen(4342,'127.0.0.1',()=>console.log('Read-only fictional Plus preview: http://127.0.0.1:4342/gold-almanac/california/#communities'));
