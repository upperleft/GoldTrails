import {createHash} from 'node:crypto';

const channelIdPattern=/^UC[A-Za-z0-9_-]{22}$/;
const videoIdPattern=/^[A-Za-z0-9_-]{11}$/;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const clean=value=>typeof value==='string'?value.trim():'';
const normalized=value=>clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slugged=value=>normalized(value).replace(/\s+/g,'-').replace(/^-+|-+$/g,'');
const validDate=value=>datePattern.test(value)&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

function channelIdFromUrl(value){
 try{
  const url=new URL(value);
  if(!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname.toLowerCase()))return null;
  const match=url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
  return match?.[1]||null;
 }catch{return null;}
}

function catalogChannelIds(person){
 return [...new Set([
  person.youtube_channel_id,
  person.official_url,
  ...(Array.isArray(person.channel_aliases)?person.channel_aliases:[])
 ].map(value=>channelIdPattern.test(value||'')?value:channelIdFromUrl(value)).filter(Boolean))];
}

function validateInput(input){
 if(!input||input.version!==1||!Array.isArray(input.creators))throw new Error('Expected version 1 research JSON with a creators array.');
 if(input.creators.length>1000)throw new Error('Research batch exceeds 1,000 creators.');
 const ids=new Map(),channels=new Map();
 for(const creator of input.creators){
  const name=clean(creator?.name),channelId=clean(creator?.channelId);
  if(!name||name.length>180||!channelIdPattern.test(channelId)||creator.channelUrl!==`https://www.youtube.com/channel/${channelId}`||!Array.isArray(creator.videos)||creator.videos.length===0)throw new Error('Each creator needs a name, canonical channel ID/URL and at least one video.');
  const previousName=channels.get(channelId);
  if(previousName&&previousName!==name)throw new Error(`Channel ${channelId} has conflicting names in this batch.`);
  channels.set(channelId,name);
  for(const video of creator.videos){
   const id=clean(video?.id),title=clean(video?.title),checkedAt=clean(video?.checkedAt);
   if(!videoIdPattern.test(id)||!title||title.length>600||video?.url!==`https://www.youtube.com/watch?v=${id}`||!validDate(checkedAt)||video.channelId!==channelId||!Array.isArray(video.tags)||video.tags.length>30||video.tags.some(tag=>!clean(tag)||tag.length>120)||!clean(video.subject)||clean(video.subject).length>180)throw new Error(`Invalid video evidence for channel ${channelId}.`);
   const prior=ids.get(id);
   if(prior&&(prior.channelId!==channelId||prior.title!==title))throw new Error(`Video ${id} conflicts within this batch.`);
   ids.set(id,{channelId,title});
  }
 }
 return input;
}

function newCreatorSlug(name,channelId,catalog){
 const base=slugged(name)||'creator';
 const existing=new Set(catalog.map(person=>person.slug));
 if(!existing.has(base))return base;
 return `${base}-${channelId.slice(-6).toLowerCase()}`;
}

/**
 * Reconcile a normalized public YouTube research batch into the site's two
 * file-backed directory inputs. Stable YouTube IDs are the only automatic
 * identity key. Ambiguous name-only matches are returned for review.
 */
