import {matchesCreator,sortCreators} from './prospectors-data.js';
const people=JSON.parse(document.querySelector('#map-data').textContent),state=JSON.parse(document.querySelector('#explorer-state').textContent);
const form=document.querySelector('.explorer-form'),search=document.querySelector('#map-search'),status=document.querySelector('#map-status'),cards=document.querySelector('#map-people'),panel=document.querySelector('#creator-map-panel');
let map,layer,loading=false,failed=false,pendingSlug=null;const markers=new Map(),placements=new Map(),groups=new Map();
for(const p of people){const r=p.regions[0];if(r){if(!groups.has(r.label))groups.set(r.label,[]);groups.get(r.label).push(p);}}
for(const group of groups.values()){group.sort((a,b)=>a.slug.localeCompare(b.slug));group.forEach((p,i)=>{const r=p.regions[0],angle=i*2.399963229728653,radius=group.length===1?0:0.65*Math.sqrt(i+1);placements.set(p.slug,[r.lat+Math.sin(angle)*radius,r.lng+Math.cos(angle)*radius/Math.cos(r.lat*Math.PI/180)]);});}
const nugget='<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M6 10 15 4 24 7 28 19 21 27 9 26 3 18Z" fill="#dba12c" stroke="#76501c" stroke-width="1.5"/><path d="m6 10 9-6 3 10-9 5Z" fill="#ffe18a"/><path d="m18 14 6-7 4 12-7 8Z" fill="#bd7d1c"/><path d="m9 19 9-5 3 13-12-1Z" fill="#edbd4b"/><path d="m10 10 4-2" stroke="#fff2b0" stroke-width="2" stroke-linecap="round"/></svg>';
function filters(){return {q:search.value,...Object.fromEntries([...form.querySelectorAll('select')].map(select=>[select.name,select.value])),view:state.view};}
function writeUrl(){const values=filters(),params=new URLSearchParams();for(const [key,value] of Object.entries(values))if(value&&!(key==='view'&&value==='list')&&!(key==='sort'&&value==='az'))params.set(key,value);history.replaceState(null,'','/prospectors/'+(params.size?'?'+params.toString():''));}
function renderMarkers(visible){if(!map)return;layer.clearLayers();markers.clear();for(const p of visible){if(!placements.has(p.slug))continue;const content=document.createElement('div'),heading=document.createElement('strong'),note=document.createElement('p'),intro=document.createElement('p'),link=document.createElement('a');heading.textContent=p.name;intro.textContent=p.introduction;note.textContent=p.location+' — approximate regional placement, not a prospecting site.';link.href=p.profileUrl||'/prospectors/'+encodeURIComponent(p.slug)+'/';link.textContent='View creator profile →';content.append(heading,intro,note,link);const marker=L.marker(placements.get(p.slug),{title:p.name+' — '+p.regions[0].label,alt:p.name,icon:L.divIcon({className:'map-nugget',html:nugget,iconSize:[18,18],iconAnchor:[9,9]})}).bindTooltip(p.name,{direction:'top'}).bindPopup(content).addTo(layer);markers.set(p.slug,marker);}}
async function loadMap(){
 if(map||loading||failed)return;loading=true;document.querySelector('#creator-map').textContent='Loading the creator map…';
 try{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
  if(!window.L)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  document.querySelector('#creator-map').textContent='';map=L.map('creator-map',{scrollWheelZoom:false,maxZoom:12}).setView([44,-100],3);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);layer=L.layerGroup().addTo(map);update(false);focusPending();
 }catch{failed=true;document.querySelector('#creator-map').textContent='The map could not load. Choose List view to explore all matching creators.';}
 finally{loading=false;}
}
function update(sync=true){const values=filters(),visible=sortCreators(people.filter(p=>matchesCreator(p,values)),values.sort),slugs=new Set(visible.map(p=>p.slug)),mapped=visible.filter(p=>p.regions.length).length;
 status.textContent=visible.length+' prospector'+(visible.length===1?'':'s')+' · '+mapped+' with mapped regions';
 const cardBySlug=new Map([...cards.children].map(card=>[card.dataset.slug,card]));for(const card of cards.children){card.hidden=!slugs.has(card.dataset.slug);}for(const p of sortCreators(people,values.sort)){const card=cardBySlug.get(p.slug);if(card)cards.append(card);}
 document.querySelector('#creator-empty').hidden=visible.length!==0;
 panel.hidden=state.view!=='map';cards.hidden=state.view==='map';
 document.querySelectorAll('.creator-views button').forEach(button=>button.setAttribute('aria-pressed',String(button.value===state.view)));
 const missing=visible.length-mapped;document.querySelector('#map-unlocated').textContent=missing?missing+' matching creator'+(missing===1?' has':'s have')+' no mapped region. They remain available in List view.':'All matching creators have a mapped region.';
 document.querySelectorAll('.map-find').forEach(button=>button.hidden=false);
 if(state.view==='map'){loadMap();map?.invalidateSize();}renderMarkers(visible);if(sync)writeUrl();
}
form.addEventListener('submit',event=>{event.preventDefault();if(event.submitter?.name==='view')state.view=event.submitter.value;update();});
search.addEventListener('input',()=>update());search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();update();}});form.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>update()));
document.querySelector('#creator-search-submit').hidden=true;
document.querySelector('#map-reset').addEventListener('click',event=>{event.preventDefault();search.value='';form.querySelectorAll('select').forEach(select=>select.value=select.name==='sort'?'az':'');map?.setView([44,-100],3);update();});
function focusPending(){const marker=markers.get(pendingSlug);if(!marker)return;map.setView(marker.getLatLng(),6);marker.openPopup();pendingSlug=null;panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
cards.addEventListener('click',event=>{const button=event.target.closest('.map-find');if(!button)return;pendingSlug=button.dataset.slug;state.view='map';update();focusPending();});
update(false);
