// Public, attributed spot reference. No member data or credentials are sent upstream.
export const gramsPerTroyOunce = 31.1034768;
// Gold API documents this live XAU/USD endpoint as free, without a key, and per troy ounce.
// https://gold-api.com/docs · https://gold-api.com/faqs (checked November 3, 2026).
export const goldPriceSource = 'https://gold-api.com/';
const endpoint = 'https://api.gold-api.com/price/XAU/USD';
const refreshMs = 60_000, delayedMs = 15 * 60_000, maxAgeMs = 72 * 60 * 60_000;

export function normalizeGoldPrice(data, now = Date.now()) {
 const price = data?.price, asOf = Date.parse(data?.updatedAt);
 if(data?.symbol !== 'XAU' || data?.currency !== 'USD' || typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10_000_000 || !Number.isFinite(asOf) || asOf > now + 300_000 || now - asOf > maxAgeMs) throw new Error('Invalid gold-price feed');
 if(data.gramsPerTroyOunce !== undefined && (typeof data.gramsPerTroyOunce !== 'number' || Math.abs(data.gramsPerTroyOunce - gramsPerTroyOunce) > 0.000001)) throw new Error('Unexpected gold-price weight unit');
 return {currency:'USD',perTroyOunce:price,perGram:price / gramsPerTroyOunce,asOf:new Date(asOf).toISOString(),source:'Gold API',sourceUrl:goldPriceSource};
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
