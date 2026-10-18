import {readFileSync} from 'node:fs';
import {createHash,timingSafeEqual} from 'node:crypto';
import {page,escapeHtml as h} from '../directory-views.js';
import {assetUrl} from '../asset-url.js';

const cookieName='__Host-gold-plus-guest';
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const cookie=(value,age)=>`${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const excluded=/^\/(?:admin|api|account|calendar|login|signup|logout|forgot-password|reset-password|verify-email|resend-verification|billing)(?:\/|$)/;
const stamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)?Date.parse(value):NaN;

export function createGuestPlusAccess({passes=[],now=Date.now,origin='https://goldtrails.org'}={}){
 const find=raw=>{
  if(!hex(raw))return null;
  const hash=createHash('sha256').update(raw).digest();
  for(const pass of Array.isArray(passes)?passes:[]){
   if(!pass||pass.revoked||!hex(pass.tokenHash)||!Number.isFinite(stamp(pass.expiresAt))||stamp(pass.expiresAt)<=now()||typeof pass.id!=='string'||!/^[a-z0-9-]{1,64}$/.test(pass.id))continue;
   if(timingSafeEqual(hash,Buffer.from(pass.tokenHash,'hex')))return {id:pass.id,label:String(pass.label||'Friends of Gold Trails').slice(0,100),expiresAt:pass.expiresAt};
  }
  return null;
 };
 const read=req=>{
  if(!['GET','HEAD'].includes(req.method))return null;
  const values=String(req.headers.cookie||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(cookieName+'='));
  return values.length===1?find(values[0].slice(cookieName.length+1)):null;
 };
 const handle=async(req,res,url)=>{
  if(!['/plus/guest/','/plus/guest/leave/'].includes(url.pathname))return false;
  const send=(status,body='',headers={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',...headers});res.end(req.method==='HEAD'?undefined:body);};
  if(url.pathname==='/plus/guest/leave/'){
   if(req.method!=='POST'){send(405,'Use Leave preview.',{Allow:'POST'});return true;}
   if(req.headers.origin!==origin){send(403,'Use Leave preview on Gold Trails.');return true;}
   send(303,'',{'Set-Cookie':cookie('',0),Location:'/'});return true;
  }
  if(!['GET','HEAD'].includes(req.method)){send(405,'Open your guest invitation link.',{Allow:'GET, HEAD'});return true;}
  const raw=url.searchParams.get('pass');
  const grant=url.searchParams.size===1&&url.searchParams.getAll('pass').length===1?find(raw):null;
  if(!grant){send(410,page('This guest pass has ended','Ask Paul for a fresh Gold Trails guest invitation.','<section class="resource-placeholder"><h2>Let’s find you a fresh invitation.</h2><p>This invitation has expired or is no longer available. Ask Paul for a new guest link, or explore our free articles, videos and glossary.</p><p><a href="/">Visit Gold Trails →</a></p></section>','','There is still plenty to explore.'));return true;}
  // Keep this browser on the invited trail until the same server-checked pass expires.
  const age=Math.max(1,Math.floor((stamp(grant.expiresAt)-now())/1000));
  send(303,'',{'Set-Cookie':cookie(raw,age),Location:'/'});return true;
 };
 const attach=(req,res,url,{calendarTour=false}={})=>{
  // Only the calendar handler can opt its fictional, read-only HTML tour in.
  // Authenticated personal calendars and every calendar API remain excluded.
  if((excluded.test(url.pathname)&&!(calendarTour&&url.pathname==='/calendar/'))||url.pathname.startsWith('/plus/guest/'))return;
  const grant=read(req);if(!grant)return;
  const end=res.end.bind(res),head=res.writeHead.bind(res);let type='';
  res.writeHead=function(status,message,headers){
   const supplied=typeof message==='object'?message:headers;
   type=String(Object.entries(supplied||{}).find(([key])=>key.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');
   if(type.includes('text/html')){
    // The bearer was removed by the invitation redirect. Preserve Origin on native POST forms.
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Robots-Tag','noindex');res.setHeader('Referrer-Policy','strict-origin');res.removeHeader('Content-Length');
    if(supplied){for(const key of Object.keys(supplied))if(['cache-control','vary','x-robots-tag','referrer-policy','content-length'].includes(key.toLowerCase()))delete supplied[key];}
   }
   return typeof message==='string'?head(status,message,headers):head(status,message);
  };
  res.end=function(chunk,encoding,callback){
   if(type.includes('text/html')&&chunk){
    let html=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk);
    if(!html.includes('data-guest-plus-banner')){
     const expiry=new Date(grant.expiresAt);
     const shortDate=expiry.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'});
     const fullDate=expiry.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'});
     const notice='Read-only guest preview. Event participation requires your own paid account. Access ends '+fullDate+'.';
     const banner=`<aside class="guest-plus-banner" data-guest-plus-banner aria-label="Guest preview"><span class="guest-preview-summary" title="${h(notice)}">Guest preview<span class="guest-preview-detail"> · Read-only</span> · Ends <time datetime="${h(grant.expiresAt)}">${h(shortDate)}</time></span><form method="post" action="/plus/guest/leave/"><button type="submit" aria-label="Leave preview">Leave</button></form></aside>`;
     html=html.replace('</head>',`<link rel="stylesheet" href="${assetUrl('guest-plus.css')}"></head>`).replace(/(<body\b[^>]*>)/,`$1${banner}`);
    }
    chunk=Buffer.from(html);
   }
   return end(chunk,encoding,callback);
  };
 };
 return {read,handle,attach};
}

// Only token hashes are deployed. Removing/revoking a record also invalidates existing guest cookies.
const passes=JSON.parse(readFileSync(new URL('./guest-passes.json',import.meta.url),'utf8'));
export const guestPlusAccess=createGuestPlusAccess({passes,origin:process.env.MEMBER_ORIGIN||'https://goldtrails.org'});
