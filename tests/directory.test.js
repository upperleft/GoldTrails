import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionOptions } from '../app/database.js';
import { createDirectoryStore, searchCriteria } from '../app/directory-store.js';
import { display, safeUrl, profilePage } from '../app/directory-views.js';
import { createServer } from '../app/server.js';

const profile = { id:'private-id', slug:'test-prospector', display_name:'Test <Prospector>', short_introduction:null, biography:'Line one\n<script>alert(1)</script>', primary_region:null, primary_region_slug:null, country_code:null, state_province:null, experience_since_year:null, offers_instruction:0, nickname:null, verification_status:'unverified', roles:[], languages:[], audience:[], formats:[], topics:[{slug:'panning',name:'Panning'}], regions:[], channels:[{platform:'YouTube',channel_name:'A & B',canonical_url:'javascript:alert(1)',description:null,publishing_since_year:null}], contacts:[], resources:[], sources:[] };

test('TBD preserves zero and false, and unsafe destinations remain non-clickable', () => {
  assert.equal(display(null),'TBD'); assert.equal(display('  '),'TBD'); assert.equal(display(false),'No'); assert.equal(display(0),'0');
  assert.equal(safeUrl('javascript:alert(1)'),null); assert.equal(safeUrl('https://user:password@example.com'),null);
  assert.equal(safeUrl('https://example.com/channel'),'https://example.com/channel');
  const rendered = profilePage(profile);
  assert.ok(rendered.includes('Test &lt;Prospector&gt;'));
  assert.ok(!rendered.includes('<script>')); assert.ok(!rendered.includes('javascript:')); assert.ok(!rendered.includes('private-id'));
  assert.match(rendered,/Offers instruction<\/dt><dd>No<\/dd>/);
  assert.match(rendered,/Publishing since: TBD/); assert.match(rendered,/href="\/"/);
});

test('search validates input before querying', () => {
  assert.equal(searchCriteria(new URLSearchParams('page=-1')),null);
  assert.equal(searchCriteria(new URLSearchParams('page=1e9')),null);
  assert.equal(searchCriteria(new URLSearchParams('q='+'x'.repeat(101))),null);
  assert.equal(searchCriteria(new URLSearchParams('topic=bad/slash')),null);
  assert.equal(searchCriteria(new URLSearchParams('page=0')),null);
  assert.deepEqual(searchCriteria(new URLSearchParams()),{q:'',topic:'',region:'',page:1,pageSize:20});
});

test('directory queries bind hostile input and escape literal LIKE wildcards', async () => {
  const queries=[];
  const db={query:async (options,values)=>{ queries.push({sql:options.sql,values}); return options.sql.includes('COUNT(*)') ? [{total:0n}] : []; }};
  const q="x%' OR 1=1 --";
  await createDirectoryStore(db).search({q,topic:'panning',region:'california',page:2,pageSize:20});
  assert.ok(!queries[0].sql.includes(q)); assert.equal(queries[0].values[0],"%x=%' OR 1==1 --%");
  assert.match(queries[0].sql,/p.is_sample = 0/); assert.match(queries[0].sql,/p.archived_at IS NULL/);
  assert.match(queries[0].sql,/p.publication_status = 'published'/);
  assert.deepEqual(queries[1].values.slice(-2),[20,20]);
  for(const query of queries) assert.equal((query.sql.match(/\?/g)||[]).length,query.values.length);
});

test('missing and archived profiles stop before fetching linked or private data', async () => {
  let queries=0;
  const store=createDirectoryStore({query:async()=>{queries++;return [{display_name:'Archived Person',archived_at:'2026-10-01',biography:'Private retained text'}];}});
  assert.deepEqual(await store.profile('archived-person'),{archived:true,display_name:'Archived Person'});
  assert.equal(queries,1);
  assert.equal(await createDirectoryStore({query:async()=>[]}).profile('missing'),null);
});

