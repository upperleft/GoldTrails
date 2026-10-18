# Gold Trails Plus — scope and launch status
Updated 2026-10-15. Target public launch: November 1, 2026 (America/New_York).

## Current decision
Paul superseded the original membership brief: the full State Almanac and, as approved October 16, Gold Connections participation are the $5 USD/month subscription benefits. Do not build or advertise a private journal, advanced trip planner, weather/river alerts, or other unfinished premium tools. Original instructions keeping all existing state information public are superseded by this explicit Almanac access decision. The entire interactive Almanac/creator map is premium. Keep a clearly labeled sourced California overview excerpt and a benefits preview public so visitors can inspect the offer. All creator directory/search, profile and video links remain free. No state is selected by default. Articles, glossary, equipment, creators, the existing personal dashboard and calendar remain free; private account features still require verified account sign-in.

“Coming soon” is staging text, not the intended November 1 launch experience. Replace it with working checkout and account billing controls only after provider configuration, verification, and Paul’s approval to activate live charging. Do not replace it with an active-looking button before money and access flows actually work.

See [unified-almanac-map.md](unified-almanac-map.md) for the current combined-map implementation and expanded access tests.

## Implemented
- /plus/: accurate one-benefit offer, $5/month pricing, sourced excerpt, Free/Plus comparison, transparent planned automatic-renewal/cancellation terms and separate donation link. Existing state-bird artwork reused.
- /donate/: voluntary one-time support, explicitly separate from Plus, no renewal and no premium entitlement. Collection is disabled.
- Shared server response decoration inserts exactly one compact support panel in each existing left sidebar, with mobile layout. No per-page duplicates or pop-ups; owner administration and JSON/assets excluded.
- Full /gold-almanac/:state/ HTML and /api/gold-almanac/:state/ JSON require the existing effective subscriber entitlement, or an independently validated owner session for review. Authorization runs on every request before cached editorial data can be read. Free, expired, forged and unavailable authentication cannot reveal full research. Canonical redirects do not bypass the check.
- Paid responses are private/no-store, vary by Cookie and noindex. Detailed state paths are excluded from the public usage collector. The public root preview and its excerpt remain measurable only after optional consent.
- The map client handles the server’s plus_required response as an access panel rather than a failed state load. Direct links and no-JavaScript pages also enforce access. State-specific sign-in return paths are restricted to internal routes.
- Account/signup copy uses the new Plus offer. Personal Compass tools now accept verified free accounts, keeping the Almanac as the sole subscription feature. Account isolation and CSRF checks remain.
- Payment entry points /billing/subscribe/, /billing/donate/, /billing/manage/ and /billing/webhook/ deliberately return unavailable. No provider credentials, products, charges, donations or memberships were created.

## Payment architecture and work still required
Existing member_accounts, member_memberships and member_subscriptions provide permanent account identity and server-side entitlement checks. Paid access requires an active account and current subscription belonging to that account; cancellation scheduled at period end retains active access through its verified end. Past-due, canceled, expired or invalid records cannot grant Almanac access. Owner complimentary grants remain distinct and are not created by this work.

Stripe is the intended provider. No Vercel deployment or new hosting platform is needed. No live or test chargeable products have been created, respecting the brief’s approval boundary. The provider adapter, checkout, signed webhook processor, provider-event deduplication storage, account portal, failed-payment notices and reconciliation job still need implementation/configuration and provider testing; disabled routes are boundaries, not a claim that these work.

### Three-month subscription pause — requested October 18, 2026

Confirmed requirement from Paul: offer a **Pause for three months** option when subscription billing is configured. This is a future billing requirement; no pause control or payment functionality has been activated.

Planned behavior for implementation:
- Place the pause option alongside cancellation in the account's subscription controls.
- Start the pause after the current paid-through period, preserving access already purchased. Pause billing and Plus access for three calendar months; retain the free account and its saved information.
- Permit an earlier restart and continued access to cancellation. Show the exact pause and restart dates and applicable recurring price before confirming.
- Resume the subscription after the three-month pause with an advance email reminder, clearly explaining automatic resumption when the pause is selected. Do not accumulate charges for the paused period.
- Verify the billing-provider lifecycle and server-side entitlements together. Pausing must not merely suppress payment collection while unpaid invoices accumulate.

