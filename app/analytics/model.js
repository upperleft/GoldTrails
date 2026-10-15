import {createHash} from 'node:crypto';
export const migration='010_site_analytics';
export const retentionDays=90;
export const hash=value=>createHash('sha256').update('gold-trails-usage-v1|'+value).digest('hex');
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export function publicPath(value){
 if(typeof value!=='string'||value.length>250||!/^\/(?:[a-z0-9-]+\/)*$/.test(value))return null;
 if(/^\/(?:admin|api|account|signup|login|logout|forgot-password|reset-password|verify-email|resend-verification|calendar|compass|dashboard-preview|privacy|suggestions)(?:\/|$)/.test(value))return null;
 return value;
}
export function targetUrl(value,origin){
 if(typeof value!=='string'||value.length>1500)return null;
 try{
  const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.origin===origin||/@|%40/i.test(u.pathname)||u.pathname.length>700)return null;
  const video=/^(?:www\.)?(?:youtube\.com|youtu\.be)$/.test(u.hostname);
  const out=new URL(u.origin+u.pathname);if(video){const id=u.searchParams.get('v'),t=u.searchParams.get('t')||u.searchParams.get('start');if(id&&/^[\w-]{11}$/.test(id))out.searchParams.set('v',id);if(t&&/^\d{1,6}(?:s|m\d{1,2}s?)?$/.test(t))out.searchParams.set('t',t);}
  return out.href;
 }catch{return null;}
}
export function referrerHost(value,origin){
 if(!value)return 'Direct / unknown';
 try{const u=new URL(value.includes('://')?value:'https://'+value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.origin===origin||u.hostname.length>180||!/^[-a-z0-9.]+$/i.test(u.hostname)||/^\d+(?:\.\d+){3}$/.test(u.hostname))return 'Direct / unknown';return u.hostname.replace(/^www\./,'').toLowerCase();}catch{return 'Direct / unknown';}
}
export function validateEvent(input,origin){
 const keys=['version','consent','id','visitor','session','type','page','target','referrer','device'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k))||input.version!==1||input.consent!==true||![input.id,input.visitor,input.session].every(v=>typeof v==='string'&&uuid.test(v))||!['pageview','outbound'].includes(input.type)||!publicPath(input.page)||!['desktop','tablet','mobile'].includes(input.device))throw new Error('Invalid usage event');
 const target=input.type==='outbound'?targetUrl(input.target,origin):'';
 if(input.type==='outbound'&&!target||input.type==='pageview'&&input.target||typeof input.referrer!=='string'||input.referrer.length>300)throw new Error('Invalid usage destination');
 return {id:input.id.toLowerCase(),visitor:hash(input.visitor.toLowerCase()),session:hash(input.session.toLowerCase()),type:input.type,page:input.page,target,referrer:referrerHost(input.referrer,origin),device:input.device};
}
export function dateRange(params,now=new Date()){
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 const iso=d=>d.toISOString().slice(0,10),day=86400000;
 const days=Number(params.get('days')||30);let from=params.get('from')||'',to=params.get('to')||'';
 if(![7,30,90].includes(days))throw new Error('Choose 7, 30 or 90 days.');
 if(!from&&!to){to=iso(end);from=iso(new Date(+end-(days-1)*day));}
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&iso(new Date(s))===s;
 if(!valid(from)||!valid(to)||from>to||to>iso(end)||from<iso(new Date(+end-89*day)))throw new Error('Choose dates within the most recent 90 days.');
 return {from,to,until:iso(new Date(Date.parse(to)+day)),days:Math.floor((Date.parse(to)-Date.parse(from))/day)+1};
}
const n=v=>Number(v||0);
export function summarizeEvents(events,range){
 const rows=events.filter(e=>e.created_at>=range.from&&e.created_at<range.until),views=rows.filter(e=>e.type==='pageview'),clicks=rows.filter(e=>e.type==='outbound');
 const distinct=(r,k)=>new Set(r.map(e=>e[k])).size,groups=(r,key)=>{const map=new Map();for(const e of r){const k=key(e);if(!map.has(k))map.set(k,[]);map.get(k).push(e);}return [...map];};
 const firstSeen=new Map();for(const e of events)if(!firstSeen.has(e.visitor)||e.created_at<firstSeen.get(e.visitor))firstSeen.set(e.visitor,e.created_at);
 const visitorSet=new Set(views.map(e=>e.visitor)),sessions=new Set(views.map(e=>e.session));
 return {views:views.length,visitors:visitorSet.size,sessions:sessions.size,clicks:clicks.length,clickSessions:new Set(clicks.filter(e=>sessions.has(e.session)).map(e=>e.session)).size,returning:[...visitorSet].filter(v=>firstSeen.get(v)<range.from).length,
  pages:groups(views,e=>e.page).map(([page,r])=>({page,views:r.length,visitors:distinct(r,'visitor'),clicks:clicks.filter(e=>e.page===page).length})).sort((a,b)=>b.views-a.views||a.page.localeCompare(b.page)),
  destinations:groups(clicks,e=>e.target).map(([target,r])=>({target,clicks:r.length,visitors:distinct(r,'visitor')})).sort((a,b)=>b.clicks-a.clicks||a.target.localeCompare(b.target)),
  referrals:groups(views,e=>e.referrer).map(([referrer,r])=>({referrer,views:r.length,sessions:distinct(r,'session')})).sort((a,b)=>b.sessions-a.sessions),devices:groups(views,e=>e.device).map(([device,r])=>({device,views:r.length})),
  days:groups(rows,e=>e.created_at.slice(0,10)).map(([date,r])=>({date,views:r.filter(e=>e.type==='pageview').length,visitors:distinct(r.filter(e=>e.type==='pageview'),'visitor'),clicks:r.filter(e=>e.type==='outbound').length})).sort((a,b)=>a.date.localeCompare(b.date))};
}
export function reportNumbers(row){return Object.fromEntries(Object.entries(row||{}).map(([k,v])=>[k,typeof v==='bigint'?n(v):v]));}
