import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateResearchBatch,importResearchBatch,identity} from '../app/creator-research.js';
import {createDirectoryStore,searchCriteria} from '../app/directory-store.js';
import {profilePage} from '../app/directory-views.js';
const batch=JSON.parse(readFileSync(new URL('../database/research-imports/creator-enrichment-2026-10-09-a.json',import.meta.url)));
test('research claims validate evidence, counts, identities and unsupported timestamps',()=>{
 assert.doesNotThrow(()=>validateResearchBatch(batch));
 for(const mutate of [b=>b.claims[0].source_url='javascript:bad',b=>b.claims.find(r=>r.field==='public_video_count').value=-1,b=>b.claims.find(r=>r.field==='youtube_channel_id').value='not-a-channel',b=>b.connections[0].timestamp_seconds=20,b=>b.waterways[0].context=null]){const b=structuredClone(batch);mutate(b);assert.throws(()=>validateResearchBatch(b));}
 assert.equal(identity(['creator','source']),identity(['creator','source']));
});
test('duplicate channel is flagged and draft claim evidence retained without rewriting profiles',async()=>{
 const writes=[];let committed=false;const c={beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{},release:()=>{},query:async(sql,values)=>{
  if(sql.startsWith('SELECT id FROM people'))return [{id:'owner-a'}];
  if(sql.includes('SELECT person_id FROM channels'))return [{person_id:'owner-b'}];
  if(sql.startsWith('SELECT'))return [];
  writes.push({sql,values});return {affectedRows:1};
 }};
 const claim=batch.claims.find(r=>r.field==='youtube_channel_id');const result=await importResearchBatch({getConnection:async()=>c},{batch_id:'duplicate',checked_at:batch.checked_at,claims:[claim]});
 assert.equal(result.conflicts,1);assert.ok(committed);const write=writes.find(x=>x.sql.includes('INSERT IGNORE INTO creator_profile_claims'));assert.equal(write.values.at(-1),'conflict');assert.ok(!write.sql.includes('publication_status'));assert.ok(!writes.some(x=>/UPDATE people|DELETE|UPDATE channels/.test(x.sql)));
});
test('waterway identity conflict rolls back entire website import',async()=>{
 let rolled=false;const c={beginTransaction:async()=>{},commit:async()=>assert.fail('Must not commit'),rollback:async()=>{rolled=true;},release:()=>{},query:async sql=>sql.startsWith('SELECT name,')?[{name:'Another river',state_province:'BC',country:'CA',geographic_context:'different',resolution:'verified'}]:[]};
 await assert.rejects(()=>importResearchBatch({getConnection:async()=>c},{batch_id:'bad',checked_at:batch.checked_at,waterways:[batch.waterways[0]]}));assert.ok(rolled);
});
test('specialty discovery binds values and exposes only published accepted research',async()=>{
 const queries=[];const db={query:async(opts,values)=>{const sql=opts.sql;queries.push({sql,values});if(sql.includes('schema_migrations'))return [{version:'005_creator_research'}];if(sql.includes('SELECT DISTINCT field_key'))return [{field_key:'specialty',claim_value:'panning'}];if(sql.includes('COUNT(*)'))return [{total:0}];return [];}};
 await createDirectoryStore(db).search(searchCriteria(new URLSearchParams('specialty=panning')));
 const bound=queries.find(x=>x.sql.includes('COUNT(*)'));assert.ok(bound.values.includes('panning'));assert.match(bound.sql,/cp.publication_status='published'/);assert.match(bound.sql,/cp.review_state='accepted'/);
});
test('profile renders sourced dates and waterways, escapes notes and avoids claiming routine visits',()=>{
 const p={display_name:'Test',slug:'test',offers_instruction:null,roles:[],languages:[],audience:[],formats:[],topics:[],regions:[],channels:[],contacts:[],resources:[],sources:[],researchClaims:[{field_key:'joined_youtube',claim_value:'2020-01-03',source_url:'https://example.com',checked_at:'2026-10-09',assessment:'verified',locator:'About'}],waterways:[{name:'Swift',state_province:'Maine',country:'USA',location_status:'explicit',resolution:'verified',public_note:'<script>not markup</script>',source_url:'https://example.com',title:'Original source',waterway_key:'swift',checked_at:'2026-10-09',inspection_basis:'title_description'}]};
 const output=profilePage(p);assert.match(output,/Joined YouTube/);assert.match(output,/Waterways featured/);assert.match(output,/Repeated visits: Not established/);assert.ok(output.includes('&lt;script&gt;not markup'));assert.ok(!output.includes('<script>not markup'));assert.match(output,/not establish public access/);
});
