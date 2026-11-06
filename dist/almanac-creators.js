import {matchesCreator,sortCreators} from './prospectors-data.js';
import {creatorMarker,loadLeaflet} from './creator-map-shared.js';
function mountPanningMarkers(L, map, svg) {
 const sites = [...svg.querySelectorAll('[data-pan-point]')].map(link => {
  const [x, y] = link.dataset.panPoint.split(',').map(Number);
  return {link, location: [-y, x]};
 });
 if (!sites.length) return;

 const layer = L.layerGroup().addTo(map);
 const render = () => {
  // Even at full zoom, Alaska's inset can put several destinations under one icon.
  const groups = [];
  for (const site of sites) {
   const point = map.latLngToLayerPoint(site.location);
   const nearby = groups.find(group => point.distanceTo(group.point) < 30);
   if (nearby) nearby.sites.push(site);
   else groups.push({point, location: site.location, sites: [site]});
  }

  layer.clearLayers();
  for (const group of groups) {
   const links = group.sites.map(site => site.link);
   const label = links.length === 1 ? links[0].getAttribute('aria-label') : `${links.length} nearby panning destinations`;
   const icon = document.createElement('span');
   const graphic = links[0].querySelector('svg').cloneNode(true);
   graphic.removeAttribute('x');
   graphic.removeAttribute('y');
   icon.append(graphic);
   if (links.length > 1) {
    const count = document.createElement('span');
    count.className = 'almanac-pan-count';
    count.setAttribute('aria-hidden', 'true');
    count.textContent = links.length;
    icon.append(count);
   }

   const list = document.createElement('ul');
   list.className = 'almanac-pan-popup-links';
   for (const link of links) {
    const item = document.createElement('li');
    const destination = document.createElement('a');
    destination.href = link.getAttribute('href');
    destination.textContent = link.getAttribute('aria-label');
    item.append(destination);
    list.append(item);
   }
   const marker = L.marker(group.location, {
    title: label,
    icon: L.divIcon({className: 'almanac-pan-marker', html: icon, iconSize: [24, 24], iconAnchor: [12, 12]}),
    zIndexOffset: 1,
   }).bindPopup(list, {maxHeight: 260}).addTo(layer);
   marker.getElement().setAttribute('aria-label', label);
   marker.on('click', ({originalEvent}) => {
    if (originalEvent instanceof KeyboardEvent) list.querySelector('a')?.focus({preventScroll: true});
   });
  }
 };
 render();
 map.on('zoomend', render);
 map.getContainer().classList.add('has-pan-markers');
}

