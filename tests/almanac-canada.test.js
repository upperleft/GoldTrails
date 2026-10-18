import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {geoAlbersUsa} from 'd3-geo';
import {unifiedCreatorRecords,createAlmanacCreators} from '../app/almanac/creators.js';
import {mergeCatalog} from '../app/creator-catalog.js';
import {mapRecords} from '../app/creator-map.js';
import {canadaProvinces,projectCanadianPoint,mapBounds,mapViewBox} from '../app/almanac/map-geometry.js';
import {states} from '../app/almanac/model.js';
import {almanacPage} from '../app/almanac/views.js';
import {createAlmanacHandler} from '../app/almanac/handler.js';
import {createGuestPlusAccess} from '../app/plus/guest-access.js';
import {createServer} from '../app/server.js';
import {videoLibraryCount} from '../app/creator-video-library.js';
import {creatorPlacements} from '../dist/creator-map-shared.js';
import {matchesCreator} from '../dist/prospectors-data.js';

const emptyDirectory={people:[],regions:[],topics:[]};
const provinces=['alberta','british-columbia','manitoba','new-brunswick','newfoundland-and-labrador','northwest-territories','nova-scotia','nunavut','ontario','prince-edward-island','quebec','saskatchewan','yukon'];
const canadaCreators=['dan-hurd','pioneer-pauly','utmost-outdoors','yukon-dan','crux-prospecting','nick-molnar','chercheurs-dor-du-quebec'];

test('Canadian boundaries retain all 13 official source identities and actual WGS84 coordinates',()=>{
 const bytes=readFileSync(new URL('../database/map-data/canada-provinces-2021.geojson',import.meta.url));
 const source=JSON.parse(bytes),inspection=JSON.parse(readFileSync(new URL('../database/map-data/canada-boundary-source-2026-10-18.json',import.meta.url),'utf8'));
 assert.equal(source.type,'FeatureCollection');assert.equal(source.features.length,13);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),inspection.sha256,'The boundary source is the inspected local asset');
 const ids=source.features.map(f=>String(f.properties.PRUID));assert.equal(new Set(ids).size,13);
 assert.deepEqual(canadaProvinces.map(p=>p.sourceUid).sort(),ids.sort(),'Every compiled province comes from one official feature');
 if(source.crs)assert.match(source.crs.properties.name,/4326|CRS84/i,'GeoJSON must use longitude/latitude rather than projected metres');
 let vertices=0;
 function inspect(coordinates){
  if(typeof coordinates[0]==='number'){
   const [lng,lat]=coordinates;vertices++;
   assert.ok(Number.isFinite(lng)&&lng>=-142&&lng<=-50,'Canadian longitude lies in the source country extent');
   assert.ok(Number.isFinite(lat)&&lat>=40&&lat<=84,'Canadian latitude is an unprojected geographic latitude');
  }else for(const part of coordinates)inspect(part);
 }
 for(const feature of source.features){assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));inspect(feature.geometry.coordinates);}
 assert.ok(vertices>100,'The source contains real boundaries rather than center points');
});

test('Canadian outlines and creator markers use one northern projection rather than the Alaska inset',()=>{
 assert.equal(canadaProvinces.length,13);assert.equal(new Set(canadaProvinces.map(p=>p.id)).size,13);assert.deepEqual(canadaProvinces.map(p=>p.slug).sort(),provinces);
 const [[left,top],[right,bottom]]=mapBounds;
 assert.ok(left<=-70&&right>=1030&&bottom>=650,'Existing U.S. map extent remains available');
 assert.ok(top<0,'Canada extends the map north of the existing U.S. area');
 assert.deepEqual(mapViewBox.split(/\s+/).map(Number),[left,top,right-left,bottom-top]);
 for(const province of canadaProvinces){
  assert.ok(province.path.startsWith('M')&&province.path.endsWith('Z'),province.name+' has a real outline');
  assert.ok(province.sourceUid,province.name+' retains its source identity');
  for(const [x,y] of [province.center,province.label,...province.bounds]){
   assert.ok(Number.isFinite(x)&&Number.isFinite(y),province.name+' has finite geometry');
   assert.ok(x>=left&&x<=right&&y>=top&&y<=bottom,province.name+' fits the unified map bounds');
  }
 }
 const north=projectCanadianPoint([-136,64]);assert.ok(Math.abs(north[0]-42.2986)<.01&&Math.abs(north[1]+343.5744)<.01,'A Yukon public-region anchor is projected north of the U.S., not into repositioned Alaska');
 for(const point of [null,[],[-136],['-136',64],[-181,64],[-136,91],[NaN,64]])assert.equal(projectCanadianPoint(point),null,'Invalid geographic input is not projected');
 const records=unifiedCreatorRecords(emptyDirectory),canadians=records.filter(p=>p.mapCountry==='CA'),placements=creatorPlacements(canadians,p=>p.mapRegion);
 for(const creator of canadians){
  const [lat,lng]=placements.get(creator.slug),expected=projectCanadianPoint([lng,lat]).map(n=>Math.round(n*100)/100);
  assert.deepEqual(creator.mapPoint,expected,creator.slug+' shares the province outline projection');
  const [x,y]=creator.mapPoint;assert.ok(x>=left&&x<=right&&y>=top&&y<=bottom,creator.slug+' remains visible within the map');
 }
});

