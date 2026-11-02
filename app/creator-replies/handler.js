import {CreatorReplyInputError,replyBatch,syncKeyHash,syncAuthorized} from './model.js';
import {creatorRepliesView} from './views.js';

export function createCreatorRepliesImportHandler({store=null,syncKey=process.env.CREATOR_REPLY_SYNC_KEY,log=console.error}={}){
 const keyHash=syncKeyHash(syncKey);
 const handler=async(req,res,url)=>{
  if(url.pathname!=='/api/creator-replies/import')return false;
  const send=(status,data,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...extra});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
  if(req.method!=='POST'){send(405,{error:'Use authenticated POST.'},{Allow:'POST'});return true;}
  if(url.search){send(400,{error:'Use the exact import endpoint without a query.'});return true;}
  // This is a server-to-server endpoint. No browser origin or CORS permission is accepted.
  if(req.headers.origin){send(403,{error:'Browser-origin imports are unavailable.'});return true;}
  if(!keyHash){send(503,{error:'Creator reply imports are not configured.'});return true;}
  if(!syncAuthorized(req.headers.authorization,keyHash)){send(401,{error:'Import authorization required.'},{'WWW-Authenticate':'Bearer'});return true;}
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')){send(415,{error:'Use JSON metadata.'});return true;}
  if(Number(req.headers['content-length'])>32768){send(413,{error:'Keep metadata batches within 32 KiB.'});return true;}
  try{
   let length=0;const chunks=[];
   for await(const chunk of req){length+=chunk.length;if(length>32768){send(413,{error:'Keep metadata batches within 32 KiB.'});return true;}chunks.push(chunk);}
   let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(400,{error:'Use valid JSON metadata.'});return true;}
   const records=replyBatch(value);
   if(!store||!await store.ready()){send(503,{error:'Creator reply storage is unavailable.'});return true;}
   const result=await store.importBatch(records);
   send(200,{ok:true,...result});return true;
  }catch(error){
   if(error instanceof CreatorReplyInputError){send(400,{error:'Check the creator reply metadata.'});return true;}
   log('Gold Trails creator reply import unavailable');
   send(503,{error:'Creator reply import was not confirmed. Retry the same message IDs.'});return true;
  }
 };
 handler.configured=Boolean(keyHash);
 return handler;
}

// Called only after the existing administrator session, same-origin and CSRF checks.
export function createAdminCreatorRepliesRouter({store=null,configured=false,log=console.error}={}){
 return async(url,f,session,actor)=>{
  if(!['/admin/creator-replies/','/admin/creator-replies'].includes(url.pathname))return null;
  if(!url.pathname.endsWith('/'))return {redirect:'/admin/creator-replies/'};
  const result=(body,status=200)=>({title:'Creator replies',body,status});
  try{
   if(!store||!await store.ready())return result('<section class="resource-placeholder"><h2>Creator reply references are being prepared</h2><p>The private metadata storage needs setup. Existing invitations and accounts remain available.</p></section>',503);
   if(f)await store.review(f.get('id'),f.get('status'),actor);
   return result(creatorRepliesView(await store.overview(),session,{configured,notice:f?'Reply reference review saved.':''}));
  }catch(error){
   if(error instanceof CreatorReplyInputError)return result('<p role="alert">Choose a valid reply and review status.</p><p><a href="/admin/creator-replies/">Return to creator replies</a></p>',400);
   log('Gold Trails creator reply workspace unavailable');
   return result('<section class="resource-placeholder"><h2>Creator replies are temporarily unavailable</h2><p>Please try again shortly. Your mailbox and existing invitation access remain available.</p></section>',503);
  }
 };
}
