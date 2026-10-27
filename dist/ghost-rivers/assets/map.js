import {loadLeaflet} from '/creator-map-shared.js';
const root=document.querySelector('[data-ghost-map]');
const status=document.querySelector('#map-status');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try {
 const [L,response]=await Promise.all([loadLeaflet(),fetch('/ghost-rivers/assets/map-data.json')]);
 if(!response.ok)throw Error('Map data unavailable');
 const data=await response.json();
 const map=L.map(root,{scrollWheelZoom:false}).fitBounds([[44.66,-70.72],[44.84,-70.52]]);
 L.control.scale({imperial:false}).addTo(map);
 const terrain=L.imageOverlay('/ghost-rivers/assets/swift-hillshade.png',[[44.66,-70.72],[44.84,-70.52]],{attribution:'USGS 3DEP terrain overview · Export checked Oct 27, 2026',interactive:false}).addTo(map);
 const topo=L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',{attribution:'USGS The National Map',maxZoom:16});
 let selected=null;
 const details=document.querySelector('#feature-detail');
 function describe(feature,layer){
  const p=feature.properties;
  const name=p.unit?`Mapped unit ${p.unit}`:p.symbol||p.name;
  const text=`<h3>${escape(name)}</h3><p><strong>${escape(p.classification)}</strong></p><p>${escape(p.explanation||'Published modern hydrographic flowline. FType '+p.ftype+' may include artificial paths through water features; it is not a survey of today’s banks.')}</p><dl><dt>Time / period</dt><dd>${escape(p.period)}</dd><dt>Source</dt><dd>${escape(p.author||'USGS National Hydrography Dataset')} ${escape(p.publicationYear||p.sourceDate||'')}</dd><dt>Confidence</dt><dd>${escape(p.confidence)}</dd><dt>Limits</dt><dd>${escape(p.goldEvidence)}</dd></dl><p><a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer">Open original source</a></p><p class="map-small">${escape(p.id)} · Checked ${escape(p.checkedOn)}${p.sourceDateMeaning?' · '+escape(p.sourceDateMeaning):''}</p>`;
  layer.bindPopup(text,{maxWidth:340});
  layer.on('click',()=>{if(selected)selected.setStyle({weight:selected.feature.properties.unit?1:3});layer.setStyle({weight:5});selected=layer;details.innerHTML=text;});
 }
 const river=L.geoJSON(data.layers.river,{style:{color:'#17618d',weight:3},onEachFeature:describe}).addTo(map);
 const units=L.geoJSON(data.layers.units,{style:f=>({color:'#6b674c',weight:1,fillColor:f.properties.unit==='Qst'?'#e2be6d':'#c7c5a9',fillOpacity:.32}),onEachFeature:describe});
 const meltwater=L.geoJSON(data.layers.meltwater,{style:{color:'#814675',weight:3,dashArray:'8 6'},onEachFeature:describe}).addTo(map);
 const layers={river,units,meltwater};
 document.querySelectorAll('[data-layer]').forEach(input=>{input.disabled=false;input.addEventListener('change',()=>{const layer=layers[input.dataset.layer];input.checked?layer.addTo(map):map.removeLayer(layer);});});
 document.querySelector('#terrain-choice').disabled=false;
 document.querySelector('#terrain-choice').addEventListener('change',event=>{if(event.target.value==='topo'){map.removeLayer(terrain);topo.addTo(map);river.bringToFront();meltwater.bringToFront();}else{map.removeLayer(topo);terrain.addTo(map);terrain.bringToBack();}});
 topo.on('tileerror',()=>{status.textContent='Some USGS topographic tiles could not load. Choose the saved terrain overview; the local survey layers remain available.';});
 document.querySelector('#reset-map').disabled=false;
 document.querySelector('#reset-map').addEventListener('click',()=>map.fitBounds([[44.66,-70.72],[44.84,-70.52]]));
 const select=document.querySelector('#mapped-features');select.disabled=false;
 data.layers.meltwater.features.forEach(f=>{const o=document.createElement('option');o.value=f.properties.id;o.textContent=f.properties.quadrangle+' · '+f.properties.id;select.append(o);});
 select.addEventListener('change',()=>{meltwater.eachLayer(layer=>{if(layer.feature.properties.id===select.value){if(!map.hasLayer(meltwater)){meltwater.addTo(map);document.querySelector('[data-layer="meltwater"]').checked=true;}map.fitBounds(layer.getBounds(),{maxZoom:14});layer.fire('click');layer.openPopup();}});});
 status.textContent=`Loaded ${data.layers.river.features.length} hydrographic segments, ${data.layers.meltwater.features.length} mapped meltwater lines and ${data.layers.units.features.length} geology polygons. Feature counts are not prospecting targets. Scroll-wheel zoom is off; use +/− or touch controls.`;
 document.querySelector('#terrain-fallback').hidden=true;
} catch(error) {
 status.textContent='Interactive map could not load. The saved USGS terrain overview and source-linked case study below remain available. No hypothesis is shown as a factual channel.';
 root.hidden=true;
}
