import { timingSafeEqual } from 'node:crypto';
import { escapeHtml as h, safeUrl, page } from './directory-views.js';
import { verifyPassword, readCookie, sessionCookie } from './admin-auth.js';
import { EditConflict } from './admin-store.js';
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const platforms=['YouTube','Facebook','Instagram','website','podcast','other'];
export class FormError extends Error {}
const val=(f,k,max,required=false) => {
 const s=(f.get(k)||'').trim();
 if (s.length>max || (required&&!s)) throw new FormError(`Check ${k}: ${required?'a value is required; ':''}maximum ${max} characters.`);
 return s||null;
};
const urlValue=(f,k,required=false)=>{const s=val(f,k,2048,required);if(s&&!safeUrl(s)) throw new FormError('Use a full http:// or https:// link without a username or password.');return s;};
export function creatorInput(f,id=null) {
 const result={id,name:val(f,'name',180,true),slug:val(f,'slug',160,true),nickname:val(f,'nickname',180),introduction:val(f,'introduction',500),biography:val(f,'biography',12000),country:val(f,'country',2),province:val(f,'province',180),region:val(f,'region',36),instructionDescription:val(f,'instructionDescription',4000),status:f.get('status'),version:Number(f.get('version')),channels:[]};
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug)||result.slug==='jack-riverbend-morgan')throw new FormError('Use a unique lowercase route with words separated by hyphens.');
 if(result.country&&!/^[A-Z]{2}$/.test(result.country))throw new FormError('Use a two-letter uppercase country code.');
 if(result.region&&!uuid.test(result.region))throw new FormError('Choose a listed region.');
 if(!['draft','published'].includes(result.status)||!Number.isSafeInteger(result.version)||result.version<0)throw new FormError('Check publication status and revision.');
 result.roles=[];result.topics=[];
 if(f.get('taxonomy')!=='1')throw new FormError('Reload the editor to use the current form.');
 for(const [key,value] of f){
  if(!key.startsWith('role_')&&!key.startsWith('topic_'))continue;
  const prefix=key.startsWith('role_')?'role_':'topic_',id=key.slice(prefix.length);
  if(!uuid.test(id)||value!=='1')throw new FormError('Choose valid roles and topics.');
  const target=prefix==='role_'?result.roles:result.topics;target.push(id);
  if(target.length>100)throw new FormError('Too many selections.');
 }
 const since=val(f,'since',4);result.since=since?Number(since):null;
 if(since&&(!/^\d{4}$/.test(since)||result.since<1800||result.since>new Date().getUTCFullYear()))throw new FormError('Use a factual year between 1800 and the current year, or leave it blank.');
 const ins=f.get('instruction');if(!['','yes','no'].includes(ins))throw new FormError('Choose an instruction option.');result.instruction=ins===''?null:ins==='yes'?1:0;
 const count=Number(f.get('channelCount'));if(!Number.isInteger(count)||count<1||count>31)throw new FormError('Invalid channel form.');
 const seen=new Set();
 for(let i=0;i<count;i++) {
  const prefix=`c${i}_`,cid=val(f,prefix+'id',36),name=val(f,prefix+'name',180),url=urlValue(f,prefix+'url'),description=val(f,prefix+'description',2000),platform=f.get(prefix+'platform'),status=f.get(prefix+'status');
  if(!cid&&!name&&!url&&!description)continue;
  if(!name||!url||!platforms.includes(platform)||!['draft','published'].includes(status)||cid&&(!uuid.test(cid)||seen.has(cid)))throw new FormError('Each channel needs a name, valid link, platform and status.');
  if(cid)seen.add(cid);result.channels.push({id:cid,name,url,description,platform,status});
 }
 result.source=urlValue(f,'source');result.sourceTitle=val(f,'sourceTitle',255);result.sourceNote=val(f,'sourceNote',2000);
 if(result.source&&(!result.sourceTitle||!result.sourceNote))throw new FormError('Add a source title and explain which biography facts it supports.');
 if(!result.source&&(result.sourceTitle||result.sourceNote))throw new FormError('Add the source link or clear the new source fields.');
 if(result.status==='published'&&(!result.introduction||!result.biography))throw new FormError('Published profiles need an introduction and biography.');
 return result;
}
const hidden=(name,value)=>`<input type="hidden" name="${name}" value="${h(value)}">`;
const field=(name,label,value='',max=180,type='text')=>`<label>${label}<input name="${name}" type="${type}" maxlength="${max}" value="${h(value??'')}"></label>`;
const area=(name,label,value='',max=12000)=>`<label>${label}<textarea name="${name}" maxlength="${max}" rows="5">${h(value??'')}</textarea></label>`;
const select=(name,label,values,current)=>`<label>${label}<select name="${name}">${values.map(([v,l])=>`<option value="${h(v)}"${v===String(current??'')?' selected':''}>${h(l)}</option>`).join('')}</select></label>`;
const csrf=s=>hidden('csrf',s.csrf_token);
const frame=(title,content)=>page(title,'Private Gold Trails creator workspace',content,'<section class="panel related"><h2>Editor’s trail</h2><a href="/admin/creators/">Manage creators</a><a href="/prospectors/">Public directory</a><a href="/">Gold Trails home</a><p>Unknown information stays blank and appears as TBD. Creator roles do not grant access to this workspace.</p></section>','A quiet place to keep the campfire’s knowledge in good order.').replace('class="category-page"','class="category-page admin-page"').replace('GOLD TRAILS / PROSPECTOR DIRECTORY','GOLD TRAILS / CREATOR WORKSPACE');
const logout=s=>`<form method="post" action="/admin/logout/">${csrf(s)}<button type="submit">Sign out</button></form>`;
function login(s,error='') {return frame('Administrator sign-in',`<section class="resource-placeholder"><h2>Welcome back to camp</h2>${error?`<p role="alert">${h(error)}</p>`:''}<form class="admin-form" method="post" action="/admin/login/">${csrf(s)}<label>Username<input name="username" autocomplete="username" maxlength="180" required></label><label>Password<input type="password" name="password" autocomplete="current-password" maxlength="128" required></label><button class="gold-button">Sign in</button></form></section>`);}
function listing(rows,s) {return frame('Creator workspace',`${logout(s)}<section class="resource-placeholder"><h2>Keep the campfire growing</h2><a class="gold-button" href="/admin/creators/new/">Add a creator</a><p>Drafts stay private. Archived profiles are preserved. Showing up to 500 creators.</p><ul class="admin-list">${rows.map(p=>`<li><a href="/admin/creators/${h(p.id)}/">${h(p.display_name)}</a> <span>${p.archived_at?'Archived':h(p.publication_status)}</span></li>`).join('')||'<li>No creators yet.</li>'}</ul></section>`);}
function editor(p,regions,taxonomy,s,notice='') {
 const isNew=!p.id,archived=Boolean(p.archived_at),path=isNew?'/admin/creators/new/':`/admin/creators/${p.id}/`;
 const channels=[...(p.channels||[]),{platform:'YouTube',publication_status:'published'}];
 const checks=(type,items,selected)=>items.map(item=>`<label class="taxonomy-option"><input type="checkbox" name="${type}_${h(item.id)}" value="1"${selected.includes(item.id)?' checked':''}><span>${h(item.name)}</span></label>`).join('');
 const classification=`<div class="editor-pane editor-taxonomy">${hidden('taxonomy','1')}<h3>Creator roles</h3><p class="editor-help">Public descriptions only; these do not grant site access.</p><fieldset><legend>Choose all that apply</legend>${checks('role',taxonomy.roles,(p.roles||[]).map(r=>r.id))}</fieldset><h3>Topics covered</h3><p class="editor-help">Connect this creator to profiles and topic searches.</p><fieldset><legend>Content topics</legend>${checks('topic',taxonomy.topics,(p.topics||[]).map(t=>t.id))}</fieldset></div>`;
 if(channels.length>31)throw new Error('Channel limit exceeded');
 return frame(isNew?'Add a creator':`Edit ${p.display_name}`,`<div class="editor-toolbar"><nav aria-label="Editor navigation"><a href="/">Gold Trails home</a><a href="/admin/creators/">Creator list</a></nav>${logout(s)}</div>${notice?`<p role="status">${h(notice)}</p>`:''}<section class="resource-placeholder"><h2>${archived?'Archived profile':'Profile details'}</h2>${!isNew?`<a href="/prospectors/${h(p.slug)}/">View public profile</a>`:''}${archived?`<p>Restore this creator as a draft before editing.</p>`:`<form class="admin-form creator-form" method="post" action="${path}">${csrf(s)}${hidden('version',p.edit_version||0)}<div class="editor-pane editor-profile"><h3>Profile</h3><div class="editor-field-grid">${field('name','Display name',p.display_name)}${field('slug','Page route',p.slug,160)}<p class="editor-help">Route changes alter the public address. Edited facts return to “Sources pending.”</p>${field('nickname','Also known as',p.nickname)}${field('introduction','Short introduction',p.short_introduction,500)}${area('biography','Biography',p.biography)}${field('country','Country code (CA, US, etc.)',p.country_code,2)}${field('province','State / province',p.state_province)}${select('region','Primary region',[['','TBD'],...regions.map(r=>[r.id,r.name])],p.primary_region_id)}${field('since','Prospecting since (year)',p.experience_since_year,4)}${select('instruction','Offers instruction',[['','TBD'],['yes','Yes'],['no','No']],p.offers_instruction===null||p.offers_instruction===undefined?'':p.offers_instruction?'yes':'no')}${area('instructionDescription','Instruction details',p.instruction_description,4000)}${select('status','Publication status',[['draft','Draft — private'],['published','Published — visible in directory']],p.publication_status||'draft')}</div></div><div class="editor-pane editor-links"><h3>Channels &amp; sources</h3><p class="editor-help">Add one new channel per save. Draft links stay private.</p>${hidden('channelCount',channels.length)}${channels.map((ch,i)=>`<fieldset><legend>${ch.id?'Existing channel':'Add another channel (optional)'}</legend>${hidden(`c${i}_id`,ch.id||'')}${select(`c${i}_platform`,'Platform',platforms.map(v=>[v,v]),ch.platform)}${field(`c${i}_name`,'Channel name',ch.channel_name)}${field(`c${i}_url`,'Link',ch.canonical_url,2048,'url')}${area(`c${i}_description`,'Link notes',ch.description,2000)}${select(`c${i}_status`,'Link visibility',[['draft','Draft'],['published','Published']],ch.publication_status||'published')}</fieldset>`).join('')}<div class="editor-field-grid source-fields"><h3>Biography source (optional)</h3>${field('sourceTitle','Source title','',255)}${field('source','Source URL','',2048,'url')}${area('sourceNote','Which biography facts does this support?','',2000)}</div></div>${classification}<div class="editor-save"><p>Blank fields appear as TBD.</p><button class="gold-button">Save profile</button></div></form>`}<details class="editor-sources"><summary>Existing sources</summary><ul>${(p.sources||[]).map(r=>`<li>${safeUrl(r.canonical_url)?`<a href="${h(safeUrl(r.canonical_url))}" rel="noopener noreferrer">${h(r.title)}</a>`:h(r.title)}</li>`).join('')||'<li>No source references added yet.</li>'}</ul></details>${!isNew?`<form class="admin-form editor-archive" method="post" action="${path}${archived?'restore':'archive'}/">${csrf(s)}${hidden('version',p.edit_version)}<p>${archived?'Restore as a private draft.':'Archive hides the profile and preserves its records.'}</p><button>${archived?'Restore as draft':'Archive profile'}</button></form>`:''}</section>`).replace('category-page admin-page','category-page admin-page admin-editor');
}
async function body(req) {
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw new FormError('Unsupported form');
 let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536)throw new FormError('Form too large');chunks.push(chunk);}
 const f=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
 const keys=new Set();for(const key of f.keys()){if(keys.has(key))throw new FormError('Duplicate form field');keys.add(key);}
 return f;
}
export function createAdminHandler({store,config,log=console.error}) {
 return async(req,res,url)=>{
  if(url.pathname!=='/admin'&&!url.pathname.startsWith('/admin/'))return false;
  const send=(status,html,extra={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",...extra});res.end(req.method==='HEAD'?undefined:html);};
  const redirect=path=>send(303,'',{'Location':path});
  const raw=readCookie(req);let s,f;
  try {
   if(!store||!config){send(503,frame('Workspace being prepared','<section class="resource-placeholder"><h2>Administrator setup is pending</h2><p>The public directory remains available.</p></section>'));return true;}
   if(!['GET','HEAD','POST'].includes(req.method)){send(405,'Method not allowed',{Allow:'GET, HEAD, POST'});return true;}
   s=await store.session(raw);
   if(req.method==='POST') {
    if(req.headers.origin!==config.origin){send(403,frame('Form expired','<p>Return to the workspace and try again.</p>'));return true;}
    f=await body(req);
    const t=f.get('csrf')||'';
    if(!s||!/^[a-f0-9]{64}$/.test(t)||!timingSafeEqual(Buffer.from(t),Buffer.from(s.csrf_token))){send(403,frame('Form expired','<p>Sign in again to continue.</p>'));return true;}
   }
   if(url.pathname==='/admin/login/') {
    if(req.method==='POST') {
     if(!await store.allowLogin()){send(429,login(s,'Please wait 15 minutes before trying again.'),{'Retry-After':'900'});return true;}
     const password=f.get('password')||'';
     const verified=await verifyPassword(password,config.passwordHash);
     if(f.get('username')!==config.username||!verified){send(401,login(s,'Sign-in details were not recognized.'));return true;}
     await store.logout(raw);const fresh=await store.newSession(true);
     send(303,'',{'Location':'/admin/creators/','Set-Cookie':sessionCookie(fresh.raw)});return true;
    }
    if(s?.authenticated){redirect('/admin/creators/');return true;}
    if(!s){s=await store.newSession(false);send(200,login(s),{'Set-Cookie':sessionCookie(s.raw,900)});}else send(200,login(s));return true;
   }
   if(!s?.authenticated){redirect('/admin/login/');return true;}
   if(url.pathname==='/admin/logout/'&&req.method==='POST'){await store.logout(raw);send(303,'',{'Location':'/admin/login/','Set-Cookie':sessionCookie('',0)});return true;}
   if(url.pathname==='/admin/'||url.pathname==='/admin'){redirect('/admin/creators/');return true;}
   if(url.pathname==='/admin/creators/'&&req.method!=='POST'){send(200,listing(await store.list(),s));return true;}
   const match=url.pathname.match(/^\/admin\/creators\/(new|[a-f0-9-]{36})\/(?:(archive|restore)\/)?$/);
   if(!match||match[1]!=='new'&&!uuid.test(match[1])){send(404,frame('Trail not found','<p>That workspace page is unavailable.</p>'));return true;}
   const id=match[1]==='new'?null:match[1];
   if(match[2]) {
    if(req.method!=='POST'||!id){send(405,'Use the profile form.');return true;}
    const version=Number(f.get('version'));if(!Number.isSafeInteger(version)||version<0)throw new FormError('Invalid revision');
    await store.archive(id,version,match[2]==='restore',config.username);redirect(`/admin/creators/${id}/`);return true;
   }
   if(req.method==='POST'){const saved=await store.save(creatorInput(f,id),config.username);redirect(`/admin/creators/${saved}/?saved=1`);return true;}
   const p=id?await store.get(id):{};
   if(!p){send(404,frame('Creator not found','<p>Return to the creator list.</p>'));return true;}
   send(200,editor(p,await store.regions(),await store.taxonomy(),s,url.searchParams.get('saved')==='1'?'Profile saved.':''));
  } catch(e) {
   if(e instanceof FormError)send(400,frame('Check the form',`<p role="alert">${h(e.message)}</p><p>Use your browser’s Back button to correct the form.</p>`));
   else if(e instanceof EditConflict)send(409,frame('Another edit came first','<p>Reload the profile before saving again. Your changes were not applied.</p>'));
   else if(e.code==='ER_DUP_ENTRY')send(409,frame('That route is already in use','<p>Choose a different page route. Your changes were not applied.</p>'));
   else {log('Gold Trails administrator request unavailable');send(503,frame('Workspace temporarily unavailable','<p>Please try again shortly. Your public site remains available.</p>'));}
  }
  return true;
 };
}