const data=document.querySelector('#almanac-creator-data');
if(data){
 const {records}=JSON.parse(data.textContent),svg=document.querySelector('.almanac-map'),wrap=svg.parentElement,form=document.querySelector('.explorer-form'),status=document.querySelector('#almanac-creator-status');
 let map,layer;const markers=new Map(),provinces=[...svg.querySelectorAll('[data-canada-region]')];
 const filters=()=>Object.fromEntries(new FormData(form));
 function update(sync=true){const values=filters(),visible=records.filter(p=>matchesCreator(p,values)),slugs=new Set(visible.map(p=>p.slug));
  layer?.clearLayers();markers.clear();if(map)for(const p of visible){if(!p.mapPoint)continue;const [x,y]=p.mapPoint;markers.set(p.slug,creatorMarker(window.L,p,[-y,x],{className:'almanac-creator-popup',autoPanPaddingTopLeft:[12,84],autoPanPaddingBottomRight:[12,12],maxHeight:Math.max(120,Math.min(320,map.getSize().y-190))}).addTo(layer));}
  for(const list of [document.querySelector('#almanac-other-creators'),document.querySelector('#almanac-canadian-creators')]){if(!list)continue;const rows=new Map([...list.children].map(li=>[li.dataset.slug,li]));for(const p of sortCreators(records,values.sort)){const li=rows.get(p.slug);if(li){li.hidden=!slugs.has(p.slug);list.append(li);}}}
  const mapped=visible.filter(p=>p.mapPoint).length,canadian=visible.filter(p=>p.mapCountry==='CA').length;status.textContent=visible.length+' matching creators · '+mapped+' on the U.S. & Canada map · '+(visible.length-mapped)+' listed below';
  const canadianStatus=document.querySelector('#almanac-canada-status');if(canadianStatus)canadianStatus.textContent=canadian?canadian+' matching Canadian creator'+(canadian===1?'':'s'):'No Canadian creators match these filters. Choose All regions to see the Canadian roster.';
  const canadianSelection=provinces.some(p=>p.dataset.canadaRegion===values.region);
  if(sync){if(canadianSelection)window.dispatchEvent(new CustomEvent('gold-trails:canada-region',{detail:{slug:values.region}}));const params=new URLSearchParams(Object.entries(values).filter(([,v])=>v));history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
 }
 function focusCreator(){const slug=new URLSearchParams(location.search).get('creator'),marker=markers.get(slug);if(marker){map.setView(marker.getLatLng(),Math.max(map.getZoom(),0),{animate:false});marker.openPopup();}else if(slug){const row=[...document.querySelectorAll('#almanac-other-creators [data-slug]')].find(li=>li.dataset.slug===slug);row?.scrollIntoView({block:'center'});}}
 form.addEventListener('submit',e=>{e.preventDefault();update();});form.addEventListener('input',()=>update());form.addEventListener('change',()=>update());
 window.addEventListener('popstate',()=>{const params=new URLSearchParams(location.search);for(const field of form.querySelectorAll('input,select'))field.value=params.get(field.name)||(field.name==='sort'?'az':field.name==='region'?(provinces.find(p=>location.pathname==='/gold-almanac/'+p.dataset.canadaRegion+'/')?.dataset.canadaRegion||''):'');update(false);focusCreator();});
 // Existing state keyboard handlers retain ownership of arrow/activation keys.
 const chooseProvince=province=>{form.elements.region.value=province.dataset.canadaRegion;update();};
 svg.addEventListener('click',e=>{const p=e.target.closest('[data-canada-region]');if(!p||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();chooseProvince(p);});
 svg.addEventListener('keydown',e=>{if(e.target.closest('[data-state]')){e.stopPropagation();return;}const p=e.target.closest('[data-canada-region]');if(!p)return;let index=provinces.indexOf(p);if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();chooseProvince(p);return;}if(['ArrowRight','ArrowDown'].includes(e.key))index=(index+1)%provinces.length;else if(['ArrowLeft','ArrowUp'].includes(e.key))index=(index+provinces.length-1)%provinces.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=provinces.length-1;else return;e.preventDefault();e.stopPropagation();provinces.forEach((p,i)=>p.setAttribute('tabindex',i===index?'0':'-1'));provinces[index].focus();});
 try{
  const L=await loadLeaflet(),host=document.createElement('div');host.id='almanac-unified-map';host.setAttribute('aria-label','United States and Canada Almanac and creator regions map');wrap.append(host);
  const [[minX,minY],[maxX,maxY]]=JSON.parse(svg.dataset.mapBounds),bounds=L.latLngBounds([[-maxY,minX],[-minY,maxX]]);map=L.map(host,{crs:L.CRS.Simple,scrollWheelZoom:false,minZoom:-4,maxZoom:3,zoomSnap:0,attributionControl:false});
  L.svgOverlay(svg,bounds,{interactive:true}).addTo(map);map.fitBounds(bounds,{animate:false});map.setMinZoom(map.getZoom());layer=L.layerGroup().addTo(map);mountPanningMarkers(L,map,svg);update(false);focusCreator();
  let width=host.clientWidth,height=host.clientHeight;const resize=new ResizeObserver(()=>{if(width===host.clientWidth&&height===host.clientHeight)return;width=host.clientWidth;height=host.clientHeight;map.invalidateSize();map.setMinZoom(-4);map.fitBounds(bounds,{animate:false});map.setMinZoom(map.getZoom());focusCreator();for(const marker of markers.values()){const popup=marker.getPopup();popup.options.maxHeight=Math.max(120,Math.min(320,map.getSize().y-190));if(marker.isPopupOpen()){marker.closePopup();marker.openPopup();}}});resize.observe(host);
 }catch{if(map){map.remove();map=null;}svg.classList.remove('leaflet-image-layer','leaflet-zoom-animated','leaflet-interactive');svg.removeAttribute('style');wrap.append(svg);document.querySelector('#almanac-unified-map')?.remove();status.textContent='Creator nuggets could not load. State selection still works; browse all creators and videos in the free directory.';}
}
