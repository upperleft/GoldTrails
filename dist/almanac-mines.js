(() => {
 let leafletPromise=null,current=null,revision=0;
 const loadLeaflet=()=>{
  if(window.L)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
   const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
   const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
   let settled=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);if(error){css.remove();script.remove();reject(error);}else resolve(window.L);};
   const timeout=setTimeout(()=>finish(new Error('Map library timed out')),15000);
   let styled=false,loaded=false;
   css.onload=()=>{styled=true;if(loaded)finish();};css.onerror=()=>finish(new Error('Map styles unavailable'));
   script.onload=()=>{loaded=!!window.L;if(!loaded)finish(new Error('Map unavailable'));else if(styled)finish();};script.onerror=()=>finish(new Error('Map library unavailable'));
   document.head.append(css,script);
  }).catch(error=>{leafletPromise=null;throw error;});
  return leafletPromise;
 };
 function destroy(){revision++;current?.remove();current=null;}
 function mount(panel){
  const button=panel.querySelector('[data-mine-map-load]'),container=panel.querySelector('[data-mine-map]'),status=panel.querySelector('[data-mine-map-status]');
  if(!button||!container||!status)return;
  const token=revision;
  button.addEventListener('click',async()=>{
   if(button.disabled)return;button.disabled=true;status.textContent='Loading the historical map…';
   try{
    const L=await loadLeaflet();if(token!==revision||!container.isConnected)return;
    container.hidden=false;
    current=L.map(container,{scrollWheelZoom:false,maxZoom:16}).setView([44,-71],6);
    current.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:16,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(current);
    tiles.on('tileerror',()=>{if(token===revision)status.textContent='Base-map tiles are unavailable. The historical markers and full records remain available.';});
    const points=[];
    for(const card of panel.querySelectorAll('[data-mine-coordinate]')){
     const coordinate=card.dataset.mineCoordinate.split(',').map(Number);if(coordinate.length!==2||!coordinate.every(Number.isFinite))continue;
     points.push(coordinate);
     const prospective=['gold_prospect','disputed_gold_working'].includes(card.dataset.mineKind);
     const marker=L.marker(coordinate,{title:card.querySelector('h4').textContent,icon:L.divIcon({className:'almanac-mine-marker'+(prospective?' is-prospect':''),html:'<span aria-hidden="true"></span>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(current);
     const popup=document.createElement('div'),title=document.createElement('strong'),note=document.createElement('p'),link=document.createElement('a');
     title.textContent=card.querySelector('h4').textContent;note.textContent='Approximate historic record. Current condition and access are unverified.';
     link.textContent='Read history & sources →';link.href='#'+card.id;link.addEventListener('click',()=>marker.closePopup());
     popup.append(title,note,link);marker.bindPopup(popup);
     const radius=Number(card.dataset.mineAccuracy);if(radius>0)L.circle(coordinate,{radius,color:'#8a6528',weight:1,fillOpacity:.12,interactive:false}).addTo(current);
    }
    if(points.length)current.fitBounds(L.latLngBounds(points).pad(.2),{maxZoom:11});
    button.hidden=true;status.textContent=points.length+' historical records plotted. Use + and − to zoom; select a marker for its history. Locations are approximate.';
   }catch(error){
    if(token!==revision)return;current?.remove();current=null;container.hidden=true;button.disabled=false;button.textContent='Retry historic mine map';status.textContent='The map could not load. All historical records remain below; you can retry.';
   }
  });
 }
 window.goldTrailsMineMap={mount,destroy};
})();
