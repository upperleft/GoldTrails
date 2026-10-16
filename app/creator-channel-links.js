import {readFileSync} from 'node:fs';
import {videoLibraryFor} from './creator-video-library.js';
const checked=JSON.parse(readFileSync(new URL('./creator-channel-links.json',import.meta.url),'utf8'));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function youtubeDestination(value){
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname))return null;
  const channel=url.hostname!=='youtu.be'&&/^\/(?:channel\/UC[\w-]{22}|@[\w.-]+|(?:c|user)\/[^/]+)(?:\/|$)/.test(url.pathname);
  const video=url.hostname==='youtu.be'?/^\/[\w-]{11}\/?$/.test(url.pathname):url.pathname==='/watch'&&/^[\w-]{11}$/.test(url.searchParams.get('v')||'');
  return channel||video?{url:url.href,isChannel:channel}:null;
 }catch{return null;}
}
export function creatorYoutubeDestination(profile={}){
 const channels=(profile.channels||[]).map(c=>youtubeDestination(c.canonical_url)).filter(Boolean);
 return channels.find(c=>c.isChannel)
  ||youtubeDestination(checked.find(c=>c.slug===profile.slug)?.canonical)
  ||youtubeDestination(videoLibraryFor(profile.slug)?.channelUrl)
  ||youtubeDestination(profile.official_url)
  ||channels[0]||null;
}
export function creatorYoutubeLink(profile){
 const link=creatorYoutubeDestination(profile);
 return link?`<a class="gold-button small creator-youtube-link" href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${link.isChannel?'Watch on YouTube':'Related video on YouTube'} ↗</a>`:'';
}
