import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorDescription,profilePage,directoryPage,page} from '../app/directory-views.js';
import {catalogProfile,catalogBySlug} from '../app/creator-catalog.js';
import {mapRecords} from '../app/creator-map.js';
import {prospectorsPage,explorerCriteria} from '../app/prospectors-page.js';
import {searchCriteria} from '../app/directory-store.js';

const profile=extra=>({display_name:'River Reader',slug:'river-reader',primary_region:'Maine',short_introduction:'River sampling and careful observations from Maine.',biography:'Documents repeatable sampling on local streams.',roles:[],audience:[],formats:[],languages:[],topics:[],regions:[],channels:[],contacts:[],resources:[],sources:[],...extra});
const content=html=>html.match(/<div class="center" id="main-content">([\s\S]*?)<\/div><\/div><\/main>/)?.[1]||'';
const notes=html=>html.match(/<details class="profile-notes"[^>]*>[\s\S]*?<\/details>/)?.[0]||'';
const headingCount=(html,name,level)=>[...html.matchAll(new RegExp('<h'+level+'[^>]*>([\\s\\S]*?)<\\/h'+level+'>','g'))].filter(m=>m[1]===name).length;

test('creator profiles lead with one name, documented description, broad coverage and free video actions',()=>{
 const p=profile({slug:'dan-hurd',channels:[{platform:'YouTube',channel_name:'Published Channel',canonical_url:'https://www.youtube.com/@PublishedChannel',description:'Field demonstrations.',publishing_since_year:2020}]});
 const rendered=profilePage(p),body=content(rendered);
 assert.equal(headingCount(rendered,p.display_name,1),1);assert.equal(headingCount(rendered,p.display_name,2),0);
 assert.ok(rendered.includes(p.short_introduction));assert.match(body,/⌖ Maine/);
 assert.match(body,/Watch on YouTube/);assert.match(body,/data-video-library/);assert.match(body,/https:\/\/www\.youtube\.com\/@PublishedChannel/);
 assert.match(body,/Publishing since: 2020/);assert.match(body,/Field demonstrations/);
 assert.doesNotMatch(body,/Portrait placeholder|PORTRAIT|FORTHCOMING|fuller biography|<dd>TBD<\/dd>/);
 assert.match(rendered,/Creators &amp; Videos/);assert.match(rendered,/creator-map\.css\?v=/);
});

test('empty facts and future promises disappear while meaningful zero and false values remain',()=>{
 const p=profile({primary_region:null,short_introduction:'Creator research lead; channel details are under review.',biography:'A fuller biography and additional resources will follow as they are reviewed.',experience_since_year:0,offers_instruction:false,verification_status:'unverified'});
 const rendered=profilePage(p),body=content(rendered);
 assert.doesNotMatch(body,/Portrait|biography and additional|research lead|<dd>TBD<\/dd>|Selected lessons and references will appear|Source references are TBD/);
 assert.match(body,/Prospecting since<\/dt><dd>0<\/dd>/);assert.match(body,/Offers instruction<\/dt><dd>No<\/dd>/);
 assert.doesNotMatch(body,/State \/ province|Content formats|Public contact|Official channels/);
 assert.match(body,/Location unknown at this time/);assert.match(notes(rendered),/Some profile details are still being checked/);
});

test('sources, research claims and waterway evidence remain available inside the closed profile-notes disclosure',()=>{
 const p=profile({verification_status:'source_checked',sources:[{title:'Public biography',canonical_url:'https://example.org/bio'}],researchClaims:[{field_key:'joined_youtube',claim_value:'2020-01-03',source_url:'https://example.org/about',checked_at:'2026-10-09',assessment:'verified',locator:'About page'}],waterways:[{name:'Swift',country:'USA',state_province:'Maine',public_note:'One source visit.',location_status:'explicit',resolution:'verified',source_url:'https://www.youtube.com/watch?v=Abcd_123-XY',timestamp_seconds:45,title:'Field outing',waterway_key:'swift',checked_at:'2026-10-09'}]});
 const rendered=profilePage(p),detail=notes(rendered);
 assert.match(detail,/Sources &amp; profile notes/);assert.doesNotMatch(detail,/<details[^>]*\bopen\b/);
 for(const value of ['Public biography','https://example.org/bio','Joined YouTube','2020-01-03','2026-10-09','About page','Waterways featured','Swift','t=45s','Repeated visits: Not established'])assert.ok(detail.includes(value),value);
 assert.ok(!rendered.replace(detail,'').includes('2026-10-09'));
 assert.match(detail,/not establish public access or permission/);
});