These behavior details are proposed implementation defaults, not claims about existing Stripe configuration. Confirm their customer-facing wording during payment setup.

The future integration must:
1. Create a subscription checkout only for a signed-in verified account, with server-selected USD 500/month pricing. Bind customer and subscription IDs to that account. Never trust a browser membership flag, submitted amount, success URL, or email-only match. No card data on Gold Trails.
2. Use a separate one-time payment checkout for gifts, optionally without an account. Donation events go to a separate ledger and never update member_memberships. No recurring donation option is included.
3. Verify Stripe signatures against the exact raw body, validate event mode and configured price/currency, retrieve current provider state, process event IDs transactionally/idempotently, and handle duplicate/out-of-order delivery. An unverified webhook cannot change access.
4. Extend paid-through access only from confirmed paid state; cover initial authentication-required/failed payments, renewal failures, past_due/unpaid/expired states, and restored payments. Preserve an existing valid complimentary grant instead of overwriting it with a failed payment.
5. Provide an account-bound Stripe customer portal for cancellation/payment-method changes. Cancellation schedules renewal to stop; confirmed current-period access remains until expiry. No customer ID supplied by the browser is trusted.
6. Reconcile missed webhooks on a scheduled basis, record provider event IDs and meaningful audit entries, and surface failures privately. Hosting deployment alone must never activate billing.

## Launch acceptance before November 1
- Stripe account and sandbox configured, $5/month price and one-time donation setup reviewed.
- Full sandbox checkout → signed webhook → correct account → Almanac access round trip. Donation round trip grants no subscription.
- Cancel at period end, expiry, failed initial/renewal payment, recovery, duplicate/out-of-order webhook, wrong price/mode, and account isolation verified. Billing controls and emails verified.
- Three-month pause, paid-through transition, no billing or Plus access during the pause, preserved free account, early restart, scheduled restart/reminder, cancellation while paused, and duplicate/out-of-order pause/resume events verified before offering this control.
- Live activation separately approved; real configuration then smoke-tested with Paul, with correct price, terms, receipts and cancellation behavior.
- Staging notices removed in the same release that actually enables payment and cancellation. No charging on deployment by default.

## Verification
52 focused checks passed; complete suites: 218 release and 244 development tests passed. Both builds passed: 13 release HTML pages / 354 local references, 17 development pages / 549 references. Browser checked the desktop Plus page, 390px phone layout (document width 390px, one support panel), and map selection → JSON 403 → clear Plus panel for Texas. No browser warnings/errors in that flow. API tests cover all 50 states, active/free/expired/forged/owner access, cached-content authorization and unavailable authentication. Paid access tests use bounded fixtures; real provider payment and live paid-account sign-in are not yet verified.

## Official references checked 2026-10-15
- https://docs.stripe.com/payments/checkout/quickstarts — hosted payment boundary.
- https://docs.stripe.com/api/checkout/sessions/create — separate payment and subscription modes.
- https://docs.stripe.com/billing/subscriptions/webhooks — paid state, failures and status changes.
- https://docs.stripe.com/api/subscriptions/object — subscription state.
- https://support.stripe.com/questions/billing-customer-portal — account billing management.
- https://support.stripe.com/questions/how-to-accept-donations-through-stripe — one-time gifts.

Local preview is temporary on 127.0.0.1:4324 and has no real accounts or payments. Live staging publication and verification to be recorded below.

## Staging publication verified
Published release commit 20c51df9 through GitHub Desktop to Hostinger; hPanel shows Completed / Current. Live /plus/ returns 200, unsigned Nevada HTML and JSON return 403 with no full research, and /articles/ remains 200. Browser selected Texas on the live map and received the clear Plus panel without console warnings/errors. The support panel and existing feedback/statistics controls appear on the live Plus page. Screenshot: outputs/Gold-Trails-Plus-Staging-2026-10-15.png. No schema migration, credentials, payment products, charges or membership grants were needed.

Stripe account setup is awaiting Paul’s reply. Live paid-member/owner browser access is not claimed verified; local access-boundary tests passed. Subscription billing, donations, renewals, cancellation and payment-failure handling remain required before the November 1 launch.

The live signup page exposes the active free-account form (not the closed-registration preview). This confirms form availability, not end-to-end email delivery; signup/verification/recovery should be exercised in the launch acceptance run.
