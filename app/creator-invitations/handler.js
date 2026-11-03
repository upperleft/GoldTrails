import {timingSafeEqual} from 'node:crypto';
import {digest,token,hashPassword} from '../admin-auth.js';
import {memberIdentity} from '../members.js';
import {CreatorInvitationError} from './model.js';
import {creatorInvitationPage,invitationBody,creatorWelcomeBackBody,adminInvitationsView} from './views.js';
import {escapeHtml as h} from '../directory-views.js';
import {creatorInvitationHome,creatorInvitationFlow,creatorAccessRoutes,creatorInvitationName,creatorNameSlug} from './context.js';

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
  // Keep the invitation journey focused until acceptance. Public creator profiles
  // remain public outside this browser's valid, pending invitation context.
  const profile=url.pathname.match(/^\/prospectors\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/videos)?\/?$/);
  const accessPath=creatorAccessRoutes.has(url.pathname)||creatorAccessRoutes.has(url.pathname+'/');
  if((url.pathname==='/'||profile||accessPath)&&(['GET','HEAD'].includes(req.method)||accessPath)){
   const raw=read(req,'creator-invite'),name=creatorInvitationName(req);
   if((raw||name)&&store&&members&&config)try{
    const invite=await store.ready()&&(raw?await store.read(raw):await store.readNamed(name));
    if(invite){
     if(url.pathname==='/')req[creatorInvitationHome]=true;
     if(accessPath)req[creatorInvitationFlow]=true;
     if(profile&&profile[1]===invite.slug){
      res.writeHead(303,{Location:'/creator-invitation/','Cache-Control':'private, no-store',Vary:'Cookie','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});res.end();return true;
     }
    }
   }catch{log('Gold Trails homepage invitation check unavailable');}
   return false;
  }
  const namedEntry=url.pathname.match(/^\/invite\/([^/]+)\/?$/);
  const namedPath=url.pathname==='/invite'||url.pathname.startsWith('/invite/');
  if(!namedPath&&!['/creator-invitation','/creator-invitation/'].includes(url.pathname))return false;
  const csrf=read(req,'form')||token();let submittedValues={};
  const send=(status,title,content,extra={})=>{
   // Keep Origin available on native form POSTs; the clean page contains no bearer URL.
   res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','Referrer-Policy':'strict-origin','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",...extra});
   res.end(req.method==='HEAD'?undefined:creatorInvitationPage(title,content));
  };
  const clearInvitation=()=>[cookie('creator-invite','',0),cookie('creator-name','',0)];
  const alreadyAccepted=async(raw,slug=null,entry=false)=>{
   const receipt=store?.accepted&&await store.accepted(raw);
   if(!receipt||slug&&receipt.slug!==slug)return false;
   if(entry){send(303,'Welcome back','',{Location:'/creator-invitation/','Referrer-Policy':'no-referrer','Set-Cookie':[cookie('creator-invite',raw,300),cookie('creator-name','',0),cookie('form',csrf)]});return true;}
   const member=await members.session(read(req,'member'));
   const cookies=[...clearInvitation(),cookie('form',csrf)];
   if(member?.id===receipt.accountId){send(303,'Welcome back','',{Location:'/?creator=accepted','Set-Cookie':cookies});return true;}
   if(member&&!equal(digest(csrf),member.csrf_token_hash)){send(303,'Welcome back','',{Location:'/login/?next=%2F','Set-Cookie':cookies});return true;}
   send(200,'Welcome back',creatorWelcomeBackBody({accepted:true,member,csrf}),{'Set-Cookie':cookies});return true;
  };
  const unavailable=()=>send(410,'Invitation unavailable','<p>This invitation has expired, was replaced, revoked or already accepted. If you accepted it, your complimentary access stays with your account.</p><p><a href="/login/">Sign in</a> or ask Paul for a fresh personal invitation.</p>',{'Set-Cookie':clearInvitation()});
  try{
   if(!['GET','HEAD','POST'].includes(req.method)){send(405,'Use your invitation link','<p>Open the personal link Paul sent you.</p>',{Allow:'GET, HEAD, POST'});return true;}
   if(namedPath&&req.method==='POST'){send(405,'Use the invitation form','<p>Open your invitation link and use its acceptance button.</p>',{Allow:'GET, HEAD'});return true;}
   if(url.pathname==='/creator-invitation'){
    if(req.method==='POST'){send(405,'Use the invitation form','<p>Open your personal invitation again.</p>',{Allow:'GET, HEAD'});return true;}
    send(308,'Your creator invitation','',{Location:'/creator-invitation/'+url.search});return true;
   }
   if(!store||!members||!config||!await store.ready()){
    send(503,'Creator invitations are being prepared','<p>Your creator invitation service is temporarily unavailable. Please return shortly.</p>');return true;
   }
   if(namedPath){
    const slug=namedEntry?.[1];
    if(!creatorNameSlug(slug)){unavailable();return true;}
    if(url.search){
     const raw=url.searchParams.get('code');
     if(url.searchParams.size!==1||url.searchParams.getAll('code').length!==1||!validToken(raw)){unavailable();return true;}
     const invite=await store.read(raw);
     if(!invite){if(await alreadyAccepted(raw,slug,true))return true;unavailable();return true;}
     if(invite.slug!==slug){unavailable();return true;}
     const age=Math.min(30*86400,Math.max(1,Math.floor((expires(invite.expires_at)-Date.now())/1000)));
     send(303,'Your creator invitation','',{Location:'/','Referrer-Policy':'no-referrer','Set-Cookie':[cookie('creator-invite',raw,age),cookie('creator-name','',0),cookie('form',csrf)]});return true;
    }
    const invite=await store.readNamed(slug);
    if(!invite){unavailable();return true;}
    const age=Math.min(30*86400,Math.max(1,Math.floor((expires(invite.expires_at)-Date.now())/1000)));
    send(303,'Your creator invitation','',{Location:'/','Referrer-Policy':'no-referrer','Set-Cookie':[cookie('creator-name',slug,age),cookie('creator-invite','',0),cookie('form',csrf)]});return true;
   }
   if(url.search){
    const raw=url.searchParams.get('token');
    if(!['GET','HEAD'].includes(req.method)||url.searchParams.size!==1||url.searchParams.getAll('token').length!==1||!validToken(raw)){unavailable();return true;}
    const invite=await store.read(raw);
    if(!invite){if(await alreadyAccepted(raw,null,true))return true;unavailable();return true;}
    const age=Math.min(30*86400,Math.max(1,Math.floor((expires(invite.expires_at)-Date.now())/1000)));
    send(303,'Your creator invitation','',{Location:'/','Referrer-Policy':'no-referrer','Set-Cookie':[cookie('creator-invite',raw,age),cookie('creator-name','',0),cookie('form',csrf)]});return true;
   }
   const raw=read(req,'creator-invite'),name=creatorInvitationName(req);
   if(!raw&&!name){unavailable();return true;}
   const member=await members.session(read(req,'member'));
   const invite=raw?await store.read(raw):await store.readNamed(name,member?.id||null);
   if(!invite){if(raw&&['GET','HEAD'].includes(req.method)&&await alreadyAccepted(raw))return true;unavailable();return true;}
   if(req.method==='POST'){
    if(req.headers.origin!==config.origin){send(403,'Refresh your invitation','<p>Please open your personal invitation again and use its acceptance button.</p>');return true;}
    const f=await body(req);
    if(!f||!equal(read(req,'form'),f.get('csrf'))){
     send(403,'Sign in to accept','<p>Sign in with the invited email, then return here to accept.</p><p><a href="/login/?next=%2Fcreator-invitation%2F">Sign in</a></p>');return true;
    }
    const action=f.get('action')||'accept';
    if(action==='create_account'){
     if(!raw||!store.join){send(403,'Use your private invitation','<p>Open the complete private link from your invitation email to set up your account without a separate verification email.</p>');return true;}
     if(member){send(409,'Use your signed-in account',invitationBody(invite,member,csrf));return true;}
     if(!config.open){send(503,'Account setup is temporarily unavailable','<p>Please return shortly to finish your complimentary membership.</p>');return true;}
     const allowed=new Set(['csrf','action','username','email','displayName','password','confirmPassword']);
     if([...f.keys()].some(key=>!allowed.has(key))){send(400,'Check the invitation form',invitationBody(invite,null,csrf));return true;}
     submittedValues={username:f.get('username'),displayName:f.get('displayName')};let data;
     try{data=memberIdentity(f);}catch(error){send(400,'Check your account details',`<p role="alert">${h(error.message)}</p>`+invitationBody(invite,null,csrf,{values:{username:f.get('username'),displayName:f.get('displayName')}}));return true;}
     if(data.email!==invite.target_email){send(403,'Use the invited email','<p>Your private invitation is for a different email address. Open the invitation sent to the address you want to use.</p>');return true;}
     if(!await members.allow('signup')||!await members.allow('token')){send(429,'Take a short break','<p>Please try again in 15 minutes.</p>',{'Retry-After':'900'});return true;}
     const freshCsrf=token(),passwordHash=await hashPassword(data.password,{minLength:8});
     const joined=await store.join(raw,{username:data.username,email:data.email,passwordHash,displayName:data.displayName,csrf:freshCsrf});
     send(303,'Your creator access is ready','',{Location:'/?creator=accepted','Set-Cookie':[...clearInvitation(),cookie('member',joined.session),cookie('form',freshCsrf)]});return true;
    }
    if(action!=='accept'){send(400,'Use the invitation form','<p>Return to your invitation and use its acceptance button.</p><p><a href="/creator-invitation/">Return to your invitation</a></p>');return true;}
    if(!member){send(303,'Sign in to accept','',{Location:'/login/?next=%2Fcreator-invitation%2F'});return true;}
    if(!equal(digest(csrf),member.csrf_token_hash)){send(403,'Sign in to accept','<p>Sign in again, then return here to accept your invitation.</p><p><a href="/login/?next=%2Fcreator-invitation%2F">Sign in</a></p>');return true;}
    if(String(member.email).trim().toLowerCase()!==invite.target_email){send(403,'Sign in with the invited account',invitationBody(invite,member,csrf));return true;}
    if(!await members.allow('token')){send(429,'Take a short break','<p>Please try again in 15 minutes.</p>',{'Retry-After':'900'});return true;}
    if(raw)await store.accept(raw,member.id);else await store.acceptNamed(name,member.id);
    send(303,'Your creator access is ready','',{Location:'/?creator=accepted','Set-Cookie':clearInvitation()});return true;
   }
   if(raw&&!member&&store.recipientState){
    const state=await store.recipientState(raw);
    if(state==='active'){send(200,'Welcome back',creatorWelcomeBackBody(),{'Set-Cookie':cookie('form',csrf)});return true;}
    if(state==='blocked'){send(409,'Let’s finish your account','<p>Please reply to Paul’s invitation for help finishing this account. Your invitation has not been used.</p>');return true;}
   }
   send(200,'Your Gold Trails creator invitation',invitationBody(invite,member,csrf),{'Set-Cookie':cookie('form',csrf)});return true;
  }catch(error){
   if(error instanceof CreatorInvitationError){
    if(error.code==='invitation_unavailable'){unavailable();return true;}
    if(error.code==='account_exists'){
     send(error.status,'Welcome back',creatorWelcomeBackBody());return true;
    }
    if(error.code==='account_unavailable'){
     send(error.status,'Let’s finish your account','<p>Please reply to Paul’s invitation for help finishing this account. Your invitation has not been used.</p>');return true;
    }
    if(error.code==='username_unavailable'){
     const raw=read(req,'creator-invite'),invite=raw&&await store.read(raw);
     if(!invite){unavailable();return true;}
     send(error.status,'Choose another username',`<p role="alert">That username is already taken. Choose another username below to finish your free membership.</p>`+invitationBody(invite,null,csrf,{values:submittedValues}));return true;
    }
    send(error.status,'Your creator invitation',`<p role="alert">${h(error.message)}</p><p><a href="/creator-invitation/">Return to your invitation</a></p>`);return true;
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
     link=origin+'/invite/'+encodeURIComponent(created.slug)+'/?code='+created.raw;
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
