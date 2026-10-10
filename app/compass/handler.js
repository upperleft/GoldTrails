import {timingSafeEqual} from 'node:crypto';
import {digest} from '../admin-auth.js';
import {ProfileError,validateAnswers,patchFromForm,equipment} from './profile.js';
import {recommendations} from './recommendations.js';
import {guide,aiConfig} from './ai.js';
import {shell,preview,errorPage,questionnaire,dashboard,passport,privacy,shareCard,guidePage} from './views.js';
import {layoutFromForm} from './dashboard-layout.js';
import {dashboardExample} from './demo.js';
const routes=new Set(['/compass/demo/','/compass/layout/','/compass/','/compass/profile/','/compass/passport/','/compass/privacy/','/compass/feedback/','/compass/inventory/','/compass/challenge/','/compass/refresh/','/compass/reset/','/compass/delete/','/compass/export/','/compass/share/','/compass/guide/']);
const read=(req,name)=>(req.headers.cookie||'').match(new RegExp(`(?:^|;\\s*)__Host-gold-${name}=([a-f0-9]{64})(?:;|$)`))?.[1]||null;
const equal=(a,b)=>/^[a-f0-9]{64}$/.test(a||'')&&/^[a-f0-9]{64}$/.test(b||'')&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req){if(!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type']||''))throw new ProfileError('Submit the form from Compass.');let n=0,b=[];for await(const c of req){n+=c.length;if(n>16000)throw new ProfileError('This form is too large.');b.push(c);}const f=new URLSearchParams(Buffer.concat(b).toString('utf8'));const multi=new Set(['interests','equipment','learning','favoriteCreators']);for(const key of new Set(f.keys()))if(!multi.has(key)&&f.getAll(key).length>1)throw new ProfileError('Duplicate field.');return f;}
const integer=v=>/^\d{1,10}$/.test(v||'')?Number(v):NaN;
export function createCompassHandler({members,store,content,config,ai=aiConfig(),fetcher=fetch,log=console.error}){
 return async(req,res,url)=>{
  if(url.pathname==='/compass'){res.writeHead(308,{Location:'/compass/'+url.search});res.end();return true;}
  if(!url.pathname.startsWith('/compass/'))return false;
  const send=(status,html,headers={})=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",...headers});res.end(req.method==='HEAD'?undefined:html);};
  const redirect=path=>{res.writeHead(303,{Location:path,'Cache-Control':'no-store'});res.end();};
  try{
   if(!routes.has(url.pathname)){send(404,errorPage('Trail not found','That Compass page does not exist.'));return true;}
   if(!['GET','HEAD','POST'].includes(req.method)){send(405,errorPage('Use the Compass forms','This method is not supported.'),{Allow:'GET, HEAD, POST'});return true;}
   if(url.pathname==='/compass/demo/'){if(req.method==='POST')throw new ProfileError('The example stores only layout choices in your browser.',405);const example=await dashboardExample(url.searchParams.get('persona'));send(200,dashboard(null,example.state,example.result,example.records,'',false,{demo:true,persona:example.persona}));return true;}
   const member=members&&config?await members.session(read(req,'member')):null;
   if(!member){if(url.pathname==='/compass/'&&req.method!=='POST')send(200,preview());else redirect('/login/');return true;}
   // Expired subscribers retain access to export/delete their own private data.
   const ownData=['/compass/privacy/','/compass/export/','/compass/delete/'].includes(url.pathname);
   if(member.effective_level!=='subscriber'&&!ownData){send(403,preview(true));return true;}
   if(!store||!await store.ready()){send(503,errorPage('Compass is being prepared','The member profile database is not ready. Your account and the rest of Gold Trails are available.'));return true;}
   let f=null;const csrf=read(req,'form');
   if(req.method==='POST'){
    if(req.headers.origin!==config.origin){send(403,errorPage('Form not accepted','Please use the form on Gold Trails.'));return true;}
    f=await body(req);if(!equal(csrf,f.get('csrf'))||!equal(digest(csrf||''),member.csrf_token_hash)){send(403,errorPage('Your form has expired','Sign in again before changing your profile.'));return true;}
   }
   const id=member.id;
   if(url.pathname==='/compass/privacy/'){if(req.method==='POST')throw new ProfileError('Use the privacy controls.');send(200,privacy(csrf));return true;}
   if(['/compass/export/','/compass/delete/'].includes(url.pathname)){
    if(!f)throw new ProfileError('Use the privacy controls.',405);
    if(url.pathname.endsWith('export/')){send(200,JSON.stringify(await store.load(id),null,2),{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="gold-trails-compass.json"'});return true;}
    if(f.get('confirmation')!=='DELETE COMPASS')throw new ProfileError('Type DELETE COMPASS exactly to confirm.');await store.erase(id);send(200,shell('Compass data deleted','<section class="compass-panel"><h2>A fresh trail.</h2><p>Your Compass data has been removed from the active database. Your account and membership are unchanged.</p><a href="/account/">Return to my account</a></section>'));return true;
   }
   if(url.pathname==='/compass/reset/'||url.pathname==='/compass/refresh/'){if(!f)throw new ProfileError('Use the dashboard buttons.',405);if(url.pathname.endsWith('reset/'))await store.reset(id);else await store.refresh(id);redirect('/compass/');return true;}
   const state=await store.load(id);
   if(url.pathname==='/compass/layout/'){if(!f)throw new ProfileError('Use the dashboard layout form.',405);const revision=integer(f.get('revision'));if(!Number.isInteger(revision))throw new ProfileError('Reload your dashboard before saving.');await store.saveLayout(id,layoutFromForm(f),revision);redirect('/compass/?layout_saved=1');return true;}
   const catalog=await content(),records=catalog.records;
   if(url.pathname==='/compass/profile/'){
    const step=integer(f?f.get('step'):url.searchParams.get('step')||String(state.step));if(step>7||step<0||!Number.isInteger(step))throw new ProfileError('Choose a valid step.');
    if(f){const revision=integer(f.get('revision')),intent=f.get('intent');if(!Number.isInteger(revision)||!['next','pause','skip','finish'].includes(intent))throw new ProfileError('The form is incomplete.');const patch=intent==='skip'?{}:validateAnswers(patchFromForm(f,step),step,records);const finish=intent==='finish'||(intent==='skip'&&step===6),next=Math.min(step+1,7);await store.save(id,{patch,revision,step:intent==='pause'||state.completedAt?step:next,finish});if(finish)redirect('/compass/?welcome=1');else if(state.completedAt||intent==='pause')redirect('/compass/');else redirect('/compass/profile/?step='+next);return true;}
    send(200,questionnaire(state,csrf,step,records));return true;
   }
   if(url.pathname==='/compass/inventory/'){
    if(!f)throw new ProfileError('Use your passport inventory.',405);
    if(f.get('intent')==='remove'){if(!/^[a-f0-9-]{36}$/.test(f.get('id')||''))throw new ProfileError('Choose an inventory entry.');await store.removeInventory(id,f.get('id'));}
    else {const category=f.get('category'),quantity=integer(f.get('quantity')),manufacturer=f.get('manufacturer')?.trim()||null,model=f.get('model')?.trim()||null;if(!Object.hasOwn(equipment,category)||category==='none'||!Number.isInteger(quantity)||quantity<1||quantity>999||(manufacturer?.length||0)>180||(model?.length||0)>180)throw new ProfileError('Choose a category and quantity from 1 to 999. Keep names under 180 characters.');await store.inventory(id,{category,quantity,manufacturer,model});}
    redirect('/compass/passport/');return true;
   }
   if(url.pathname==='/compass/feedback/'){
    if(!f)throw new ProfileError('Use a recommendation control.',405);const item=records.find(r=>r.id===f.get('item')),action=f.get('action');if(!item||!['save','unsave','complete','undo','dismiss','known','more','less'].includes(action)||(['complete','undo'].includes(action)&&!['article','video'].includes(item.kind)))throw new ProfileError('Choose a current resource and supported action.');await store.feedback(id,item.id,action);redirect('/compass/');return true;
   }
   if(url.pathname==='/compass/challenge/'){
    if(!f)throw new ProfileError('Use the passport challenge.',405);const item=f.get('item'),answer=f.get('answer');if(item==='challenge:black-sand'){if(!state.activity.some(a=>a.item_id==='article:black-sands'&&a.completed))throw new ProfileError('Complete the black-sands article before the knowledge check.');if(answer!=='no')throw new ProfileError('Black sand does not guarantee gold. Revisit the article and try again.');}else if(item==='challenge:inventory'){if(answer!=='reviewed')throw new ProfileError('Review and confirm your inventory.');}else throw new ProfileError('That challenge is not available.');await store.feedback(id,item,'complete');redirect('/compass/passport/');return true;
   }
   if(url.pathname==='/compass/share/'){if(!f)throw new ProfileError('Use the passport download.',405);send(200,shareCard(state,records,f.get('includeName')==='yes'?(member.display_name||member.username):undefined),{'Content-Type':'image/svg+xml; charset=utf-8','Content-Disposition':'attachment; filename="gold-trail-passport.svg"'});return true;}
   if(url.pathname==='/compass/guide/'){if(!f)throw new ProfileError('Ask a question from your dashboard.',405);const question=f.get('question')?.trim();if(!question||question.length>1000)throw new ProfileError('Ask a question of up to 1,000 characters.');const answer=await guide({question,state,content:catalog,config:ai,fetcher,allow:()=>store.allowGuide(id)});send(200,guidePage(answer,csrf));return true;}
   if(req.method==='POST')throw new ProfileError('Use the Compass forms.',405);
   if(url.pathname==='/compass/passport/'){send(200,passport(state,records,csrf));return true;}
   if(!state.revision){redirect('/compass/profile/?step=0');return true;}
   const result=await recommendations(store,id,state,catalog);send(200,dashboard(member,state,result,records,csrf,url.searchParams.get('welcome')==='1',{saved:url.searchParams.get('layout_saved')==='1'}));return true;
  }catch(e){if(e instanceof ProfileError)send(e.status,errorPage('Let’s adjust that trail',e.message));else{log('Gold Trails Compass request unavailable');send(503,errorPage('A pause on your trail','Compass is temporarily unavailable. Your saved profile has not been erased. Please try again.'));}return true;}
 };
}
