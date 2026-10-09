import test from 'node:test';
import assert from 'node:assert/strict';
import {planCatalog,importCatalog,channelKey,CatalogConflict} from '../app/catalog-import.js';
import {createAdminHandler} from '../app/admin.js';
import {createServer} from '../app/server.js';
const row={slug:'new-creator',name:'New creator',official_url:'https://www.youtube.com/@newcreator',region:null,status:'lead',checked_at:'2026-10-08'};
test('import plan preserves existing and archived records, detects channel ownership and separates videos',()=>{
 assert.equal(channelKey('https://www.youtube.com/@Name/videos'),channelKey('https://youtube.com/@name/'));
 assert.notEqual(channelKey('https://youtube.com/watch?v=one'),channelKey('https://youtube.com/watch?v=two'));
 assert.equal(planCatalog([row],[{slug:row.slug,archived_at:'2026-10-01'}],[]).preserve,1);
 assert.equal(planCatalog([row],[],[{canonical_url:'https://youtube.com/@NEWCREATOR/'}]).conflicts,1);
 assert.throws(()=>planCatalog([{...row,official_url:'javascript:alert(1)'}],[],[]),CatalogConflict);
});
function fakeDb({failure=false,people=[],channels=[]}={}){const calls=[];let committed=false,rolled=false;const conn={beginTransaction:async()=>{},query:async(sql,values=[])=>{calls.push({sql,values});if(sql.startsWith('SELECT id,slug,publication_status'))return people;if(sql.startsWith('SELECT id,person_id,canonical_url'))return channels;if(sql.includes("FROM formats"))return[{id:'article-id',code:'article'},{id:'video-id',code:'video'}];if(sql.includes('FROM public_roles'))return[{id:'creator-role'}];if(failure&&sql.startsWith('INSERT INTO channels'))throw Error('simulated failure');return[];},commit:async()=>{committed=true},rollback:async()=>{rolled=true},release:()=>{}};return {getConnection:async()=>conn,calls,get committed(){return committed},get rolled(){return rolled}};}
test('batch import writes minimal sourced records, preserves unknowns and rolls back failure',async()=>{
 const digest=planCatalog([row],[],[]).digest,db=fakeDb();const result=await importCatalog(db,{rows:[row],expectedDigest:digest,actor:'Paul'});
 assert.equal(result.created,1);assert(db.committed);const person=db.calls.find(x=>x.sql.startsWith('INSERT INTO people'));assert.equal(person.values[5],null);assert.equal(person.values[6],'published');assert(!db.calls.some(x=>x.sql.startsWith('UPDATE people')));assert(db.calls.some(x=>x.sql.includes('creator_change_log')));
 const failure=fakeDb({failure:true});await assert.rejects(importCatalog(failure,{rows:[row],expectedDigest:digest,actor:'Paul'}));assert(failure.rolled&&!failure.committed);
 const stale=fakeDb();await assert.rejects(importCatalog(stale,{rows:[row],expectedDigest:'a'.repeat(64),actor:'Paul'}),CatalogConflict);assert(stale.rolled&&!stale.calls.some(x=>x.sql.startsWith('INSERT')));
});
test('source videos are retained as evidence and do not create fake channels',async()=>{const video={...row,official_url:'https://youtube.com/watch?v=abc'};const db=fakeDb();await importCatalog(db,{rows:[video],expectedDigest:planCatalog([video],[],[]).digest,actor:'Paul'});assert(!db.calls.some(x=>x.sql.startsWith('INSERT INTO channels')));assert(db.calls.some(x=>x.sql.startsWith('INSERT INTO source_references')));});
test('replaying a reviewed import preserves creators without inserting again',async()=>{const people=[{id:'existing',slug:row.slug,publication_status:'published',archived_at:null,edit_version:0}],db=fakeDb({people});const result=await importCatalog(db,{rows:[row],expectedDigest:planCatalog([row],people,[]).digest,actor:'Paul'});assert.equal(result.created,0);assert.equal(result.preserved,1);assert(!db.calls.some(x=>x.sql.startsWith('INSERT')));});
test('administrator import requires authentication, origin and CSRF, and GET never imports',async()=>{
 const csrf='a'.repeat(64);let writes=0;const store={session:async raw=>raw==='b'.repeat(64)?{authenticated:true,csrf_token:csrf}:null,catalogPreview:async()=>({entries:[],add:0,preserve:0,conflicts:0,digest:'b'.repeat(64)}),catalogImport:async()=>{writes++;return{created:1,preserved:0,conflicts:[]};}};
 const server=createServer({admin:createAdminHandler({store,config:{username:'Paul',origin:'https://gold.example'},log:()=>{}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+server.address().port,path='/admin/creators/import/';
 try {assert.equal((await fetch(root+path,{redirect:'manual'})).status,303);assert.equal((await fetch(root+path,{headers:{Cookie:'__Host-gold-admin='+'b'.repeat(64)}})).status,200);assert.equal(writes,0);const post=async(origin,token)=>fetch(root+path,{method:'POST',headers:{Cookie:'__Host-gold-admin='+'b'.repeat(64),Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:token,visibility:'published',digest:'b'.repeat(64)})});assert.equal((await post('https://other.example',csrf)).status,403);assert.equal((await post('https://gold.example','wrong')).status,403);assert.equal(writes,0);assert.equal((await post('https://gold.example',csrf)).status,200);assert.equal(writes,1);}finally{await new Promise(r=>server.close(r));}
});

import {backupCreators,creatorBackupTables} from '../app/catalog-import.js';
test('creator backups use one read transaction and exclude credentials, members and billing',async()=>{const sql=[];let committed=false;const conn={beginTransaction:async()=>{},query:async q=>{sql.push(q);return q.includes('schema_migrations')?[{version:'003_creator_associates'}]:[];},commit:async()=>{committed=true},rollback:async()=>{},release:()=>{}};const backup=await backupCreators({getConnection:async()=>conn});assert(committed);assert.equal(backup.format,'gold-trails-creator-backup-v1');assert('creator_associates' in backup.tables);assert(!creatorBackupTables.some(t=>/member|session|password|billing|account/.test(t)));assert(sql.every(q=>q.startsWith('SELECT')||q==='SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'));});
