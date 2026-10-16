import test from 'node:test';
import assert from 'node:assert/strict';
import {unifiedCreatorRecords,createAlmanacCreators} from '../app/almanac/creators.js';
import {hasPremiumFeature,almanacReturnPath} from '../app/plus/entitlements.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createServer} from '../app/server.js';
import {nugget,creatorPlacements,creatorPopup} from '../dist/creator-map-shared.js';
const directory={map:async()=>({people:[],regions:[],topics:[]}),profile:async()=>null,catalogAllowed:async()=>true};
const active='a'.repeat(64),free='b'.repeat(64);
test('unified projection retains one published record per creator and does not put international creators on U.S. states',()=>{
 const records=unifiedCreatorRecords({people:[],regions:[],topics:[],excludedSlugs:['pioneer-pauly']});
 assert.equal(new Set(records.map(p=>p.slug)).size,records.length);assert.ok(!records.some(p=>p.slug==='pioneer-pauly'));
 const bill=records.find(p=>p.slug==='bill-southern');assert.ok(bill.mapPoint?.every(Number.isFinite));assert.equal(bill.mapRegion.label,'Arizona');
 const dan=records.find(p=>p.slug==='dan-hurd');assert.equal(dan.mapPoint,null);assert.equal(dan.mapRegion,null);assert.equal(dan.slug,'dan-hurd');
 assert.equal(records.find(p=>p.slug==='adventure-gold').mapPoint,null);
 const regions=[{slug:'a',regions:[{label:'X',lat:40,lng:-100}]},{slug:'b',regions:[{label:'X',lat:40,lng:-100}]}];assert.deepEqual(creatorPlacements(regions),creatorPlacements([...regions].reverse()));assert.notDeepEqual(creatorPlacements(regions).get('a'),creatorPlacements(regions).get('b'));assert.match(nugget,/fill="#dba12c"/);
});
test('the reused popup keeps safe text, creator profile and video dialog links',()=>{
 const doc={createElement:tag=>({tag,children:[],dataset:{},attributes:{},append(...kids){this.children.push(...kids);},setAttribute(k,v){this.attributes[k]=v;}})};
 const popup=creatorPopup({slug:'a',name:'<script>bad()</script>',introduction:'Intro',location:'Maine',videoCount:3},doc);
 assert.equal(popup.children[0].textContent,'<script>bad()</script>');assert.equal(popup.children[3].href,'/prospectors/a/');assert.equal(popup.children[4].href,'/prospectors/a/videos/');assert.equal(popup.children[4].attributes['aria-haspopup'],'dialog');
});
test('feature registry fails closed and keeps only internal Almanac filter return URLs',async()=>{
 assert.equal(await hasPremiumFeature({headers:{}},{members:{session:async()=>({effective_level:'subscriber'})}},'unapproved'),false);
 for(const path of ['https://evil.test/','/gold-almanac/../admin/','/gold-almanac/?next=https://evil.test','/gold-almanac/?q=a&q=b','/gold-almanac/#x'])assert.equal(almanacReturnPath(path),null);
 assert.equal(almanacReturnPath('/gold-almanac/california/?q=Bill&region=arizona'),'/gold-almanac/california/?q=Bill&region=arizona');
});
test('whole map and creator JSON require Plus; directory, profiles and videos stay public',async t=>{
 let creatorLookups=0;const loader=createAlmanacCreators(directory),almanac=createAlmanacHandler({members:{session:async raw=>raw===active?{effective_level:'subscriber'}:{effective_level:'free'}},creators:async()=>{creatorLookups++;return loader();}});
 const server=createServer({almanac,directory,goldPrice:async()=>({}),log:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const root='http://127.0.0.1:'+server.address().port,request=(p,token)=>fetch(root+p,{redirect:'manual',headers:token?{Cookie:'__Host-gold-member='+token}:{}});
 for(const token of [null,free,'f'.repeat(64)]){const preview=await request('/gold-almanac/',token);assert.equal(preview.status,200);assert.doesNotMatch(await preview.text(),/class="almanac-map"|data-state="|id="almanac-creator-data"/);assert.equal((await request('/api/gold-almanac/creators/',token)).status,403);assert.equal((await request('/gold-almanac/texas/',token)).status,403);}assert.equal(creatorLookups,0);
 const full=await request('/gold-almanac/',active),html=await full.text();assert.equal(full.status,200);assert.equal((html.match(/class="almanac-map"/g)||[]).length,1);assert.equal((html.match(/data-state="/g)||[]).length,50);assert.doesNotMatch(html,/aria-pressed="true"/);assert.match(html,/id="almanac-creator-data"/);assert.match(html,/Creators beyond this U.S. map/);assert.match(html,/almanac-creators.js/);
 const api=await request('/api/gold-almanac/creators/',active);assert.equal(api.status,200);assert.equal(api.headers.get('cache-control'),'private, no-store');assert.equal((await api.json()).records.length,84);
 for(const path of ['/prospectors/','/prospectors/dan-hurd/','/prospectors/dan-hurd/videos/','/api/prospectors/dan-hurd/videos/']){const r=await request(path);assert.equal(r.status,200,path);}
 const list=await(await request('/prospectors/')).text();assert.doesNotMatch(list,/id="creator-map"/);assert.equal((list.match(/class="map-person"/g)||[]).length,84);
 const redirect=await request('/prospectors/?view=map&q=Bill&region=arizona');assert.equal(redirect.headers.get('location'),'/gold-almanac/?q=Bill&region=arizona');
});
