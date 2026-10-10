import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {safeUrl,escapeHtml as h} from './directory-views.js';
import {identity} from './creator-research.js';
const marker='008_business_contact_research';
export const contactBatch=()=>JSON.parse(readFileSync(new URL('../database/research-imports/business-contacts-2026-10-10.json',import.meta.url),'utf8'));
export function contactSnapshots(batch=contactBatch()){
 const catalog=JSON.parse(readFileSync(new URL('./product-catalog.json',import.meta.url),'utf8'));
 const products=new Set(catalog.tables.products.map(p=>p.product_id)),makers=new Set(catalog.tables.manufacturers.map(m=>m.manufacturer_id));
 if(!batch.batch_id||!/^\d{4}-\d{2}-\d{2}$/.test(batch.date_researched)||!Array.isArray(batch.contacts))throw Error('Invalid research batch');
 const seen=new Set();return batch.contacts.map(c=>{
  if(!/^GT-O-[a-f0-9-]{36}$/.test(c.record_id)||seen.has(c.record_id)||!c.name||c.name.length>255||(!c.creator_slug&&!c.linked_manufacturer_ids?.length)||c.creator_slug&&!/^[a-z0-9-]{1,160}$/.test(c.creator_slug))throw Error('Invalid researched entity');seen.add(c.record_id);
  if((c.linked_product_ids||[]).some(x=>!products.has(x))||(c.linked_manufacturer_ids||[]).some(x=>!makers.has(x)))throw Error('Unknown catalog reference');
  for(const u of [...(c.source_urls||[]),...(c.social_urls||[]),...(c.source_observations||[]).map(o=>o.source_url),c.website,c.youtube_url,c.region_source_url].filter(Boolean))if(!safeUrl(u))throw Error('Invalid research URL');
  for(const m of c.methods){if(!['email','form','business_phone','partnership_application'].includes(m.kind)||!m.value||!m.purpose||!m.verification_status||!safeUrl(m.source_url))throw Error('Invalid contact evidence');if(m.kind==='email'&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.value))throw Error('Invalid email');if(['form','partnership_application'].includes(m.kind)&&!safeUrl(m.value))throw Error('Invalid contact page');}
  const json=JSON.stringify(c),hash=createHash('sha256').update(json).digest('hex');return {id:identity([c.record_id,hash]),record:c,json,hash,batch:batch.batch_id,date:batch.date_researched};
 });
}
// Explicit additive import. Never called on startup, dashboard load or signup.
export async function importBusinessContacts(db,actor,batch=contactBatch()){
 if(!actor||actor.length>180)throw Error('Import actor required');const snapshots=contactSnapshots(batch),c=await db.getConnection();const result={added:0,preserved:0,missingCreators:[]};
 try{await c.beginTransaction();
  if(!(await c.query('SELECT version FROM schema_migrations WHERE version=?',[marker])).length)throw Error('Contact migration required');
  for(const s of snapshots){const r=s.record,people=r.creator_slug?await c.query('SELECT id FROM people WHERE slug=? AND is_sample=FALSE AND archived_at IS NULL',[r.creator_slug]):[];const person=people[0]?.id||null;
   if(r.creator_slug&&!person){result.missingCreators.push(r.creator_slug);if(!r.linked_manufacturer_ids.length)continue;}
   const previous=await c.query('SELECT id,person_id FROM business_contact_research WHERE id=? FOR UPDATE',[s.id]);
   if(previous.length){if(person&&!previous[0].person_id)await c.query('UPDATE business_contact_research SET person_id=? WHERE id=? AND person_id IS NULL',[person,s.id]);result.preserved++;continue;}
   await c.query('INSERT INTO business_contact_research(id,research_record_id,snapshot_hash,batch_id,person_id,creator_slug,entity_name,checked_at,snapshot_json,imported_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[s.id,r.record_id,s.hash,s.batch,person,r.creator_slug||null,r.name,s.date,s.json,actor]);result.added++;
  }await c.commit();return result;
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}
export async function businessContacts(db){
 if(!(await db.query('SELECT version FROM schema_migrations WHERE version=?',[marker])).length)return {ready:false,rows:[]};
 const rows=await db.query('SELECT id,person_id,creator_slug,checked_at,snapshot_json,imported_at FROM business_contact_research ORDER BY entity_name,checked_at DESC,imported_at DESC');
 return {ready:true,rows:rows.map(r=>({...r,record:typeof r.snapshot_json==='string'?JSON.parse(r.snapshot_json):r.snapshot_json}))};
}
const external=(u,label)=>safeUrl(u)?`<a href="${h(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${h(label)} ↗</a>`:h(label);
export function contactCards(rows){return rows.map(({person_id,record:r,checked_at})=>`<details class="contact-research"><summary>${h(r.name)} — ${h(r.public_business_email||'Business contact research')}</summary><p>Researched ${h(checked_at)} · ${h(r.research_confidence)} confidence. Public-source research; addresses have not been delivery-tested or confirmed by the account holder.</p>${person_id?`<p><a href="/admin/creators/${h(person_id)}/">Open creator editor</a></p>`:''}<dl class="profile-facts">${[['Public contact name',r.primary_contact_name],['Region / context',r.geographic_region],['Specialty',r.primary_specialty],['Aliases',(r.aliases||[]).join(', ')],['Research notes',r.research_notes],['Source freshness',r.source_freshness_note]].map(([k,v])=>`<div><dt>${h(k)}</dt><dd>${h(v||'TBD')}</dd></div>`).join('')}</dl><p>${external(r.website,'Website')} ${r.youtube_url?external(r.youtube_url,'YouTube'):''}</p><ul>${(r.social_urls||[]).map(u=>`<li>${external(u,'Social profile')}</li>`).join('')}</ul><h3>Alternate business contacts</h3><ul>${r.methods.map(m=>`<li><strong>${h(m.kind.replaceAll('_',' '))}: ${['form','partnership_application'].includes(m.kind)?external(m.value,'Contact page'):h(m.value)}</strong><br>${h(m.purpose)} · ${h(m.verification_status.replaceAll('_',' '))}<br>${h(m.notes||'')} ${external(m.source_url,'Source')}</li>`).join('')||'<li>No usable contact route found yet.</li>'}</ul><h3>Evidence &amp; source notes</h3><ul>${(r.source_observations||[]).map(o=>`<li>${external(o.source_url,'Original source')} — ${h(o.source_status?.replaceAll('_',' '))}<br>${h(o.research_notes||'')} ${h(o.source_freshness_note||'')}</li>`).join('')}</ul><h3>Linked products</h3><ul>${(r.linked_product_ids||[]).map((id,i)=>`<li><a href="/admin/products/${h(id)}/">${h(r.linked_product_names?.[i]||id)}</a></li>`).join('')||'<li>No equipment catalog links.</li>'}</ul></details>`).join('');}
