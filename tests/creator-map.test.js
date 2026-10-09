import test from 'node:test';
import assert from 'node:assert/strict';
import {regionAnchor,settingsFor,mapRecords} from '../app/creator-map.js';
import {prospectorsPage,explorerCriteria} from '../app/prospectors-page.js';
import {matchesCreator} from '../dist/prospectors-data.js';
import {createServer} from '../app/server.js';
test('map uses recognized broad regions, retains unknowns and overlapping settings',()=>{
 assert.equal(regionAnchor('Unknown'),null);assert.equal(regionAnchor('West Virginia, USA').label,'West Virginia');
 assert.deepEqual(settingsFor([{name:'Gold panning'}]),[]);
 assert.deepEqual(settingsFor([{name:'River deposits'},{name:'Metal detecting'},{name:'Hard-rock geology'}]),['river','ground','mine']);
 const rows=mapRecords([{id:'1',slug:'a',display_name:'A'},{id:'2',slug:'b',display_name:'B'}],[{person_id:'1',name:'Maine'},{person_id:'1',name:'Maine, USA'}],[]);
 assert.equal(rows[0].regions.length,1);assert.equal(rows[1].regions.length,0);
 const html=prospectorsPage(mapRecords([{slug:'a',display_name:'</script><script>bad()'}],[],[]),{q:'',sort:'az',view:'list'});
 assert.ok(!html.includes('</script><script>bad()'));assert.match(html,/Location unknown at this time/);
});
test('unified directory displays the full roster and old map links redirect to its map view',async()=>{
 const server=createServer({directory:{map:async()=>({people:[{id:'1',slug:'a',display_name:'A'}],regions:[],topics:[]})},log:()=>{}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const root='http://127.0.0.1:'+server.address().port;const response=await fetch(root+'/prospectors/');assert.equal(response.status,200);const html=await response.text();assert.match(html,/List view/);assert.match(html,/Map view/);assert.match(html,/Search prospectors/);assert.equal((html.match(/class="map-person"/g)||[]).length,69);assert.ok(!html.includes('href="/creator-map/"'));const redirect=await fetch(root+'/creator-map?q=A',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/prospectors/?q=A&view=map');assert.equal((await fetch(root+'/prospectors/?view=nope')).status,400);}finally{await new Promise(r=>server.close(r));}
});

test('shared filters preserve region/topic links and distinguish unknown and unmapped regions',()=>{
 const rows=mapRecords([{id:'1',slug:'a',display_name:'A'},{id:'2',slug:'b',display_name:'B'},{id:'3',slug:'c',display_name:'C'}],[{person_id:'1',name:'Maine',slug:'maine-region'},{person_id:'2',name:'USA'}],[{person_id:'1',name:'River deposits',slug:'rivers',relationship_type:'specialty'}]);
 assert.ok(matchesCreator(rows[0],{region:'maine-region',topic:'rivers',setting:'river'}));
 assert.ok(matchesCreator(rows[0],{q:'maine river'}));assert.ok(!matchesCreator(rows[1],{region:'unknown'}));assert.ok(matchesCreator(rows[2],{region:'unknown'}));
 assert.equal(rows[1].regions.length,0);assert.equal(rows[1].location,'USA');
 assert.equal(explorerCriteria(new URLSearchParams('setting=invalid'),{}),null);
});

import {mergeCatalog,catalogProfile} from '../app/creator-catalog.js';
test('catalog preserves database overrides, blocked profiles and unknown locations',()=>{const data=mergeCatalog({people:[{id:'live',slug:'dan-hurd',display_name:'Dan'}],regions:[],topics:[],excludedSlugs:['pioneer-pauly']});assert.equal(data.people.filter(p=>p.slug==='dan-hurd').length,1);assert.ok(!data.people.some(p=>p.slug==='pioneer-pauly'));assert.match(catalogProfile({name:'Test',status:'lead',checked_at:'2026-10-09',official_url:'https://example.com'}),/Location unknown at this time/);});
