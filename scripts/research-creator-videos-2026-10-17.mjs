// Read public source metadata into a review artifact; this script never imports catalog changes.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {creatorCatalog} from '../app/creator-catalog.js';
import {creatorYoutubeDestination} from '../app/creator-channel-links.js';
import {videoLibraryFor} from '../app/creator-video-library.js';
const checkedAt='2026-10-17',output=new URL('../../../outputs/creator-videos-2026-10-17/',import.meta.url);
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,v=>{const n=v.slice(1,-1);return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[n]||(n.startsWith('#x')?String.fromCodePoint(parseInt(n.slice(2),16)):String.fromCodePoint(Number(n.slice(1))));});
const hash=s=>createHash('sha256').update(s).digest('hex');
async function read(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);return r.text();}
const known=creatorCatalog().filter(p=>!videoLibraryFor(p.slug)&&creatorYoutubeDestination(p)?.isChannel).map(p=>({...p,channelUrl:creatorYoutubeDestination(p).url}));
const extraPath=new URL('extra-channels.json',output);let extra=[];try{extra=JSON.parse(await fs.readFile(extraPath,'utf8'));}catch{}
const candidates=[...known,...extra.map(e=>({...creatorCatalog().find(p=>p.slug===e.slug),...e}))];
const results=[];let at=0;
async function worker(){while(at<candidates.length){const p=candidates[at++];try{
 const pageUrl=p.channelUrl.replace(/\/$/,'')+'/videos',page=await read(pageUrl);
 const channelId=page.match(/"channelMetadataRenderer":\{"title":"(?:[^"\\]|\\.)*"[\s\S]*?"externalId":"(UC[\w-]{22})"/)?.[1]||page.match(/<link rel="canonical" href="https:\/\/www.youtube.com\/channel\/(UC[\w-]{22})"/)?.[1];
 if(!channelId)throw Error('No canonical channel ID');
 const title=decode(page.match(/<title>(.*?)<\/title>/s)?.[1]?.replace(/ - YouTube$/,'')||'');
 const feedUrl='https://www.youtube.com/feeds/videos.xml?channel_id='+channelId,xml=await read(feedUrl);
 const feedId=xml.match(/<yt:channelId>(.*?)<\/yt:channelId>/)?.[1];
 if(feedId!==channelId&&'UC'+feedId!==channelId)throw Error('Feed channel mismatch');
 const uploads=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([,e])=>({id:e.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1],channelId:e.match(/<yt:channelId>(.*?)<\/yt:channelId>/)?.[1],title:decode(e.match(/<title>([\s\S]*?)<\/title>/)?.[1]||''),published:e.match(/<published>(.*?)<\/published>/)?.[1]})).filter(v=>v.channelId===channelId&&/^[\w-]{11}$/.test(v.id)&&v.published?.slice(0,10)<=checkedAt);
 await fs.writeFile(new URL(p.slug+'.xml',output),xml);
 const result={slug:p.slug,name:p.name,channelId,channelTitle:title,channelUrl:'https://www.youtube.com/channel/'+channelId,requestedUrl:p.channelUrl,identitySource:p.identitySource||p.official_url,identityNote:p.identityNote||'Existing roster YouTube destination; canonical channel page and uploader feed checked.',checkedAt,pageUrl,pageSha256:hash(page),feedUrl,feedSha256:hash(xml),uploads};results.push(result);
 console.log(p.slug+': '+channelId+' · '+uploads.length+' uploads · '+title);
 }catch(e){results.push({slug:p.slug,name:p.name,requestedUrl:p.channelUrl,checkedAt,error:e.message});console.log(p.slug+': HOLD '+e.message);}}}
await Promise.all([worker(),worker(),worker(),worker()]);
results.sort((a,b)=>a.slug.localeCompare(b.slug));await fs.writeFile(new URL('channel-feed-review.json',output),JSON.stringify({checkedAt,results},null,2)+'\n');
console.log('Review saved: '+results.filter(r=>r.uploads).length+'/'+results.length+' channel feeds verified.');