test('real catalog biographies, channels, websites and source checks are preserved without duplicate name headings',()=>{
 for(const slug of ['utmost-outdoors','ghost-town-living']){
  const p=catalogBySlug(slug),rendered=catalogProfile(p),detail=notes(rendered);
  assert.equal(headingCount(rendered,p.name,1),1);assert.equal(headingCount(rendered,p.name,2),0);
  assert.ok(rendered.includes(p.summary));assert.match(rendered,/Watch on YouTube/);
  for(const fact of p.biography){assert.ok(rendered.includes(fact.text));assert.ok(rendered.includes(fact.source_url));}
  assert.ok(detail.includes(p.checked_at));assert.ok(detail.includes('Sources &amp; profile notes'));
  assert.doesNotMatch(content(rendered),/CREATOR RESEARCH PROFILE|fuller biography|<dd>TBD<\/dd>/);
 }
});

test('sparse catalog profiles use a concise uncertainty note rather than invented biographies',()=>{
 const rendered=catalogProfile({slug:'checked-channel',name:'Checked Channel',status:'lead',official_url:'https://www.youtube.com/@CheckedChannel',checked_at:'2026-10-09'});
 assert.match(rendered,/Watch on YouTube/);assert.match(notes(rendered),/Some creator details are still being checked/);
 assert.doesNotMatch(content(rendered),/will follow|fuller biography|Portrait|<h2>Checked Channel/);
 assert.equal(headingCount(rendered,'Checked Channel',1),1);
});

test('directory begins with one title and short introduction, then filters, preserving alphabetical default and public access',()=>{
 const rows=mapRecords([{id:'b',slug:'beta',display_name:'Beta',short_introduction:'Creator research lead; channel details are under review.'},{id:'a',slug:'alpha',display_name:'Alpha',short_introduction:'Samples stream gravels.'}],[{person_id:'a',name:'Maine',slug:'maine'}],[]);
 const filters=explorerCriteria(new URLSearchParams(),searchCriteria(new URLSearchParams()));
 assert.equal(filters.sort,'az');
 const free=prospectorsPage(rows,filters),paid=prospectorsPage(rows,filters,{canFindOnMap:true});
 assert.equal(headingCount(free,'Creators &amp; Videos',1),1);assert.match(free,/Every creator profile and video link is free/);
 assert.ok(content(free).trim().startsWith('<section class="map-desk prospectors-desk"'));
 assert.doesNotMatch(content(free),/Find a familiar voice|PEOPLE OF THE GOLD COUNTRY|<div class="creator-views"|class="map-find"/);
 assert.ok(free.indexOf('data-slug="alpha"')<free.indexOf('data-slug="beta"'));
 assert.match(paid,/Map view/);assert.match(paid,/Find on map/);
 assert.doesNotMatch(content(free).split('<script id="map-data"')[0],/channel details are under review/);
 const legacy=directoryPage(filters,{people:[{display_name:'Alpha',slug:'alpha'}],topics:[],regions:[],total:1});
 assert.equal(headingCount(legacy,'Creators &amp; Videos',1),1);assert.ok(content(legacy).includes('<form class="directory-search"'));
 assert.doesNotMatch(legacy,/Find a voice for your next trail|Meet the prospectors/);
});

test('creator placeholder filtering is narrow enough to retain real public descriptions and shared pages keep their default shell',()=>{
 assert.equal(creatorDescription('Field research on stream deposits.'),'Field research on stream deposits.');
 assert.equal(creatorDescription('A geological research leader who shares field notes.'),'A geological research leader who shares field notes.');
 assert.equal(creatorDescription('A former biography teacher now shares panning lessons.'),'A former biography teacher now shares panning lessons.');
 assert.equal(creatorDescription('Creator research lead; channel details are under review.'),'');
 const generic=page('Other page','Description','<p>Content</p>','','Introduction');
 assert.match(generic,/GOLD TRAILS \/ PROSPECTOR DIRECTORY/);assert.match(generic,/<h1>Other page<\/h1><p>Introduction<\/p>/);
});
