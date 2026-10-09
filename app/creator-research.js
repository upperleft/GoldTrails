import { createHash } from 'node:crypto';
export const fields = new Set(['public_name','short_bio','youtube_channel_id','youtube_canonical_url','joined_youtube','earliest_prospecting_video_date','latest_prospecting_video_date','prospecting_start_year','experience_statement','experience_statement_date','public_video_count','video_count_basis','website','social_link','region','specialty']);
export const specialties = new Set(['beginner-instruction','fine-flour-gold','panning','sluicing','crevicing','bedrock','highbanking','metal-detecting','geology','equipment-reviews','river-reading','dredging','rockhounding']);
const multi = new Set(['region','specialty','social_link']);
const publicUrl = value => { const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid public URL'); };
const date = value => {if(value==null)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value>new Date().toISOString().slice(0,10))throw Error('Invalid factual date');};
export function identity(value) {const h=createHash('sha256').update(JSON.stringify(value)).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;}
export function validateResearchBatch(b) {
 date(b.checked_at);if(!b.checked_at||!b.batch_id)throw Error('Batch identity/date required');
 for(const r of b.claims||[]){
  if(!fields.has(r.field)||!String(r.value??'').trim()||String(r.value).length>1000||!r.note?.trim()||!r.locator?.trim()||!['verified','creator_stated','uncertain'].includes(r.assessment))throw Error('Invalid claim');
  publicUrl(r.source_url);date(r.statement_date);
  if(r.field==='youtube_channel_id'&&!/^UC[\w-]{22}$/.test(r.value))throw Error('Invalid channel ID');
  if(['joined_youtube','earliest_prospecting_video_date','latest_prospecting_video_date','experience_statement_date'].includes(r.field))date(r.value);
  if(['website','social_link','youtube_canonical_url'].includes(r.field))publicUrl(r.value);
  if(r.field==='specialty'&&!specialties.has(r.value))throw Error('Unsupported specialty');
  if(r.field==='prospecting_start_year'&&(!Number.isInteger(r.value)||r.value<1800||r.value>new Date().getUTCFullYear()))throw Error('Invalid experience year');
  if(r.field==='public_video_count'&&(!Number.isSafeInteger(r.value)||r.value<0||!b.claims.some(x=>x.creator===r.creator&&x.field==='video_count_basis')))throw Error('Count needs basis');
  if(r.field==='video_count_basis'&&!['exact','approximate','historical'].includes(r.value))throw Error('Invalid count basis');
 }
 for(const w of b.waterways||[]){publicUrl(w.identity_source);if(!w.name||!w.identity_note||!['verified','unresolved'].includes(w.resolution)||!['river','creek','other'].includes(w.kind)||!/^[a-z0-9-]{1,160}$/.test(w.key))throw Error('Invalid waterway');if(w.resolution==='verified'&&(!w.country||!w.state_province||!w.context))throw Error('Geographic identity required');if(w.parent_key&&!w.parent_source)throw Error('Tributary evidence required');if(w.parent_source)publicUrl(w.parent_source);}
 for(const e of b.connections||[]){publicUrl(e.source_url);date(e.publication_date);if(!e.title||!e.note||!['video','webpage','pdf'].includes(e.kind)||!['explicit','uncertain'].includes(e.location_status)||!['footage','title_description','article'].includes(e.inspection_basis)||(e.techniques||[]).some(x=>!specialties.has(x)))throw Error('Invalid connection');if(e.timestamp_seconds!=null&&(!Number.isInteger(e.timestamp_seconds)||e.timestamp_seconds<0||e.inspection_basis!=='footage'))throw Error('Timestamp requires inspected footage');}
}
export async function importResearchBatch(db,b) {
 validateResearchBatch(b);const c=await db.getConnection();const summary={claims:0,connections:0,conflicts:0,missingCreators:[]};
 try {
  await c.beginTransaction();
  const ids=new Map();for(const slug of new Set([...(b.claims||[]).map(r=>r.creator),...(b.connections||[]).map(r=>r.creator)])){const rows=await c.query('SELECT id FROM people WHERE slug=? AND archived_at IS NULL',[slug]);if(rows.length)ids.set(slug,rows[0].id);else summary.missingCreators.push(slug);}
  const conflict=async(person,field,value,reason)=>{await c.query('INSERT IGNORE INTO creator_research_conflicts(id,person_id,field_key,proposed_json,reason) VALUES(?,?,?,?,?)',[identity([person,field,value]),person,field,JSON.stringify(value),reason]);summary.conflicts++;};
  for(const r of b.claims||[]){
   const person=ids.get(r.creator);if(!person)continue;
   const old=await c.query("SELECT claim_value FROM creator_profile_claims WHERE person_id=? AND field_key=? AND review_state='accepted' AND archived_at IS NULL",[person,r.field]);
   let state=r.assessment==='uncertain'?'pending':'accepted';
   if(!multi.has(r.field)&&old.some(x=>x.claim_value!==String(r.value)))state='conflict';
   if(r.field==='youtube_channel_id'){
    const owners=await c.query("SELECT person_id FROM channels WHERE platform='YouTube' AND external_channel_id=? UNION SELECT person_id FROM creator_channel_identities WHERE channel_id=?",[r.value,r.value]);
    if(owners.some(x=>x.person_id!==person))state='conflict';
   }
   if(r.field==='youtube_channel_id'&&state==='accepted'){
    await c.query('INSERT IGNORE INTO creator_channel_identities(channel_id,person_id) VALUES(?,?)',[r.value,person]);
    const owners=await c.query('SELECT person_id FROM creator_channel_identities WHERE channel_id=? FOR UPDATE',[r.value]);
    if(owners.some(x=>x.person_id!==person))state='conflict';
   }
   if(state==='conflict')await conflict(person,r.field,r,'Conflicting claim or channel already assigned; original retained');
   const id=identity([person,r.field,String(r.value),r.source_url,r.locator]);
   await c.query('INSERT IGNORE INTO creator_profile_claims(id,person_id,field_key,claim_value,source_url,locator,evidence_note,assessment,checked_at,statement_date,review_state) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,person,r.field,String(r.value),r.source_url,r.locator,r.note,r.assessment,b.checked_at,r.statement_date||null,state]);summary.claims++;
  }
  for(const w of b.waterways||[]){
   const duplicates=await c.query("SELECT identity_key FROM waterways WHERE name=? AND COALESCE(state_province,'')=? AND COALESCE(country,'')=? AND COALESCE(geographic_context,'')=? AND resolution='verified' AND identity_key<>?",[w.name,w.state_province||'',w.country||'',w.context||'',w.key]);
   if(w.resolution==='verified'&&duplicates.length)throw Error('Duplicate waterway identity; use existing key');
   const old=await c.query('SELECT name,state_province,country,geographic_context,resolution FROM waterways WHERE identity_key=?',[w.key]);
   if(old.length&&['name','state_province','country','resolution'].some(k=>old[0][k]!==w[k])||old.length&&old[0].geographic_context!==w.context)throw Error('Waterway identity conflict; batch rolled back');
   await c.query('INSERT IGNORE INTO waterways(identity_key,name,kind,state_province,country,geographic_context,resolution,identity_source,identity_note,checked_at,parent_key,watershed,parent_source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[w.key,w.name,w.kind,w.state_province||null,w.country||null,w.context||null,w.resolution,w.identity_source,w.identity_note,b.checked_at,w.parent_key||null,w.watershed||null,w.parent_source||null]);
  }
  for(const e of b.connections||[]){
   const person=ids.get(e.creator);if(!person)continue;const hash=createHash('sha256').update(e.source_url).digest('hex');const id=identity([person,e.waterway,e.source_url]);
   const old=await c.query('SELECT title,public_note,publication_date,timestamp_seconds,techniques_json,location_status,inspection_basis,visit_key FROM creator_waterway_evidence WHERE id=?',[id]);
   if(old.length){const x=old[0];const tech=typeof x.techniques_json==='string'?JSON.parse(x.techniques_json):x.techniques_json;if(x.title!==e.title||x.public_note!==e.note||x.publication_date!==(e.publication_date||null)||x.timestamp_seconds!==(e.timestamp_seconds??null)||JSON.stringify(tech)!==JSON.stringify(e.techniques||[])||x.location_status!==e.location_status||x.inspection_basis!==e.inspection_basis||x.visit_key!==(e.visit_key||null))await conflict(person,'waterway',e,'Changed supporting record; original retained');continue;}
   await c.query('INSERT INTO creator_waterway_evidence(id,person_id,waterway_key,source_url,source_identity,title,kind,publication_date,timestamp_seconds,techniques_json,public_note,location_status,inspection_basis,visit_key,checked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,person,e.waterway,e.source_url,hash,e.title,e.kind,e.publication_date||null,e.timestamp_seconds??null,JSON.stringify(e.techniques||[]),e.note,e.location_status,e.inspection_basis,e.visit_key||null,b.checked_at]);summary.connections++;
  }
  await c.commit();return summary;
 } catch(e){await c.rollback();throw e;}finally{c.release();}
}
