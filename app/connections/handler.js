import {timingSafeEqual} from 'node:crypto';
import {digest} from '../admin-auth.js';
import {ConnectionsError,validateEvent,publicEvent,uuid,stateFor,eventUrl,eventFilters,text} from './model.js';
import {coverageStates} from './geography.js';
import {shell,nav,invite,directoryPage,groupsPage,eventForm,detailPage,managePage,minePage,preferencesPage,form,hidden,eventCards} from './views.js';
import {escapeHtml as h} from '../directory-views.js';
import {calendarIcs} from './ics.js';
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp(`(?:^|;\\s*)__Host-gold-${name}=([a-f0-9]{64})(?:;|$)`))?.[1]||null;
const equal=(a,b)=>/^[a-f0-9]{64}$/.test(a||'')&&/^[a-f0-9]{64}$/.test(b||'')&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req){
 if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw new ConnectionsError('Submit the event form.',415);
 let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>60000)throw new ConnectionsError('This form is too large.',413);chunks.push(c);}const f=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));for(const key of new Set(f.keys()))if(key!=='states'&&f.getAll(key).length>1)throw new ConnectionsError('Duplicate form field.');return f;
}
const revision=f=>{const n=Number(f.get('revision'));if(!Number.isInteger(n)||n<1)throw new ConnectionsError('Reload before saving.');return n;};
export function connectionsReturnPath(value){if(typeof value!=='string'||value.length>300)return null;return /^\/connections\/(?:mine\/|preferences\/|new\/|states\/[a-z-]+\/|events\/[a-f0-9-]{36}\/(?:edit\/|manage\/)?)?$/.test(value)?value:null;}
export function createConnectionsHandler({store=null,members=null,owners=null,config=null,vault=null,calendarStore=null,processPhoto=null,unsubscribe=null,log=console.error}={}){
 const handler=async(req,res,url)=>{
  if(url.pathname==='/connections'){res.writeHead(308,{Location:'/connections/','Cache-Control':'no-store'});res.end();return true;}
  if(!url.pathname.startsWith('/connections/'))return false;
  let privatePage=false,member=null,csrf=read(req,'form');
  const send=(status,body,headers={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",...(privatePage?{'X-Robots-Tag':'noindex'}:{}),...headers});res.end(req.method==='HEAD'?undefined:body);};
  const json=(status,value)=>send(status,JSON.stringify(value),{'Content-Type':'application/json; charset=utf-8'});
  const redirect=path=>send(303,'',{Location:path});
  const requireMember=()=>{if(!member)throw new ConnectionsError('Sign in to Gold Trails to manage your events and preferences.',401);};
  const requirePlus=()=>{requireMember();if(member.effective_level!=='subscriber')throw new ConnectionsError('Gold Trails Plus is required for this action.',403);};
  try{
   if(!['GET','HEAD','POST'].includes(req.method))throw new ConnectionsError('Use the Gold Connections controls.',405);
   if(url.pathname==='/connections/coverage/'){
    if(req.method==='POST')throw new ConnectionsError('Use GET.',405);
    json(200,{states:coverageStates(url.searchParams.get('state'),url.searchParams.get('range')||0)});return true;
   }
   let ready=false;try{ready=Boolean(store&&await store.ready());}catch{log('Gold Connections database unavailable');}
   if(url.pathname==='/connections/moderation/'){
    privatePage=true;const owner=owners?await owners.session(read(req,'admin')):null;if(!owner?.authenticated){send(401,shell('Owner moderation','<p><a href="/admin/login/">Sign in as the Gold Trails administrator</a>.</p>'));return true;}
    if(!ready)throw new ConnectionsError('Gold Connections is not enabled yet.',503);
    if(req.method==='POST'){if(req.headers.origin!==config?.origin)throw new ConnectionsError('Use the owner moderation form.',403);const f=await body(req);if(!equal(owner.csrf_token,f.get('csrf')))throw new ConnectionsError('Your owner form expired.',403);if(!uuid(f.get('eventId'))||!uuid(f.get('targetId'))||!['event','comment','photo'].includes(f.get('targetType'))||!['hide','resolve'].includes(f.get('action')))throw new ConnectionsError('Choose a listed moderation action.');await store.ownerModerate(f.get('eventId'),f.get('targetType'),f.get('targetId'),f.get('action'),f.get('reportId'));redirect('/connections/moderation/');return true;}
    const reports=await store.siteReports();send(200,shell('Gold Connections moderation','<p>Private owner review queue. No attendee email addresses are displayed.</p>'+reports.map(r=>'<section class="resource-placeholder"><h2>'+h(r.title)+'</h2><p>'+h(r.target_type)+' · '+h(r.reason)+'</p>'+form('/connections/moderation/',owner.csrf_token,hidden('eventId',r.event_id)+hidden('targetId',r.target_id)+hidden('targetType',r.target_type)+hidden('reportId',r.id)+'<label>Decision<select name="action"><option value="resolve">Reviewed—keep content</option><option value="hide">Hide content</option></select></label>','Save decision')+'</section>').join('')+(reports.length?'':'<p>No open reports.</p>')));return true;
   }
   member=members&&config?await members.session(read(req,'member')):null;
   if(url.pathname==='/connections/states/'&&req.method!=='POST'){send(200,groupsPage());return true;}
   const stateMatch=url.pathname.match(/^\/connections\/states\/([a-z-]+)\/$/);
   if(url.pathname==='/connections/'||stateMatch){
    if(req.method==='POST')throw new ConnectionsError('Search with the event filters.',405);
    const params=new URLSearchParams(url.searchParams);let state=null;
    if(stateMatch){state=stateFor(stateMatch[1]);if(!state)throw new ConnectionsError('That state group does not exist.',404);params.set('state',state.code);}
    const filters=eventFilters(params),result=ready?await store.list(filters,member):{events:[],hasMore:false};send(200,directoryPage(filters,result,{state,member,ready}));return true;
   }
   if(!ready)throw new ConnectionsError('Gold Connections is not enabled on this server yet. Your other Gold Trails features are available.',503);
   if(url.pathname==='/connections/unsubscribe/'){
    privatePage=true;
    const token=url.searchParams.get('token');const account=unsubscribe?.verify(token);if(!account)throw new ConnectionsError('Use a valid unsubscribe link from a Gold Connections email.',400);
    if(req.method==='POST'){const f=await body(req);if(!equal(f.get('confirmation'),unsubscribe.confirmation(token)))throw new ConnectionsError('Use the unsubscribe confirmation.',403);await store.unsubscribe(account);send(200,shell('Event emails turned off','<p>All Gold Connections email notifications are now off for this account. Your Gold Trails membership and RSVPs are unchanged.</p>'));return true;}
    send(200,shell('Turn off Gold Connections emails',form(url.pathname+'?token='+encodeURIComponent(token),'',hidden('confirmation',unsubscribe.confirmation(token)),'Turn off event emails')));return true;
   }
   const photo=url.pathname.match(/^\/connections\/photos\/([a-f0-9-]{36})\/$/);
   if(photo){if(req.method==='POST')throw new ConnectionsError('Use the event photo controls.',405);const p=await store.photo(photo[1]);if(!p)throw new ConnectionsError('Photo unavailable.',404);const e=await store.get(p.eventId);if(!e||e.moderated&&e.organizerId!==member?.id||e.status==='draft'&&e.organizerId!==member?.id||e.visibility==='plus'&&member?.effective_level!=='subscriber'&&e.organizerId!==member?.id)throw new ConnectionsError('Photo unavailable.',404);privatePage=true;send(200,p.content,{'Content-Type':'image/jpeg','Content-Disposition':'inline','Cache-Control':'private, no-store'});return true;}
   const eventMatch=url.pathname.match(/^\/connections\/events\/([a-f0-9-]{36})\/(.*)$/);
   let event=null,organizer=false,participation=null;
   if(eventMatch){if(!uuid(eventMatch[1]))throw new ConnectionsError('Event unavailable.',404);event=await store.get(eventMatch[1]);if(!event)throw new ConnectionsError('Event unavailable.',404);organizer=event.organizerId===member?.id;
    if((event.status==='draft'||event.moderated)&&!organizer)throw new ConnectionsError('Event unavailable.',404);
    if(event.visibility==='plus'&&!organizer&&member?.effective_level!=='subscriber'){privatePage=true;send(403,shell('A Plus gathering',invite(eventUrl(event.id))));return true;}
    participation=member?await store.participation(member.id,event.id):null;
    privatePage=event.visibility!=='public'||event.status==='draft'||Boolean(member);
   }
   // Photo bodies are binary and have their own strict bound and CSRF header.
   const upload=eventMatch?.[2]==='photos/'&&req.method==='POST';
   let f=null;
   if(req.method==='POST'){
    requireMember();if(req.headers.origin!==config?.origin)throw new ConnectionsError('Use this form on Gold Trails.',403);
    if(upload){if(!equal(csrf,req.headers['x-connections-csrf'])||!equal(digest(csrf||''),member.csrf_token_hash))throw new ConnectionsError('Sign in again before uploading.',403);}
    else{f=await body(req);if(!equal(csrf,f.get('csrf'))||!equal(digest(csrf||''),member.csrf_token_hash))throw new ConnectionsError('Your form expired. Sign in again.',403);}
    if(!await store.allowWrite(member.id))throw new ConnectionsError('Take a short break before making more changes.',429);
   }
   if(url.pathname==='/connections/mine/'){
    requireMember();privatePage=true;if(f)throw new ConnectionsError('Use the event controls.',405);send(200,minePage(await store.mine(member.id)));return true;
   }
   if(url.pathname==='/connections/preferences/'){
    requireMember();privatePage=true;
    if(f){const selected=f.getAll('states');if(selected.length>50||new Set(selected).size!==selected.length||selected.some(s=>!stateFor(s)||s!==stateFor(s).code))throw new ConnectionsError('Choose the listed states.');const prefs={states:selected,...Object.fromEntries(['new_events','updates','reminders','rsvp'].map(k=>[k,f.get(k)==='yes']))};const previous=await store.preferences(member.id);if(selected.some(s=>!previous.states.includes(s))||Object.values(prefs).some(v=>v===true))requirePlus();await store.savePreferences(member.id,prefs);redirect('/connections/preferences/');return true;}
    send(200,preferencesPage(await store.preferences(member.id),csrf,url.searchParams.get('state')));return true;
   }
   if(url.pathname==='/connections/new/'){
    requirePlus();privatePage=true;
    if(f){const validated=validateEvent(Object.fromEntries(f));const ids=await store.create(member.id,validated);redirect(eventUrl(ids[0])+'manage/');return true;}
    let draft={state:stateFor(url.searchParams.get('state'))?.code};
    if(url.searchParams.has('copy')){const id=url.searchParams.get('copy');if(!uuid(id))throw new ConnectionsError('Event unavailable.',404);const original=await store.get(id);if(original?.organizerId!==member.id)throw new ConnectionsError('Event unavailable.',404);draft={...original,title:original.title+' (copy)',status:'draft',meeting:null,recurrence:'none',occurrences:1};}
    send(200,eventForm(draft,csrf));return true;
   }
   if(!eventMatch)throw new ConnectionsError('That Gold Connections page does not exist.',404);
   const action=eventMatch[2],base=eventUrl(event.id);
   if(action==='edit/'){
    requirePlus();privatePage=true;if(!organizer)throw new ConnectionsError('Event unavailable.',404);
    if(f){await store.update(member.id,event.id,validateEvent({...Object.fromEntries(f),recurrence:'none',occurrences:1}),revision(f));redirect(base);return true;}
    send(200,eventForm({...event,meeting:vault.open(event.meetingCipher)},csrf,'',true));return true;
   }
   if(action==='manage/'){
    requireMember();privatePage=true;if(!organizer)throw new ConnectionsError('Event unavailable.',404);if(f)throw new ConnectionsError('Use the event controls.',405);send(200,managePage(event,await store.attendees(member.id,event.id),csrf,await store.reports(member.id,event.id)));return true;
   }
   if(action==='calendar.ics'){
    if(f)throw new ConnectionsError('Download the calendar file.',405);const safe=publicEvent(event);send(200,calendarIcs(safe,config?.origin||'https://goldtrails.org'),{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="gold-connections-event.ics"'});return true;
   }
   if(action==='calendar/'){
    requireMember();if(!f)throw new ConnectionsError('Use Add to my calendar.',405);if(!calendarStore||!await calendarStore.ready())throw new ConnectionsError('Your personal calendar is unavailable.',503);
    await store.copyToCalendar(member.id,event.id);redirect('/calendar/');return true;
   }
   if(action==='rsvp/'){
    requireMember();if(!f)throw new ConnectionsError('Use the RSVP button.',405);const choice=f.get('action');if(!['yes','cancel'].includes(choice))throw new ConnectionsError('Choose Yes or Cancel.');if(choice==='yes')requirePlus();await store.rsvp(member.id,event.id,choice);redirect(base);return true;
   }
   if(action==='cancel/'){
    requireMember();if(!f||f.get('confirmation')!=='CANCEL EVENT')throw new ConnectionsError('Type CANCEL EVENT to confirm.');await store.cancel(member.id,event.id,revision(f));redirect(base);return true;
   }
   if(action==='attendance/'||action==='remove-attendee/'){
    requirePlus();if(!organizer)throw new ConnectionsError('Event unavailable.',404);if(!f||!uuid(f.get('accountId')))throw new ConnectionsError('Choose an attendee.');if(action==='attendance/'){if(!['yes','no'].includes(f.get('attended')))throw new ConnectionsError('Choose an attendance status.');await store.attendance(member.id,event.id,f.get('accountId'),f.get('attended')==='yes');}else await store.removeAttendee(member.id,event.id,f.get('accountId'));redirect(base+'manage/');return true;
   }
   const commentMatch=action.match(/^comments\/([a-f0-9-]{36})\/$/);
   if(action==='comments/'||commentMatch){
    requireMember();if(!f)throw new ConnectionsError('Use the discussion controls.',405);
    if(commentMatch){const intent=f.get('action');if(!['edit','delete'].includes(intent))throw new ConnectionsError('Choose an edit action.');if(intent==='edit')requirePlus();await store.editComment(member.id,event.id,commentMatch[1],text(f.get('body')||'', 'comment',4000,intent==='edit'),revision(f),intent==='delete');}
    else{requirePlus();const kind=f.get('kind')||'comment';if(!['comment','announcement','recap'].includes(kind))throw new ConnectionsError('Choose a comment type.');await store.comment(member.id,event.id,text(f.get('body')||'','comment',4000,true),kind);}
    redirect(base);return true;
   }
   if(action==='report/'){
    requireMember();if(!f||!['event','comment','photo'].includes(f.get('targetType'))||!uuid(f.get('targetId')))throw new ConnectionsError('Choose content to report.');await store.report(member.id,event.id,f.get('targetType'),f.get('targetId'),text(f.get('reason')||'','report reason',1000,true));redirect(base);return true;
   }
   if(action==='moderate/'){
    requireMember();if(!organizer)throw new ConnectionsError('Event unavailable.',404);if(!f||!['event','comment','photo'].includes(f.get('targetType'))||!['hide','resolve'].includes(f.get('action'))||!uuid(f.get('targetId')))throw new ConnectionsError('Choose a moderation action.');await store.moderate(member.id,event.id,f.get('targetType'),f.get('targetId'),f.get('action'),f.get('reportId'));redirect(base+'manage/');return true;
   }
   if(upload){
    requirePlus();if(!processPhoto)throw new ConnectionsError('Photo processing is not configured.',503);
    const kind=req.headers['x-photo-kind'];if(!['cover','experience'].includes(kind))throw new ConnectionsError('Choose a photo type.');
    // Authorize before consuming or decoding the image.
    if(kind==='cover'&&!organizer||kind==='experience'&&(!organizer&&participation?.status!=='yes'||Date.parse(event.endUtc)>=Date.now()))throw new ConnectionsError('Photos are for organizers or confirmed participants after an event.',403);
    let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>5*1024*1024)throw new ConnectionsError('Photos must be 5 MB or smaller.',413);chunks.push(c);}
    const caption=text(decodeURIComponent(req.headers['x-photo-caption']||''),'photo caption',240,true),content=await processPhoto(Buffer.concat(chunks));
    await store.addPhoto(member.id,event.id,kind,caption,content);json(201,{location:base});return true;
   }
   const deletePhoto=action.match(/^photos\/([a-f0-9-]{36})\/$/);
   if(deletePhoto){requireMember();if(!f)throw new ConnectionsError('Use Remove photo.',405);await store.deletePhoto(member.id,event.id,deletePhoto[1]);redirect(base);return true;}
   if(action!=='')throw new ConnectionsError('That event control does not exist.',404);
   if(f)throw new ConnectionsError('Use the event controls.',405);
   const view=publicEvent(event),canSeePrivate=organizer||member?.effective_level==='subscriber'&&participation?.status==='yes';
   if(canSeePrivate){view.street=event.street;view.zip=event.zip;view.mapUrl=event.mapUrl;view.addressRestricted=false;}
   let content=detailPage(view,{member,csrf,participation,organizer,meeting:canSeePrivate?vault.open(event.meetingCipher):null,comments:await store.comments(event.id,member?.id),photos:await store.photos(event.id,member?.id)});
   if(member)content=content.replace('<div class="connections-actions">',`<div class="connections-actions">${form(base+'calendar/',csrf,'','Add to my Gold Trails calendar')}`);
   send(200,content);return true;
  }catch(e){
   const status=e instanceof ConnectionsError?e.status:503,message=e instanceof ConnectionsError?e.message:'Gold Connections is temporarily unavailable. Please try again.';
   if(!(e instanceof ConnectionsError))log('Gold Connections request unavailable');
   privatePage=true;
   if(req.headers['x-connections-csrf'])json(status,{error:message});
   else if(status===401||status===403)send(status,shell(status===401?'Sign in to join the gathering':'Gold Trails Plus',`<p role="alert">${h(message)}</p>${invite(connectionsReturnPath(url.pathname)||'/connections/')}`));
   else send(status,shell('A pause at the gathering',`<p role="alert">${h(message)}</p><p>Use Back to keep your form entries, or <a href="/connections/">return to events</a>.</p>`));return true;
  }
 };
 handler.attach=async(req,res,url)=>{
  if(!['/','/account/'].includes(url.pathname)||!['GET','HEAD'].includes(req.method))return;
  let upcoming=[];if(url.pathname==='/'&&store){try{if(await store.ready())upcoming=(await store.list({period:'upcoming',page:1})).events.filter(e=>e.status==='published').slice(0,3);}catch{}}
  const original=res.end.bind(res),head=res.writeHead.bind(res);let responseType='';res.writeHead=(status,headers)=>{responseType=String(Object.entries(headers||{}).find(([k])=>k.toLowerCase()==='content-type')?.[1]||'');return head(status,headers);};res.end=(chunk,encoding,callback)=>{if(responseType.includes('text/html')&&chunk){let value=Buffer.isBuffer(chunk)?chunk.toString():String(chunk);
   if(url.pathname==='/'&&upcoming.length)value=value.replace(value.includes('home-graphical')?/<\/main>/g:'</main>',`<section class="connections connections-home"><h2>Let’s meet up!</h2><p>Good company from the Gold Trails community.</p>${eventCards(upcoming)}<a href="/connections/">All Gold Connections events →</a></section></main>`).replace('</head>',`<link rel="stylesheet" href="/connections.css"></head>`);
   chunk=Buffer.from(value);}return original(chunk,encoding,callback);};
 };
 return handler;
}
