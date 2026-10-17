import {assetUrl} from '../asset-url.js';
import {plusPage,donationPage,supportSidebar} from './views.js';
export function plusMarkup(html){
 if(typeof html!=='string'||html.includes('data-plus-support'))return html;
 const side=/<aside\b[^>]*class="[^"]*\bleft\b[^"]*"[^>]*>[\s\S]*?<\/aside>/;
 if(!side.test(html))return html;
 const includeConnections=!/<body\b[^>]*\bdata-camp-membership="free"/.test(html);
 const result=html.replace(side,match=>match.replace('</aside>',supportSidebar({includeConnections})+'</aside>'));
 return result.includes('/plus.css?')?result:result.replace('</head>',`<link rel="stylesheet" href="${assetUrl('plus.css')}"></head>`);
}
export function attachPlusMarkup(req,res,url){
 if(!['GET','HEAD'].includes(req.method)||/^\/(?:admin|api)(?:\/|$)/.test(url.pathname))return;
 const end=res.end.bind(res),writeHead=res.writeHead.bind(res);let type='';
 res.writeHead=function(status,message,headers){const supplied=typeof message==='object'?message:headers;type=String(Object.entries(supplied||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');if(type.includes('text/html')){res.removeHeader('Content-Length');if(supplied)for(const k of Object.keys(supplied))if(k.toLowerCase()==='content-length')delete supplied[k];}return typeof message==='string'?writeHead(status,message,headers):writeHead(status,message);};
 res.end=function(chunk,encoding,callback){if(type.includes('text/html')&&chunk){const html=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk);chunk=Buffer.from(plusMarkup(html));}return end(chunk,encoding,callback);};
}
// Payment routes deliberately cannot charge. A real provider must be configured,
// verified in test mode, and separately approved before this gate is changed.
export function createPlusHandler(){return async(req,res,url)=>{
 const routes=['/plus/','/donate/','/billing/subscribe/','/billing/donate/','/billing/manage/','/billing/webhook/'];
 if(!routes.includes(url.pathname)&&!['/plus','/donate'].includes(url.pathname))return false;
 const send=(status,html,headers={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(req.method==='HEAD'?undefined:html);};
 if(url.pathname.startsWith('/billing/')){send(503,'<!doctype html><html lang="en"><meta charset="utf-8"><title>Payments are not open — Gold Trails</title><h1>Payments are not open yet</h1><p>No payment has been created or confirmed. <a href="/plus/">Return to Gold Trails Plus</a>.</p></html>');return true;}
 if(!['GET','HEAD'].includes(req.method)){send(405,'Use GET or HEAD.',{Allow:'GET, HEAD'});return true;}
 if(!url.pathname.endsWith('/')){send(308,'',{Location:url.pathname+'/'});return true;}
 send(200,url.pathname==='/plus/'?plusPage():donationPage());return true;
};}
