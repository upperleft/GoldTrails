// Public, attributed spot reference. No member data or credentials are sent upstream.
export const gramsPerTroyOunce = 31.1034768;
export const goldPriceSource = 'https://goldpricezone.com/widget';
const endpoint = 'https://goldpricezone.com/api/public/widget-data';
const refreshMs = 60_000, delayedMs = 15 * 60_000, maxAgeMs = 72 * 60 * 60_000;

export function normalizeGoldPrice(data, now = Date.now()) {
 const price = data?.metals?.gold, asOf = Date.parse(data?.updated);
 if(data?.base !== 'USD' || typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10_000_000 || !Number.isFinite(asOf) || asOf > now + 300_000 || now - asOf > maxAgeMs) throw new Error('Invalid gold-price feed');
 if(data.gramsPerTroyOunce !== undefined && (typeof data.gramsPerTroyOunce !== 'number' || Math.abs(data.gramsPerTroyOunce - gramsPerTroyOunce) > 0.000001)) throw new Error('Unexpected gold-price weight unit');
 return {currency:'USD',perTroyOunce:price,perGram:price / gramsPerTroyOunce,asOf:new Date(asOf).toISOString(),source:'GoldPriceZone',sourceUrl:goldPriceSource};
}

export function createGoldPriceFeed({fetchImpl = fetch, now = Date.now} = {}) {
 let quote = null, pending = null, retryAt = 0, failed = false;
 const snapshot = () => {
  if(!quote || now() - Date.parse(quote.asOf) > maxAgeMs) throw new Error('Gold price unavailable');
  return {...quote,stale:failed || now() - Date.parse(quote.asOf) > delayedMs};
 };
 async function refresh() {
  try {
   const response = await fetchImpl(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(4000),redirect:'error'});
   if(!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('Gold feed unavailable');
   const text = await response.text();if(text.length > 32_768) throw new Error('Gold feed too large');
   const next = normalizeGoldPrice(JSON.parse(text),now());
   // Preserve the last valid quote if the upstream feed unexpectedly moves backward.
   if(quote && Date.parse(next.asOf) < Date.parse(quote.asOf)) throw new Error('Older gold-price snapshot');
   quote = next;failed = false;
  } catch { failed = true; }
  finally { retryAt = now() + refreshMs; }
  return snapshot();
 }
 return async () => {
  if(pending) return pending;
  if(now() < retryAt) return snapshot();
  pending = refresh();try{return await pending;}finally{pending = null;}
 };
}
