(() => {
 const menu=document.querySelector('.left .trail-menu');
 if(!menu || document.body.classList.contains('admin-editor')) return;
 const box=document.createElement('section');box.className='gold-price-box';box.setAttribute('aria-labelledby','gold-price-title');
 box.innerHTML='<div class="gold-price-heading"><span aria-hidden="true">✦</span><h3 id="gold-price-title">Gold price</h3></div><p class="gold-price-unit">Spot reference · USD</p><dl><div><dt>Per troy ounce</dt><dd data-gold-ounce>—</dd></div><div><dt>Per gram</dt><dd data-gold-gram>—</dd></div></dl><p class="gold-price-status" role="status">Checking price…</p><p class="gold-price-date" hidden>Feed updated <time></time></p><a class="gold-price-source" href="https://goldpricezone.com/widget" target="_blank" rel="noopener noreferrer" data-help="View the gold-price feed source in a new tab. This is a spot reference for pure gold, not a quote for selling natural nuggets. One troy ounce is 31.1034768 grams.">Source: GoldPriceZone ↗</a>';
 menu.append(box);
 const ounce=box.querySelector('[data-gold-ounce]'),gram=box.querySelector('[data-gold-gram]'),status=box.querySelector('.gold-price-status'),date=box.querySelector('.gold-price-date'),time=box.querySelector('time'),money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
 const maxAge=72*60*60_000;let last=null,busy=false,timer;
 function render(quote,failed=false){
  const asOf=Date.parse(quote?.asOf),age=Date.now()-asOf;
  if(!quote || !Number.isFinite(asOf) || age>maxAge){ounce.textContent=gram.textContent='—';status.textContent='Price temporarily unavailable.';date.hidden=true;return;}
  ounce.textContent=money.format(quote.perTroyOunce);gram.textContent=money.format(quote.perGram);
  status.textContent=failed || quote.stale || age>15*60_000?'Last reported · update delayed':'Latest available spot price';
  time.dateTime=quote.asOf;time.textContent=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(asOf));date.hidden=false;
 }
 async function update(){
  if(busy || document.hidden)return;busy=true;
  try{
   const response=await fetch('/api/gold-price/',{credentials:'omit',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();
   const quote=await response.json();
   if(quote.currency!=='USD' || typeof quote.perTroyOunce!=='number' || !Number.isFinite(quote.perTroyOunce) || quote.perTroyOunce<=0 || typeof quote.perGram!=='number' || !Number.isFinite(quote.perGram) || quote.perGram<=0 || Math.abs(quote.perGram-quote.perTroyOunce/31.1034768)>0.000001 || !Number.isFinite(Date.parse(quote.asOf)) || Date.parse(quote.asOf)>Date.now()+300_000)throw new Error();
   last=quote;render(last);
  }catch{render(last,true);}
  finally{busy=false;clearTimeout(timer);if(!document.hidden)timer=setTimeout(update,60_000);}
 }
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)update();});
 window.addEventListener('pageshow',()=>{if(!busy)update();});
 window.addEventListener('pagehide',()=>clearTimeout(timer));
 update();
})();
