// Stripe hosts checkout for one-time tips. This public link is optional.
export const donationPaymentLink = 'https://buy.stripe.com/14A00c9MV6V709525Qb7y00';

const livePaymentLink = /^https:\/\/(?:buy|donate)\.stripe\.com\/[A-Za-z0-9]{1,128}$/;

export function donationCheckoutUrl(value) {
 return typeof value === 'string' && value === value.trim() && livePaymentLink.test(value) ? value : null;
}