test('the expanded map retains all 50 original U.S. outlines and adds each Canadian province and territory once',()=>{
 const html=almanacPage({state:null},{connections:{available:true,records:unifiedCreatorRecords(emptyDirectory)}});
 const mappedRegions=[...html.matchAll(/data-canada-region="([a-z-]+)"/g)].map(m=>m[1]);
 assert.deepEqual(mappedRegions.sort(),provinces);
 for(const slug of provinces)assert.ok(html.includes('href="/gold-almanac/?region='+slug+'#canada-creators"'),slug+' has a working creator-filter fallback, not an invented state guide');
 assert.match(html,/id="canada-creators"/,'The Canadian region links have an existing destination');
 assert.match(html,/Statistics Canada/,'The official Canadian boundary source is credited');
 assert.equal((html.match(/class="almanac-map"/g)||[]).length,1,'Canada belongs to the existing unified map');
 assert.equal((html.match(/data-state="/g)||[]).length,50,'Canadian regions must not masquerade as U.S. state research pages');
 for(const state of states){
  assert.ok(html.includes('data-state="'+state.slug+'"'),state.name+' remains selectable');
  assert.ok(html.includes('d="'+state.path+'"'),state.name+' retains its existing outline');
 }
 assert.doesNotMatch(html,/aria-pressed="true"/,'No state or Canadian region is selected by default');
});

test('Canadian creators are discoverable with existing filters while U.S. placement and excluded profiles are preserved',()=>{
 const records=unifiedCreatorRecords(emptyDirectory);
 for(const slug of canadaCreators){
  const creator=records.find(p=>p.slug===slug);assert.ok(creator,slug);
  assert.equal(creator.mapCountry,'CA',slug+' maps to Canada');
  assert.ok(creator.mapPoint?.every(Number.isFinite),slug+' has a usable marker');
  if(creator.mapRegion.sourceUrl){
   assert.match(creator.mapRegion.sourceUrl,/^https:\/\//,slug+' town placement has a public source');
   assert.match(creator.mapRegion.coordinateSource,/^https:\/\//,slug+' town coordinate has an authoritative source');
  }else assert.ok(creator.regions.some(r=>r.label===creator.mapRegion.label),slug+' uses an existing public coverage region');
  assert.ok(matchesCreator(creator,{q:creator.mapRegion.label}),slug+' remains searchable by public region');
  assert.ok(creator.regionOptions.some(option=>matchesCreator(creator,{region:option.slug})),slug+' remains in the regional filters');
 }
 const pauly=records.find(p=>p.slug==='pioneer-pauly');assert.equal(pauly.mapRegion.label,'Vancouver Island');assert.ok(matchesCreator(pauly,{region:'british-columbia'}),'A British Columbia province selection includes Vancouver Island creators');
 const merged=mergeCatalog(emptyDirectory),originalRecords=mapRecords(merged.people,merged.regions,merged.topics),usRegions=new Set([...states.map(s=>s.name.toLowerCase()),'new england','midwestern usa','pacific northwest']);
 const originalRegionFor=p=>p.regions.find(r=>usRegions.has(r.label.toLowerCase())),placements=creatorPlacements(originalRecords,originalRegionFor),projection=geoAlbersUsa().scale(1300).translate([487.5,305]);
 for(const original of originalRecords.filter(p=>originalRegionFor(p))){
  const creator=records.find(p=>p.slug===original.slug),[lat,lng]=placements.get(creator.slug),expected=projection([lng,lat]).map(n=>Math.round(n*100)/100);
  assert.equal(creator.mapCountry,'US');assert.deepEqual(creator.mapRegion,originalRegionFor(original),creator.slug+' retains its original first recognized U.S. region');
  assert.deepEqual(creator.mapPoint,expected,creator.slug+' retains the established U.S. projection and regional spacing');
 }
 const outside=records.find(p=>p.slug==='adventure-gold');assert.equal(outside.mapCountry,null);assert.equal(outside.mapPoint,null);
 const blocked=unifiedCreatorRecords({...emptyDirectory,excludedSlugs:['pioneer-pauly']});assert.ok(!blocked.some(p=>p.slug==='pioneer-pauly'));
 const override=unifiedCreatorRecords({people:[{id:'live-dan',slug:'dan-hurd',display_name:'Dan Hurd — live profile'}],regions:[],topics:[]});
 assert.equal(override.filter(p=>p.slug==='dan-hurd').length,1);assert.equal(override.find(p=>p.slug==='dan-hurd').name,'Dan Hurd — live profile');
});

test('all Canadian provinces and territories plus Vancouver Island can accept future public coverage records',()=>{
 const regionNames=[...canadaProvinces.map(p=>p.name),'Vancouver Island'];
 const people=regionNames.map((name,i)=>({id:'canada-fixture-'+i,slug:'canada-fixture-'+i,display_name:'Coverage fixture '+name}));
 const regions=regionNames.map((name,i)=>({person_id:people[i].id,name}));
 const records=unifiedCreatorRecords({people,regions,topics:[]});
 for(const fixture of people){
  const creator=records.find(p=>p.slug===fixture.slug);assert.equal(creator.mapCountry,'CA',fixture.display_name);
  assert.ok(creator.mapPoint?.every(Number.isFinite),fixture.display_name+' has a Canadian marker');
 }
 const unknown=unifiedCreatorRecords({people:[{id:'unknown-canada',slug:'unknown-canada',display_name:'Canada without a province',country_code:'CA'}],regions:[{person_id:'unknown-canada',name:'Canada'}],topics:[]}).find(p=>p.slug==='unknown-canada');
 assert.equal(unknown.mapPoint,null,'A country-only record is kept in the list rather than assigned a guessed province');
});

test('choosing Canadian coverage cancels a pending U.S. guide and cannot revive stale state details',async()=>{
 class Element{
  constructor(){this.dataset={};this.attrs={};this.events={};this.hidden=false;this.classList={toggle:()=>{}};}
  addEventListener(type,fn){this.events[type]=fn;}setAttribute(key,value){this.attrs[key]=value;}getAttribute(key){return this.attrs[key];}removeAttribute(key){delete this.attrs[key];}
 }
 const nodes=Object.fromEntries(['state-details','almanac-status','almanac-retry','almanac-share','almanac-details','almanac-selection-marker','selected-state'].map(id=>[id,new Element()]));
 const panel=nodes['state-details'];panel.innerHTML='California guide';panel.dataset.stateId='US-CA';
 const markers=['california','maine'].map(slug=>{const m=new Element();m.dataset.state=slug;m.attrs['aria-pressed']=String(slug==='california');m.attrs['aria-label']=slug;m.closest=()=>m;return m;});
 const map=new Element();map.querySelectorAll=()=>markers;const canonical={href:'/gold-almanac/california/'},events={};let resolve,signal,historyWrites=0;
 const context={document:{getElementById:id=>nodes[id],querySelector:selector=>selector==='.almanac-map'?map:canonical},window:{addEventListener:(type,fn)=>{events[type]=fn;}},location:{pathname:'/gold-almanac/california/',origin:'https://goldtrails.org',search:'',hash:''},history:{pushState:()=>{historyWrites++;},replaceState:()=>{historyWrites++;}},fetch:(_url,options)=>{signal=options.signal;return new Promise(r=>{resolve=r;});},AbortController,URL,setTimeout:()=>1,clearTimeout:()=>{}};
 vm.runInNewContext(readFileSync(new URL('../dist/gold-almanac.js',import.meta.url),'utf8'),context);
 map.events.click({target:markers[1],button:0,preventDefault(){}});assert.equal(signal.aborted,false);
 events['gold-trails:canada-region']();assert.equal(signal.aborted,true);
 assert.equal(panel.hidden,true);assert.equal(panel.innerHTML,'');assert.equal(panel.dataset.stateId,'');assert.ok(markers.every(m=>m.attrs['aria-pressed']==='false'));
 assert.equal(nodes['almanac-details'].hidden,true);assert.equal(nodes['almanac-share'].hidden,true);assert.match(nodes['almanac-status'].textContent,/Canadian creator coverage selected/);
 resolve({ok:true,json:async()=>({state:{id:'US-ME',slug:'maine',name:'Maine'},url:'/gold-almanac/maine/',html:'Stale Maine guide'})});await new Promise(r=>setImmediate(r));
 assert.equal(panel.hidden,true);assert.equal(panel.innerHTML,'');assert.equal(historyWrites,0,'A stale state response cannot replace the Canadian filter URL');
});

test('the same Canadian map and marker data open for paid members and invited friends while public creator pages stay free',async t=>{
 const paid='a'.repeat(64),guest='c'.repeat(64),now=Date.parse('2026-10-18T12:00:00Z');let clock=now;
 const pass={id:'canada-map-test',tokenHash:createHash('sha256').update(guest).digest('hex'),expiresAt:new Date(now+86400000).toISOString()};
 const guests=createGuestPlusAccess({passes:[pass],now:()=>clock,origin:'https://goldtrails.org'});
 const directory={map:async()=>emptyDirectory,profile:async()=>null,catalogAllowed:async()=>true};
 const members={session:async raw=>raw===paid?{effective_level:'subscriber'}:{effective_level:'free'}};
 const almanac=createAlmanacHandler({members,guests,creators:createAlmanacCreators(directory)});
 const server=createServer({almanac,guests,directory,memberSessions:members,goldPrice:async()=>({}),log:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const root='http://127.0.0.1:'+server.address().port;
 const request=(path,cookie='')=>fetch(root+path,{headers:cookie?{Cookie:cookie}:{},redirect:'manual'});
 const api='/api/gold-almanac/creators/';
 assert.equal((await request(api)).status,403);
 const publicHtml=await(await request('/gold-almanac/')).text();assert.doesNotMatch(publicHtml,/data-canada-region="|id="almanac-creator-data"/);
 let canonical;
 for(const cookie of ['__Host-gold-member='+paid,'__Host-gold-plus-guest='+guest]){
  const response=await request(api,cookie);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie');
  const records=(await response.json()).records,canadians=records.filter(p=>p.mapCountry==='CA');
  assert.ok(canadians.length>=canadaCreators.length);for(const slug of canadaCreators)assert.ok(canadians.some(p=>p.slug===slug&&p.mapPoint),slug);
  const payload=JSON.stringify(records);if(canonical)assert.equal(payload,canonical,'Friends see the production map data, not a copied prototype');canonical=payload;
  const page=await request('/gold-almanac/',cookie);assert.equal(page.status,200);const html=await page.text();
  assert.equal((html.match(/data-canada-region="/g)||[]).length,13);assert.match(html,/id="almanac-creator-data"/);
 }
 for(const slug of canadaCreators){
  assert.equal((await request('/prospectors/'+slug+'/')).status,200,slug+' profile is public');
  const expected=videoLibraryCount(slug)>0?200:404;
  assert.equal((await request('/prospectors/'+slug+'/videos/')).status,expected,slug+' checked video library remains public, with no invented library where none exists');
 }
 clock=Date.parse(pass.expiresAt);assert.equal((await request(api,'__Host-gold-plus-guest='+guest)).status,403,'Canada does not bypass invitation expiry');
 assert.equal((await request(api,'__Host-gold-member='+paid)).status,200,'Invitation expiry does not revoke paid access');
});