test('active profile uses explicit fields and excludes archived/unpublished connections', async () => {
  const queries=[];
  const store=createDirectoryStore({query:async(options,values)=>{queries.push({sql:options.sql,values});return queries.length===1 ? [profile] : [];}});
  const result=await store.profile('test-prospector');
  assert.equal(result.display_name,profile.display_name);
  assert.ok(Array.isArray(result.channels) && Array.isArray(result.sources));
  for(const query of queries){assert.ok(!query.sql.includes('SELECT *'));assert.equal((query.sql.match(/\?/g)||[]).length,query.values.length);}
  assert.ok(queries.slice(1).filter(q=>!q.sql.includes('schema_migrations')).every(q=>q.sql.includes('archived_at IS NULL')));
  const sourceQuery=queries.find(q=>q.sql.includes("SELECT DISTINCT r.id,r.title")).sql;
  assert.ok(!sourceQuery.includes('reviewer_note'));assert.ok(!sourceQuery.includes('evidence_note'));
  assert.match(sourceQuery,/r.publication_status='published'/);
});

test('database configuration is optional, rejects partial setup, and verifies remote TLS', () => {
  assert.equal(connectionOptions({}),null);
  assert.throws(()=>connectionOptions({DB_HOST:'localhost'}));
  const env={DB_HOST:'remote.example',DB_USER:'user',DB_PASSWORD:'test-only',DB_NAME:'db'};
  assert.throws(()=>connectionOptions(env));
  assert.equal(connectionOptions({...env,DB_SSL:'true'}).ssl,true);
  assert.throws(()=>connectionOptions({...env,DB_SSL:'true',DB_PORT:'oops'}));
});

async function withServer(directory,fn) {
  const server=createServer({directory,log:()=>{}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('HTTP browse → filtered results → profile, with shared navigation and no script injection', async () => {
  const searches=[];
  await withServer({search:async criteria=>{searches.push(criteria);return {total:21,people:[{slug:'test-prospector',display_name:profile.display_name}],topics:[{slug:'panning',name:'Panning'}],regions:[]};},profile:async slug=>slug==='test-prospector'?profile:null},async base=>{
    const result=await fetch(base+'/prospectors/?q=%3Cscript%3E&topic=panning'); const body=await result.text();
    assert.equal(result.status,200); assert.ok(body.includes('/prospectors/test-prospector/')); assert.ok(body.includes('&lt;script&gt;')); assert.ok(!body.includes('<script>'));
    assert.ok(body.includes('page=2')); assert.equal(searches[0].topic,'panning');
    const detail=await fetch(base+'/prospectors/test-prospector/'); assert.equal(detail.status,200); assert.match(await detail.text(),/Offers instruction<\/dt><dd>No<\/dd>/);
    assert.equal((await fetch(base+'/prospectors/missing/')).status,404);
    const head=await fetch(base+'/prospectors/test-prospector/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.equal((await fetch(base+'/prospectors/?page=0')).status,400);
    const redirect=await fetch(base+'/prospectors?q=gold',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/prospectors/?q=gold');
  });
});
test('HTTP handles archive, empty directory, and DB outage without exposing details', async () => {
  await withServer({search:async()=>({total:0,people:[],topics:[],regions:[]}),profile:async()=>({archived:true,display_name:'Old Prospector'})},async base=>{
    const empty=await fetch(base+'/prospectors/');assert.equal(empty.status,200);assert.ok((await empty.text()).includes('The campfire is taking shape'));
    assert.equal((await fetch(base+'/prospectors/?page=2')).status,404);
    assert.equal((await fetch(base+'/prospectors/old/')).status,410);
  });
  await withServer({search:async()=>{throw new Error('password=secret host=private');}},async base=>{
    const response=await fetch(base+'/prospectors/');assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret'));
  });
});
test('published static routes work and unfinished previews stay unpublished', async () => {
  await withServer(null,async base=>{
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/articles/')).status,200);
    assert.equal((await fetch(base+'/geology-gold/')).status,404);
    assert.equal((await fetch(base+'/prospectors/jack-riverbend-morgan/')).status,404);
    assert.equal((await fetch(base+'/prospectors/')).status,503);
    assert.equal((await fetch(base+'/.env')).status,404);
    assert.equal((await fetch(base+'/database/migrations/001_directory_foundation.sql')).status,404);
    assert.equal((await fetch(base+'/%E0%A4%A')).status,400);
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  });
});
