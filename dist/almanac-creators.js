import {matchesCreator,sortCreators} from './prospectors-data.js';
import {creatorMarker,loadLeaflet} from './creator-map-shared.js';
const data=document.querySelector('#almanac-creator-data');
if(data){
 const {records}=JSON.parse(data.textContent),svg=document.querySelector('.almanac-map'),wrap=svg.parentElement,form=document.querySelector('.explorer-form'),status=document.querySelector('#almanac-creator-status');
 let map,layer;const markers=new Map();
 const filters=()=>Object.fromEntries(new FormData(form));
 function update(sync=true){const values=filters(),visible=records.filter(p=>matchesCreator(p,values)),slugs=new Set(visible.map(p=>p.slug));
  layer?.clearLayers();markers.clear();if(map)for(const p of visible){if(!p.mapPoint)continue;const [x,y]=p.mapPoint;markers.set(p.slug,creatorMarker(window.L,p,[-y,x],{className:'almanac-creator-popup',autoPanPaddingTopLeft:[12,84],autoPanPaddingBottomRight:[12,12],maxHeight:Math.max(120,Math.min(320,map.getSize().y-190))}).addTo(layer));}
  const list=document.querySelector('#almanac-other-creators'),rows=new Map([...list.children].map(li=>[li.dataset.slug,li]));for(const p of sortCreators(records,values.sort)){const li=rows.get(p.slug);if(li){li.hidden=!slugs.has(p.slug);list.append(li);}}
  const mapped=visible.filter(p=>p.mapPoint).length;status.textContent=visible.length+' matching creators · '+mapped+' on the U.S. map · '+(visible.length-mapped)+' listed below';
  if(sync){const params=new URLSearchParams(Object.entries(values).filter(([,v])=>v));history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
 }
 function focusCreator(){const slug=new URLSearchParams(location.search).get('creator'),marker=markers.get(slug);if(marker){map.setView(marker.getLatLng(),Math.max(map.getZoom(),0),{animate:false});marker.openPopup();}else if(slug){const row=[...document.querySelectorAll('#almanac-other-creators [data-slug]')].find(li=>li.dataset.slug===slug);row?.scrollIntoView({block:'center'});}}
 form.addEventListener('submit',e=>{e.preventDefault();update();});form.addEventListener('input',()=>update());form.addEventListener('change',()=>update());
 window.addEventListener('popstate',()=>{const params=new URLSearchParams(location.search);for(const field of form.querySelectorAll('input,select'))field.value=params.get(field.name)||(field.name==='sort'?'az':'');update(false);focusCreator();});
 // Existing state keyboard handlers retain ownership of arrow/activation keys.
 svg.addEventListener('keydown',e=>{if(e.target.closest('[data-state]'))e.stopPropagation();});
 try{
  const L=await loadLeaflet(),host=document.createElement('div');host.id='almanac-unified-map';host.setAttribute('aria-label','State Almanac and creator regions map');wrap.append(host);
  const bounds=L.latLngBounds([[-650,-70],[0,1030]]);map=L.map(host,{crs:L.CRS.Simple,scrollWheelZoom:false,minZoom:-4,maxZoom:3,zoomSnap:0,attributionControl:false});
  L.svgOverlay(svg,bounds,{interactive:true}).addTo(map);map.fitBounds(bounds,{animate:false});map.setMinZoom(map.getZoom());layer=L.layerGroup().addTo(map);update(false);focusCreator();
  let width=host.clientWidth,height=host.clientHeight;const resize=new ResizeObserver(()=>{if(width===host.clientWidth&&height===host.clientHeight)return;width=host.clientWidth;height=host.clientHeight;map.invalidateSize();map.setMinZoom(-4);map.fitBounds(bounds,{animate:false});map.setMinZoom(map.getZoom());focusCreator();for(const marker of markers.values()){const popup=marker.getPopup();popup.options.maxHeight=Math.max(120,Math.min(320,map.getSize().y-190));if(marker.isPopupOpen()){marker.closePopup();marker.openPopup();}}});resize.observe(host);
 }catch{if(map){map.remove();map=null;}svg.classList.remove('leaflet-image-layer','leaflet-zoom-animated','leaflet-interactive');svg.removeAttribute('style');wrap.append(svg);document.querySelector('#almanac-unified-map')?.remove();status.textContent='Creator nuggets could not load. State selection still works; browse all creators and videos in the free directory.';}
}
