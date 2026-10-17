import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {creatorCatalog} from '../app/creator-catalog.js';
import {creatorYoutubeDestination} from '../app/creator-channel-links.js';
const rows=creatorCatalog().filter(p=>!creatorYoutubeDestination(p)),results=[];let at=0;
async function worker(){while(at<rows.length){const p=rows[at++];try{
 const r=await fetch(p.official_url,{signal:AbortSignal.timeout(20000)});const html=await r.text();
 const text=html.replace(/\\\//g,'/').replace(/\\u0026/g,'&').replace(/&amp;/g,'&');
 const links=[...new Set([...text.matchAll(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s"'<>\\]+/gi)].map(m=>m[0]))];
 results.push({slug:p.slug,name:p.name,source_url:p.official_url,checkedAt:'2026-10-17',status:r.status,title:text.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1],sha256:createHash('sha256').update(html).digest('hex'),links});console.log(p.slug+': '+r.status+' '+JSON.stringify(links));
 }catch(e){results.push({slug:p.slug,source_url:p.official_url,error:e.message});console.log(p.slug+': '+e.message);}}}
await Promise.all([worker(),worker(),worker(),worker()]);await fs.writeFile(new URL('../../../outputs/creator-videos-2026-10-17/missing-channel-review.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
