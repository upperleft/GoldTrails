import {BillingError,billingConfig,stripeId} from './model.js';

// Scope is independent of checkout availability: maintenance must not remove a
// previously confirmed live subscriber's entitlement.
export function billingScope(env=process.env){
 const mode=env.STRIPE_MODE;
 if(!['live','test'].includes(mode)||!stripeId(env.STRIPE_ACCOUNT_ID,'acct')||!stripeId(env.STRIPE_PRICE_ID,'price'))return null;
 return{stripeAccountId:env.STRIPE_ACCOUNT_ID,livemode:mode==='live',priceId:env.STRIPE_PRICE_ID,allowTestEntitlements:false};
}
export function stripeConfig(env=process.env){
 const enabled=env.BILLING_ENABLED==='true';
 if(!enabled&&!env.STRIPE_SECRET_KEY&&!env.STRIPE_WEBHOOK_SECRET)return null;
 const scope=billingScope(env),secretKey=env.STRIPE_SECRET_KEY,webhookSecret=env.STRIPE_WEBHOOK_SECRET,portalConfigurationId=env.STRIPE_PORTAL_CONFIGURATION_ID;
 if(!scope||env.MEMBER_ORIGIN!=='https://goldtrails.org'||!new RegExp(`^(?:sk|rk)_${scope.livemode?'live':'test'}_[A-Za-z0-9]{16,240}$`).test(secretKey||'')||!/^whsec_[A-Za-z0-9]{16,240}$/.test(webhookSecret||'')||(enabled&&!stripeId(portalConfigurationId,'bpc')))throw new BillingError('billing_configuration','Billing settings need attention.',503);
 return Object.freeze({...billingConfig(scope),enabled,origin:'https://goldtrails.org',secretKey,webhookSecret,portalConfigurationId:stripeId(portalConfigurationId,'bpc')?portalConfigurationId:null,pauseEnabled:env.STRIPE_SERVICE_PAUSE_ENABLED==='true',automaticTax:env.STRIPE_AUTOMATIC_TAX_ENABLED==='true'});
}
