import test from 'node:test';
import assert from 'node:assert/strict';
import {regionAnchor,settingsFor,mapRecords,creatorMapPage} from '../app/creator-map.js';
import {createServer} from '../app/server.js';
test('map uses recognized broad regions, retains unknowns and overlapping settings',()=>{
 assert.equal(regionAnchor('Unknown'),null);assert.equal(regionAnchor('West Virginia, USA').label,'West Virginia');
 assert.deepEqual(settingsFor([{name:'Gold panning'}]),[]);
 assert.deepEqual(settingsFor([{name:'River deposits'},{name:'Metal detecting'},{name:'Hard-rock geology'}]),['river','ground','mine']);
 const rows=mapRecords([{id:'1',slug:'a',display_name:'A'},{id:'2',slug:'b',display_name:'B'}],[{person_id:'1',name:'Maine'},{person_id:'1',name:'Maine, USA'}],[]);
 assert.equal(rows[0].regions.length,1);assert.equal(rows[1].regions.length,0);
 const html=creatorMapPage([{slug:'a',name:'</script><script>bad()',introduction:'',settings:[],regions:[]}]);
 assert.ok(!html.includes('</script><script>bad()'));assert.match(html,/Location unknown at this time/);
});
test('map route displays public store data and handles outages',async()=>{
 const server=createServer({directory:{map:async()=>({people:[{id:'1',slug:'a',display_name:'A'}],regions:[],topics:[]})},log:()=>{}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const root='http://127.0.0.1:'+server.address().port;const response=await fetch(root+'/creator-map/');assert.equal(response.status,200);assert.match(await response.text(),/Creator name/);assert.equal((await fetch(root+'/creator-map',{redirect:'manual'})).status,308);}finally{await new Promise(r=>server.close(r));}
});

import {mergeCatalog,catalogProfile} from '../app/creator-catalog.js';
test('catalog preserves database overrides, blocked profiles and unknown locations',()=>{const data=mergeCatalog({people:[{id:'live',slug:'dan-hurd',display_name:'Dan'}],regions:[],topics:[],excludedSlugs:['pioneer-pauly']});assert.equal(data.people.filter(p=>p.slug==='dan-hurd').length,1);assert.ok(!data.people.some(p=>p.slug==='pioneer-pauly'));assert.match(catalogProfile({name:'Test',status:'lead',checked_at:'2026-10-09',official_url:'https://example.com'}),/Location unknown at this time/);});
