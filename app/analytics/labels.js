import {readFileSync} from 'node:fs';
const videos=new Map();
for(const file of ['../creator-video-library.json','../product-demonstrations.json']){
 try{const data=JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));for(const creator of data.creators||[])for(const v of creator.videos)videos.set(v.id,v.title+' · '+creator.name);for(const v of data.videos||[])videos.set(v.id,v.title+' · '+v.uploaderName);}catch{/* Optional catalogs may not be part of an older deployment. */}
}
export function destinationLabel(value){
 try{const u=new URL(value),id=u.hostname==='youtu.be'?u.pathname.slice(1):/^(?:www\.)?youtube\.com$/.test(u.hostname)?u.searchParams.get('v'):null;return videos.get(id)||u.hostname.replace(/^www\./,'')+u.pathname;}catch{return String(value);}
}
