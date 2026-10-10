import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactBatch,contactSnapshots,importBusinessContacts,businessContacts,contactCards} from '../app/business-contacts.js';
import {createDashboardRouter} from '../app/admin-dashboard.js';
import {createAdminHandler} from '../app/admin.js';
import {sqlText,contactImportSql} from '../scripts/export-business-contact-sql.mjs';
const batch=contactBatch();
test('reviewed batch preserves all existing entity research and labels tentative addresses',()=>{
 const rows=contactSnapshots();assert.equal(rows.length,23);assert.equal(rows.filter(x=>x.record.creator_slug).length,9);assert.equal(rows.filter(x=>x.record.linked_manufacturer_ids.length).length,15);
 assert(!rows.some(x=>x.record.is_new_gold_trails_candidate));
 const fg=rows.find(x=>x.record.creator_slug==='flour-gold-wizards');assert.equal(fg.record.public_business_email,null);assert.match(fg.record.methods[0].verification_status,/unverified/);
 assert.equal(rows.find(x=>x.record.creator_slug==='klesh').record.social_urls.length,2);
 assert.equal(new Set(rows.map(x=>x.id)).size,23);
 const bad=structuredClone(batch);bad.contacts[0].linked_product_ids=['GT-P9999'];assert.throws(()=>contactSnapshots(bad));
 bad.contacts[0].linked_product_ids=[];bad.contacts[0].source_urls=['javascript:alert(1)'];assert.throws(()=>contactSnapshots(bad));
});
function dbMock({missing=false,fail=false,ready=true}={}){
 const stored=new Map(),calls=[];let commits=0,rollbacks=0;
 const c={beginTransaction:async()=>{},query:async(sql,args=[])=>{calls.push([sql,args]);if(sql.includes('schema_migrations'))return ready?[{version:'008_business_contact_research'}]:[];if(sql.startsWith('SELECT id FROM people'))return missing?[]:[{id:'11111111-1111-4111-8111-111111111111'}];if(sql.startsWith('SELECT id,person_id'))return stored.has(args[0])?[stored.get(args[0])]:[];if(sql.startsWith('INSERT')){if(fail)throw Error('Unavailable');stored.set(args[0],{id:args[0],person_id:args[4]});}return[];},commit:async()=>commits++,rollback:async()=>rollbacks++,release:()=>{}};
 return {getConnection:async()=>c,calls,stored,get commits(){return commits;},get rollbacks(){return rollbacks;}};
}
test('import links actual people, preserves existing data, and is repeatable',async()=>{
 const db=dbMock();const a=await importBusinessContacts(db,'owner');assert.equal(a.added,23);assert.deepEqual(a.missingCreators,[]);
 const b=await importBusinessContacts(db,'owner');assert.equal(b.added,0);assert.equal(b.preserved,23);assert.equal(db.stored.size,23);
 assert(!db.calls.some(([sql])=>/member_|public_contacts|UPDATE people|DELETE FROM/.test(sql)));
 assert.equal(db.commits,2);
});
test('missing people are not invented and failures roll back',async()=>{
 const db=dbMock({missing:true});const out=await importBusinessContacts(db,'owner');assert.equal(out.added,15);assert.equal(out.missingCreators.length,9);
 const unavailable=dbMock({fail:true});await assert.rejects(()=>importBusinessContacts(unavailable,'owner'));assert.equal(unavailable.rollbacks,1);assert.equal(unavailable.commits,0);
 const unmigrated=dbMock({ready:false});await assert.rejects(()=>importBusinessContacts(unmigrated,'owner'));assert.equal(unmigrated.rollbacks,1);
});
test('optional migration leaves existing editor working and contact display escapes values',async()=>{
 assert.deepEqual(await businessContacts({query:async()=>[]}),{ready:false,rows:[]});
 const record=structuredClone(batch.contacts[0]);record.name='<script>x</script>';record.methods[0].notes='<img src=x>';
 const html=contactCards([{record,checked_at:'2026-10-10'}]);assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('&lt;img'));assert.match(html,/target="_blank" rel="noopener noreferrer"/);assert(html.includes('not been delivery-tested'));
});
test('admin contact search matches email and product, and rejects mutations',async()=>{
 const router=createDashboardRouter({contactResearch:async()=>({ready:true,rows:batch.contacts.map(record=>({record,checked_at:'2026-10-10'}))})});
 const url=new URL('https://gold.example/admin/contacts/?q=Kleshkrums');const view=await router(url,null,{},'owner');assert(view.body.includes('Kleshkrums'));assert(!view.body.includes('office@goldhog'));
 assert((await router(new URL('https://gold.example/admin/contacts/?q=GT-P0005'),null,{},'owner')).body.includes('office@goldhog'));
 await assert.rejects(()=>router(url,new URLSearchParams(),{},'owner'));
});
test('contact endpoints inherit authentication and do not call private storage for anonymous users',async()=>{
 let accessed=false,status,headers;const handler=createAdminHandler({store:{session:async()=>null},config:{origin:'https://gold.example'},workspace:{contactResearch:async()=>{accessed=true;}}});
 await handler({method:'GET',headers:{}},{writeHead:(s,h)=>{status=s;headers=h;},end:()=>{}},new URL('https://gold.example/admin/contacts/'));
 assert.equal(status,303);assert.equal(headers.Location,'/admin/login/');assert(!accessed);assert.equal(headers['Cache-Control'],'no-store');
});
test('portable SQL encodes values safely and only changes private research rows',()=>{
 assert.equal(sqlText("a';DROP TABLE people;"),"CONVERT(0x61273b44524f50205441424c452070656f706c653b USING utf8mb4)");
 const sql=contactImportSql();assert.equal((sql.match(/INSERT INTO business_contact_research/g)||[]).length,23);assert(sql.includes('START TRANSACTION;'));assert(sql.includes('COMMIT;'));assert(!/UPDATE member_|INSERT INTO people|INSERT INTO public_contacts|DROP TABLE/.test(sql));
 assert(!readFileSync(new URL('../app/server.js',import.meta.url),'utf8').includes('business-contacts-2026-10-10.json'));
});