export function reconcileCreatorResearch(input,catalog,library,{today=new Date().toISOString().slice(0,10)}={}){
 validateInput(input);
 if(!Array.isArray(catalog)||!library||!Array.isArray(library.creators))throw new Error('Current site creator sources are invalid.');
 if(!validDate(today))throw new Error('Supply today as YYYY-MM-DD.');
 const nextCatalog=structuredClone(catalog),nextLibrary=structuredClone(library);
 const exceptions=[],addedCreators=[],addedVideos=[],preservedVideos=[];
 const channelOwners=new Map();
 for(const person of nextCatalog){
  for(const id of catalogChannelIds(person)){
   const owners=channelOwners.get(id)||[];owners.push(person);channelOwners.set(id,owners);
  }
 }
 for(const creator of nextLibrary.creators){
  const owners=channelOwners.get(creator.channelId)||[];
  if(!owners.some(owner=>owner.slug===creator.slug)){
   const owner={slug:creator.slug,name:creator.name,official_url:creator.channelUrl,status:'verified',checked_at:creator.checkedAt||nextLibrary.checkedAt,youtube_channel_id:creator.channelId,verification_scope:'channel_identity_and_public_metadata_only'};
   nextCatalog.push(owner);owners.push(owner);channelOwners.set(creator.channelId,owners);
  }
 }
 const videoOwners=new Map();
 for(const creator of nextLibrary.creators)for(const video of creator.videos){
  const owners=videoOwners.get(video.id)||[];owners.push({creator,video});videoOwners.set(video.id,owners);
 }
 for(const incoming of input.creators){
  const existingOwners=channelOwners.get(incoming.channelId)||[];
  let profile=existingOwners.length===1?existingOwners[0]:null;
  if(existingOwners.length>1){exceptions.push({channelId:incoming.channelId,name:incoming.name,reason:'multiple existing profiles claim this YouTube channel'});continue;}
  const videoConflict=incoming.videos.find(video=>{
   const owners=videoOwners.get(video.id)||[];
   return owners.length>1||owners.length===1&&(owners[0].creator.channelId!==incoming.channelId||owners[0].video.title!==video.title);
  });
  if(videoConflict){exceptions.push({channelId:incoming.channelId,videoId:videoConflict.id,name:incoming.name,reason:'video ID already belongs to a different or ambiguous channel, or its existing title differs'});continue;}
  if(!profile){
   const sameName=nextCatalog.filter(person=>normalized(person.name)===normalized(incoming.name));
   if(sameName.length){exceptions.push({channelId:incoming.channelId,name:incoming.name,reason:'matching creator name exists without a confirmed channel-ID match'});continue;}
   const slug=newCreatorSlug(incoming.name,incoming.channelId,nextCatalog);
   profile={slug,name:incoming.name,official_url:incoming.channelUrl,status:'lead',checked_at:today,youtube_channel_id:incoming.channelId,verification_scope:'channel_identity_and_public_metadata_only'};
   nextCatalog.push(profile);channelOwners.set(incoming.channelId,[profile]);addedCreators.push({slug,name:incoming.name,channelId:incoming.channelId});
  }
  let libraryCreator=nextLibrary.creators.find(row=>row.channelId===incoming.channelId);
  if(libraryCreator&&libraryCreator.slug!==profile.slug){exceptions.push({channelId:incoming.channelId,name:incoming.name,reason:'site video library maps this channel to a different profile slug'});continue;}
  if(!libraryCreator){
   libraryCreator={slug:profile.slug,name:profile.name||incoming.name,channelId:incoming.channelId,channelUrl:incoming.channelUrl,attributionScope:'uploader_channel',uploaderName:incoming.name,videos:[]};
   nextLibrary.creators.push(libraryCreator);
  }
  for(const video of incoming.videos){
   const owners=videoOwners.get(video.id)||[];
   if(owners.length){
    if(owners.length!==1||owners[0].creator.channelId!==incoming.channelId){exceptions.push({channelId:incoming.channelId,videoId:video.id,name:incoming.name,reason:'video ID already belongs to a different or ambiguous channel, or its existing title differs'});continue;}
    const current=owners[0].video;
    preservedVideos.push(video.id);continue;
   }
   libraryCreator.videos.push({id:video.id,title:video.title,url:video.url,channelId:incoming.channelId,ownershipStatus:'source_checked',checkedAt:video.checkedAt,subject:video.subject,tags:[...new Set(video.tags.map(clean))]});
   videoOwners.set(video.id,[{creator:libraryCreator,video:libraryCreator.videos.at(-1)}]);addedVideos.push(video.id);
  }
 }
 nextLibrary.creators.sort((a,b)=>a.name.localeCompare(b.name));
 for(const creator of nextLibrary.creators)creator.videos.sort((a,b)=>a.id.localeCompare(b.id));
 if(addedCreators.length||addedVideos.length){
  nextLibrary.checkedAt=today;
  nextLibrary.inputSha256=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 }
 return {
  catalog:nextCatalog,
  library:nextLibrary,
  summary:{addedCreators:addedCreators.length,addedVideos:addedVideos.length,preservedVideos:new Set(preservedVideos).size,exceptions:exceptions.length},
  addedCreators,addedVideos:[...new Set(addedVideos)],exceptions
 };
}
