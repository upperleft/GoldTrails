// A checkout being disabled must not remove already confirmed paid access.
// The trusted scope is independent of API keys and purchase availability.
export function paidSubscriptionPredicate(alias,scope=null){
 if(!/^[a-z][a-z0-9_]*$/i.test(alias))throw new Error('Invalid subscription alias');
 if(!scope)return '0=1';
 const {stripeAccountId,priceId,livemode,allowTestEntitlements=false}=scope;
 if(!/^acct_[A-Za-z0-9_]{1,240}$/.test(stripeAccountId||'')||!/^price_[A-Za-z0-9_]{1,240}$/.test(priceId||'')||typeof livemode!=='boolean'||typeof allowTestEntitlements!=='boolean')throw new Error('Invalid billing entitlement scope');
 if(!livemode&&!allowTestEntitlements)return '0=1';
 const a=alias,provider=livemode?'stripe':'stripe_test';
 return `${a}.provider='${provider}' AND ${a}.stripe_account_id='${stripeAccountId}' AND ${a}.livemode=${livemode?1:0} AND ${a}.price_id='${priceId}' AND ${a}.price_valid=1 AND ${a}.status='active' AND ${a}.current_period_start<=UTC_TIMESTAMP(6) AND ${a}.current_period_end>UTC_TIMESTAMP(6) AND ${a}.paid_through>UTC_TIMESTAMP(6)`;
}
