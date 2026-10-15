import {randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {assetUrl} from './asset-url.js';
import {page,escapeHtml as h} from './directory-views.js';
import {publicPath} from './analytics/model.js';

const migration='011_reader_suggestions';
const idPattern=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function createSuggestionStore(db){
 let checked=0,available=false;
 return {
  async ready(){if(Date.now()-checked>30000){available=(await db.query('SELECT version FROM schema_migrations WHERE version=?',[migration])).length===1;checked=Date.now();}return available;},
  async submit({id,message,path}){await db.query('INSERT IGNORE INTO reader_suggestions(id,message,page_path) VALUES(?,?,?)',[id,message,path]);},
  async list(status='new'){return db.query('SELECT id,message,page_path,status,created_at FROM reader_suggestions WHERE status=? ORDER BY created_at DESC,id LIMIT 100',[status]);},
  async review(id,status){await db.query('UPDATE reader_suggestions SET status=? WHERE id=?',[status,id]);},
 };
}
export function suggestionInbox(rows,session,status='new'){
 return `<section class="resource-placeholder"><h2>Reader suggestions</h2><p>Private messages from the suggestion box. Showing the latest 100 ${status==='new'?'new':'reviewed'} suggestions. Suggestions are reader opinions, not verified facts.</p><nav aria-label="Suggestion status"><a href="/admin/suggestions/">New</a> · <a href="/admin/suggestions/?status=reviewed">Reviewed</a></nav>${rows.map(r=>`<article class="reader-suggestion"><p>${h(String(r.created_at))} · ${r.page_path?`From <a href="${h(r.page_path)}">${h(r.page_path)}</a>`:'General suggestion'}</p><p class="suggestion-message">${h(r.message)}</p><form method="post" action="/admin/suggestions/"><input type="hidden" name="csrf" value="${h(session.csrf_token)}"><input type="hidden" name="id" value="${h(r.id)}"><input type="hidden" name="status" value="${status==='new'?'reviewed':'new'}"><button>${status==='new'?'Mark reviewed':'Move back to new'}</button></form></article>`).join('')||'<p>No suggestions in this view yet.</p>'}</section>`;
}
export function createSuggestionsHandler({store=null,origin='',log=console.error,now=Date.now}={}){
 // Process-local signed forms: no visitor identifier, account link or tracking cookie.
 const secret=randomBytes(32),sign=value=>createHmac('sha256',secret).update(value).digest('hex');
 let windowStart=now(),attempts=0;
 const token=()=>{const value=randomUUID()+'.'+now();return value+'.'+sign(value);};
 const valid=value=>{if(typeof value!=='string'||value.length>120)return false;const [id,time,mac,...extra]=value.split('.'),payload=id+'.'+time;return !extra.length&&idPattern.test(id)&&/^\d{13}$/.test(time||'')&&/^[a-f0-9]{64}$/.test(mac||'')&&now()-Number(time)>=0&&now()-Number(time)<=3600000&&timingSafeEqual(Buffer.from(mac),Buffer.from(sign(payload)));};
 const form=(path='',message='',error='')=>`${error?`<p role="alert">${h(error)}</p>`:''}<form class="suggestion-form" method="post" action="/suggestions/"><input type="hidden" name="token" value="${token()}"><input type="hidden" name="page" value="${h(path)}"><label>What could we improve?<textarea name="message" rows="3" minlength="5" maxlength="3000" required placeholder="Something missing, confusing, or worth adding?">${h(message)}</textarea></label><div class="suggestion-trap" aria-hidden="true"><label>Leave this blank<input name="website" tabindex="-1" autocomplete="off"></label></div><p>Goes privately to Gold Trails. No login needed. Please leave out passwords and personal details.</p><button type="submit">Send suggestion</button></form>`;
 const shell=(title,body)=>page(title,'Share an idea to improve Gold Trails.',`<section class="resource-placeholder"><h2>${h(title)}</h2>${body}</section>`,'','A better trail starts with a good suggestion.').replace('GOLD TRAILS / PROSPECTOR DIRECTORY','GOLD TRAILS / AROUND THE CAMPFIRE').replace(/<nav class="breadcrumb"[\s\S]*?<\/nav>/,'<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Suggestions</span></nav>').replace('</head>',`<link rel="stylesheet" href="${assetUrl('suggestions.css')}"></head>`);
 const handler=async(req,res,url)=>{
  if(!['/suggestions','/suggestions/'].includes(url.pathname))return false;
  const send=(status,html,headers={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",...headers});res.end(req.method==='HEAD'?undefined:html);};
  if(!['GET','HEAD','POST'].includes(req.method)){send(405,shell('Use the suggestion box','<p>Open a fresh form to send a suggestion.</p>'),{Allow:'GET, HEAD, POST'});return true;}
  if(url.pathname==='/suggestions'){send(308,'',{Location:'/suggestions/'});return true;}
  try{
   if(!store||!await store.ready()){send(503,shell('Suggestion box taking a break','<p>The suggestion box is temporarily unavailable. Please try again later.</p>'));return true;}
   if(req.method!=='POST'){send(200,shell('Suggest an improvement',form()));return true;}
   if(req.headers.origin!==origin||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'){send(403,shell('Open a fresh suggestion box','<p>Please send your suggestion using the form on Gold Trails.</p><a href="/suggestions/">Open the suggestion box</a>'));return true;}
   if(now()-windowStart>60000){windowStart=now();attempts=0;}
   if(++attempts>30){send(429,shell('A short pause','<p>Please try again in a minute.</p>'),{'Retry-After':'60'});return true;}
   if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||'')){send(415,shell('Use the suggestion box','<a href="/suggestions/">Open the form</a>'));return true;}
   let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>40000){send(413,shell('That message is too long','<p>Please keep suggestions to 3,000 characters.</p>'));return true;}chunks.push(chunk);}
   const fields=new URLSearchParams(Buffer.concat(chunks).toString('utf8')),keys=[...fields.keys()];
   if(new Set(keys).size!==keys.length||keys.some(k=>!['token','page','message','website'].includes(k))||!valid(fields.get('token'))){send(403,shell('Open a fresh suggestion box',form('',fields.get('message')?.slice(0,3000)||'','This form expired. Your message has not been saved. Please send it again.')));return true;}
   const message=(fields.get('message')||'').trim(),path=publicPath(fields.get('page'))||'';
   if(message.length<5||message.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message)){send(400,shell('Check your suggestion',form(path,message.slice(0,3000),'Please write a message between 5 and 3,000 characters.')));return true;}
   if(fields.get('website')){send(400,shell('Please use the suggestion box','<a href="/suggestions/">Open a fresh form</a>'));return true;}
   const id=fields.get('token').split('.')[0];await store.submit({id,message,path});
   send(200,shell('Thank you for the suggestion',`<p role="status">Your suggestion has been saved in the private Gold Trails review inbox.</p><p>We appreciate you taking the time to help.</p><a href="${h(path||'/')}">Return to Gold Trails</a>`));return true;
  }catch{log('Gold Trails suggestion box unavailable');send(503,shell('Suggestion not confirmed','<p>We could not confirm that your message was saved. You can use Back and retry the same form without creating a duplicate.</p>'));return true;}
 };
 const route=handler;
 route.attach=(req,res,url)=>{
  if(!['GET','HEAD'].includes(req.method)||!publicPath(url.pathname)||url.pathname==='/suggestions/')return;
  const end=res.end.bind(res),writeHead=res.writeHead.bind(res);let contentType='';
  res.writeHead=function(status,message,headers){const supplied=typeof message==='object'?message:headers;contentType=String(Object.entries(supplied||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||res.getHeader('Content-Type')||'');if(contentType.includes('text/html')){res.removeHeader('Content-Length');if(supplied)for(const k of Object.keys(supplied))if(k.toLowerCase()==='content-length')delete supplied[k];}return typeof message==='string'?writeHead(status,message,headers):writeHead(status,message);};
  res.end=function(chunk,encoding,callback){if(res.statusCode===200&&contentType.includes('text/html')&&chunk){let html=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk);if(html.includes('</footer>'))html=html.replace('</head>',`<link rel="stylesheet" href="${assetUrl('suggestions.css')}"></head>`).replace('</footer>',`<details class="suggestion-box"><summary>Suggest an improvement</summary>${form(url.pathname)}</details></footer>`);chunk=Buffer.from(html);}return end(chunk,encoding,callback);};
 };
 route.enabled=async()=>{try{return Boolean(store&&await store.ready());}catch{return false;}};
 return route;
}
