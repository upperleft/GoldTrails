# Gold Trails Plus billing

The application implements one Gold Trails Plus price: **USD $5 per month, quantity one**, with no trial, promotion codes or plan changes. Hosted Stripe Checkout collects card details; the website never handles them. Creator grants remain complimentary and do not require a Stripe customer or card.

Billing is disabled until configured and verified. Do not enable live purchases based only on the local tests. Those tests use mocked Stripe objects and an isolated MariaDB instance, not the actual Stripe account.

## Local integration checkpoint

The local `codex/stripe-current-main` branch integrates the preserved billing checkpoint `27934e7` with committed main `8a2d2c2`, including the earlier `5303158` creator updates. The current private-code creator signup, returning-creator sign-in, homepage invitation context, Gold Fun & Finds navigation, compact reading controls, gold-feed/widget placement and Connections create/share actions are preserved. Production compatibility remains optional: creator invitations do not query billing tables until migration 016 is installed.

Verification after merging `8a2d2c2` passed: the full 618-test Node suite and the build with 28 HTML pages and 966 local references. The previous integration passed 57 isolated MariaDB billing/entitlement tests and 26 isolated private-code/named-creator compatibility tests without migration 016. Those database checks remain applicable: this latest merge did not change billing, financial entitlement readers or invitation guards, so they were not repeated. The database checks also cover private-code pending-account completion with migration 016 installed: any existing checkout history blocks credential changes and complimentary conversion without consuming the invitation. An untouched pending account can still complete its complimentary creator account.

The provider request guard now preserves case-sensitive Stripe object IDs in URL segments, while rejecting traversal, encoded separators, query/fragment injection and empty segments. Provider fixtures use mixed-case fake account, price, portal, customer, Checkout and subscription IDs. After this fix, all 620 Node tests pass and the build checks 28 HTML pages and 966 local references.

This checkpoint is local and unpublished. A separate read-only sandbox readiness check passed with account, price and portal each returning HTTP 200, with zero writes. Actual sandbox Checkout, signed payment-webhook reconciliation and the production signing-secret setup remain unverified; no purchase activation or production migration was performed. Merge any later main changes and repeat relevant integration checks before preparing a release.

## Configuration

The protected server environment needs `STRIPE_MODE` (`test` or `live`), `STRIPE_ACCOUNT_ID`, `STRIPE_PRICE_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PORTAL_CONFIGURATION_ID`. `MEMBER_ORIGIN` must be `https://goldtrails.org`. Keep keys out of Git, browser code, logs and support messages. `BILLING_ENABLED=true` opens purchases after the provider checks pass. Otherwise new purchases remain closed.

The nonsecret account/mode/price scope is independent of purchase availability, so disabling new checkout does not remove already confirmed paid access. Keep that scope configured during maintenance. Existing webhook reconciliation and cancellation continue when valid protected provider settings remain configured.

The provider checks the authenticated Stripe account identity, a Standard/full-dashboard account, live charging readiness, the active USD 500-cent monthly licensed price, and an active matching-mode portal configuration. Portal payment-method changes and cancellation at period end must be enabled; subscription updates must be disabled. Configure Gold Trails branding and appropriate public business information on the actual account before launch. An Express account controlled by another platform does not satisfy the purchase checks.

Apply migration `016_stripe_billing.sql` only after a fresh production backup and the preceding migrations. It creates no Stripe objects, payments, accounts or access grants.

## Signed events and reconciliation

Configure the Stripe endpoint at `https://goldtrails.org/billing/webhook/`, using API version **2026-10-28.endive**. Subscribe to:

- `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
- `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`

The handler verifies exact raw-body HMAC signatures with a five-minute delivery timestamp tolerance, mode and account checks. Provider customer and subscription identities must match stored bindings and server-assigned metadata. It retrieves current subscription/invoice state under the account transaction lock; old events cannot blindly overwrite newer provider truth. Durable event deduplication, the subscription update, membership update and audit commit together.

Paid access requires the configured price and a matching full paid invoice line for the subscription's current item period. Zero-value, discounted, prorated or manually recorded outside payments do not establish paid access. The invoice's `amount_paid_off_stripe` is explicitly expanded. Test-mode records never grant production Plus. The return page is read-only and cannot grant access from URL parameters.

Unresolved Checkout attempts retain their idempotency key. A timed-out request must not be treated as a failed subscription. An expired session is retrieved from Stripe before its local attempt can be closed. A completed session remains unresolved until its authoritative subscription has been durably reconciled, preventing a race with creator complimentary conversion.

Members use `/billing/` to check status, open the temporary hosted portal or cancel future renewals. All state-changing website controls require POST, the exact Gold Trails Origin, the member session and its CSRF binding.

## Service pause

`STRIPE_SERVICE_PAUSE_ENABLED=true` exposes a three-calendar-month service pause, after actual Stripe sandbox verification. Checkout creates flexible-billing subscriptions. The pause begins at the confirmed paid period end; a subscription schedule stops service and invoice generation, then attempts to resume with a new billing anchor and `resume_on_payment_success`. It does not use `pause_collection`.

The Stripe portal cannot cancel subscriptions with an attached schedule. Gold Trails therefore also has an authenticated direct cancellation path: it releases an attached schedule, then cancels future renewal at period end. An already paused subscription is canceled without a final invoice or proration. The next authoritative snapshot confirms the resulting state. A network failure between those provider operations needs a retry; do not claim cancellation succeeded until the current provider state is confirmed.

The database tracks pause/resume dates and a seven-day reminder window. No reminder sender or scheduler is activated by this change. Reminder delivery and any early-resume feature require separate implementation and verification before being advertised.

## Validation before opening live purchases

Run the unit and HTTP tests with Node 22. Run `tests/billing-mariadb.integration.mjs` explicitly against a fresh socket-only database named `gold_billing_test`; its opt-in guard accepts only `/private/tmp/goldtrails-billing-db-*/mysql.sock`. It exercises actual transactions, concurrency, rollback and effective membership reads using mocked Stripe responses.

Then verify against Stripe's real sandbox: paid checkout and webhook delivery; a declined card; duplicate/out-of-order event retries; customer/price identity mismatches; period-end cancellation with retained paid access; and an unpaid renewal losing access. Test true pause/resume and schedule-aware cancellation with Stripe test clocks before enabling the pause control. Confirm live account activation, the live price and portal configuration, the production signing secret and successful live-mode readiness checks separately. Do not use a real card to simulate a test payment.

Primary documentation: [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [invoice objects](https://docs.stripe.com/api/invoices/object), [webhook signatures](https://docs.stripe.com/webhooks), [customer-portal limits](https://docs.stripe.com/customer-management), [true pause schedules](https://docs.stripe.com/billing/subscriptions/pause/schedules), [schedule release](https://docs.stripe.com/api/subscription_schedules/release).
