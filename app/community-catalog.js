import {readFileSync} from 'node:fs';
export function validateCommunityCatalog(data){
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<1600;
 const url=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
 const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v+'T00:00:00Z'));
 if(data?.schemaVersion!==1||!date(data.checkedAt)||!Array.isArray(data.entries))throw new Error('Invalid community catalog');
 const ids=new Set(),urls=new Set();
 for(const e of data.entries){
  if(!/^[a-z][a-z0-9-]+$/.test(e.id||'')||ids.has(e.id)||!['listed','historical_archive'].includes(e.status)||!['Club','Association','Meetup group','Online community','Historical archive'].includes(e.kind)||['name','region','location','summary','accessNote','verification'].some(k=>!text(e[k]))||!date(e.checkedAt)||!Array.isArray(e.topics)||e.topics.length<1||e.topics.length>4||e.topics.some(t=>!text(t))||!Array.isArray(e.sources)||!e.sources.length||e.sources.some(s=>!text(s.label)||!url(s.url))||!Array.isArray(e.links)||!e.links.length)throw new Error('Invalid community entry');
  if((e.status==='historical_archive')!==(e.kind==='Historical archive'))throw new Error('Archive must be explicitly classified');
  for(const l of e.links){
   if(!text(l.label)||!url(l.url)||urls.has(l.url)||!['Website','Facebook','Meetup','Forum','Reddit','Google Groups'].includes(l.platform))throw new Error('Invalid community link');
   const host=new URL(l.url).hostname;
   if((l.platform==='Facebook'&&!/^www\.facebook\.com$/.test(host))||(l.platform==='Meetup'&&host!=='www.meetup.com')||(l.platform==='Reddit'&&host!=='www.reddit.com')||(l.platform==='Google Groups'&&host!=='groups.google.com'))throw new Error('Community platform mismatch');
   urls.add(l.url);
  }
  ids.add(e.id);
 }
 return data;
}
export const communityCatalog=validateCommunityCatalog(JSON.parse(readFileSync(new URL('./community-catalog.json',import.meta.url),'utf8')));
