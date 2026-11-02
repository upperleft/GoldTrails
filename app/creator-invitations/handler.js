import {timingSafeEqual} from 'node:crypto';
import {digest,token} from '../admin-auth.js';
import {CreatorInvitationError} from './model.js';
import {creatorInvitationPage,invitationBody,adminInvitationsView} from './views.js';
import {escapeHtml as h} from '../directory-views.js';
import {creatorInvitationHome} from './context.js';

const validToken=value=>/^[a-f0-9]{64}$/.test(value||'');
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp(`(?:^|;\\s*)__Host-gold-${name}=([a-f0-9]{64})(?:;|$)`))?.[1]||null;
const cookie=(name,value,age=28800)=>`__Host-gold-${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const equal=(a,b)=>validToken(a)&&validToken(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const expires=value=>new Date(value instanceof Date?value:/Z$|[+-]\d\d:\d\d$/.test(String(value))?value:String(value).replace(' ','T')+'Z').getTime();
async function body(req){
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))return null;
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>4096)return null;chunks.push(chunk);}
 const f=new URLSearchParams(Buffer.concat(chunks).toString('utf8')),seen=new Set();
 for(const name of f.keys()){if(seen.has(name))return null;seen.add(name);}
 return f;
}

export function createCreatorInvitationHandler({store=null,members=null,config=null,log=console.error}={}){
 return async(req,res,url)=>{
  // Optional invitation storage must never prevent the public homepage opening.
  // Read only: the homepage welcome cannot accept or otherwise consume a link.
  if(url.pathname==='/'&&['GET','HEAD'].includes(req.method)){
   const raw=read(req,'creator-invite');
   if(raw&&store&&members&&config)try{
    if(await store.ready()&&await store.read(raw))req[creatorInvitationHome]=true;
   }catch{log('Gold Trails homepage invitation check unavailable');}
   return false;
  }
  if(!['/creator-invitation','/creator-invitation/'].includes(url.pathname))return false;
  const csrf=read(req,'form')||token();
  const send=(status,title,content,extra={})=>{
   // Keep Origin available on native form POSTs; the clean page contains no bearer URL.
   res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','Referrer-Policy':'strict-origin','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",...extra});
   res.end(req.method==='HEAD'?undefined:creatorInvitationPage(title,content));
  };
  const unavailable=()=>send(410,'Invitation unavailable','<p>This invitation has expired, was replaced, revoked or already accepted. If you accepted it, your complimentary access stays with your account.</p><p><a href="/login/">Sign in</a> or ask Paul for a fresh personal invitation.</p>',{'Set-Cookie':cookie('creator-invite','',0)});
  try{
   if(!['GET','HEAD','POST'].includes(req.method)){send(405,'Use your invitation link','<p>Open the personal link Paul sent you.</p>',{Allow:'GET, HEAD, POST'});return true;}
   if(url.pathname==='/creator-invitation'){
    if(req.method==='POST'){send(405,'Use the invitation form','<p>Open your personal invitation again.</p>',{Allow:'GET, HEAD'});return true;}
    send(308,'Your creator invitation','',{Location:'/creator-invitation/'+url.search});return true;
   }
   if(!store||!members||!config||!await store.ready()){
    send(503,'Creator invitations are being prepared','<p>Your creator invitation service is temporarily unavailable. Please return shortly.</p>');return true;
   }
   if(url.search){
    const raw=url.searchParams.get('token');
    if(!['GET','HEAD'].includes(req.method)||url.searchParams.size!==1||url.searchParams.getAll('token').length!==1||!validToken(raw)){unavailable();return true;}
    const invite=await store.read(raw);
    if(!invite){unavailable();return true;}
    const age=Math.min(30*86400,Math.max(1,Math.floor((expires(invite.expires_at)-Date.now())/1000)));
    send(303,'Your creator invitation','',{Location:'/','Referrer-Policy':'no-referrer','Set-Cookie':[cookie('creator-invite',raw,age),cookie('form',csrf)]});return true;
   }
   const raw=read(req,'creator-invite');
   if(!raw){unavailable();return true;}
   const invite=await store.read(raw);
   if(!invite){unavailable();return true;}
   const member=await members.session(read(req,'member'));
   if(req.method==='POST'){
    if(req.headers.origin!==config.origin){send(403,'Refresh your invitation','<p>Please open your personal invitation again and use its acceptance button.</p>');return true;}
    const f=await body(req);
    if(!f||!equal(read(req,'form'),f.get('csrf'))){
     send(403,'Sign in to accept','<p>Sign in with the invited email, then return here to accept.</p><p><a href="/login/?next=%2Fcreator-invitation%2F">Sign in</a></p>');return true;
    }
    if(!member){send(303,'Sign in to accept','',{Location:'/login/?next=%2Fcreator-invitation%2F'});return true;}
    if(!equal(digest(csrf),member.csrf_token_hash)||String(member.email).trim().toLowerCase()!==invite.target_email){send(403,'Sign in with the invited account','<p>This invitation belongs to a different account, or your sign-in form has expired. Sign in with the invited email and return to accept.</p><p><a href="/account/">Open your account</a></p>');return true;}
    if(!await members.allow('token')){send(429,'Take a short break','<p>Please try again in 15 minutes.</p>',{'Retry-After':'900'});return true;}
    await store.accept(raw,member.id);
    send(303,'Your creator access is ready','',{Location:'/account/?creator=accepted','Set-Cookie':cookie('creator-invite','',0)});return true;
   }
   send(200,'Your Gold Trails creator invitation',invitationBody(invite,member,csrf),{'Set-Cookie':cookie('form',csrf)});return true;
  }catch(error){
   if(error instanceof CreatorInvitationError){
    if(error.code==='invitation_unavailable'){unavailable();return true;}
    send(error.status,'Your creator invitation',`<p role="alert">${h(error.message)}</p><p><a href="/creator-invitation/">Return to your invitation</a> · <a href="/account/">Open your account</a></p>`);return true;
   }
   log('Gold Trails creator invitation request unavailable');
   send(503,'A pause along the trail','<p>We could not finish this request. If you already accepted, sign in to check your account. Otherwise return to your personal invitation shortly.</p>');return true;
  }
 };
}

// Invoked only after the existing owner authentication and CSRF checks.
export function createAdminInvitationRouter(store,origin){
 return async(url,f,session,actor)=>{
  if(!['/admin/creator-invitations/','/admin/creator-invitations'].includes(url.pathname))return null;
  if(!url.pathname.endsWith('/'))return {redirect:'/admin/creator-invitations/'};
  const result=(body,status=200)=>({title:'Creator invitations',body,status});
  if(!store||!await store.ready())return result('<section class="resource-placeholder"><h2>Creator invitations are being prepared</h2><p>Complete the creator invitation database setup before creating links. Existing accounts and the public site stay available.</p></section>',503);
  try{
   let created=null,link=null,notice='';
   if(f){
    if(f.get('action')==='configure_owner'){await store.configureOwner(f.get('email')||'',actor);notice='Your invitation account is set.';}
    else if(f.get('action')==='issue'){
     created=await store.issue({personId:f.get('personId'),email:f.get('email'),actor});
     link=origin+'/creator-invitation/?token='+created.raw;
    }else if(f.get('action')==='revoke'){await store.revoke(f.get('id'),actor);notice='The pending invitation link has been revoked.';}
    else return result('<p role="alert">Choose one of the invitation actions.</p>',400);
   }
   return result(adminInvitationsView(await store.overview(),session,{created,url:link,notice}));
  }catch(error){
   if(!(error instanceof CreatorInvitationError))throw error;
   return result(`<section class="resource-placeholder"><h2>Check the invitation</h2><p role="alert">${h(error.message)}</p><p><a href="/admin/creator-invitations/">Return to creator invitations</a></p></section>`,error.status);
  }
 };
}
