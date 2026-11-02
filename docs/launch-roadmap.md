# Gold Trails launch roadmap

Reviewed November 1, 2026. Gold Trails is already publicly accessible at [goldtrails.org](https://goldtrails.org/). The next milestones are a creator invitation launch and the launch of paid Plus subscriptions. Stripe remains the largest unfinished feature. Permanent creator invitations are implemented and verified, and production migration 014 is applied. Complete owner setup and the first personal invitations next.

## Current position

| Area | Current state | Remaining work |
| --- | --- | --- |
| Website and hosting | Existing GitHub → Hostinger Node 22 application; custom domain serves the site | Verify the final release and account flows before announcing paid membership |
| Articles | Eight article pages and a searchable index | Develop the river clothing guide, then a first outing guide |
| Creator directory | 86 source records, including 20 research leads; 63 video libraries with 230 selected videos | Resolve identities, fill gaps, verify contact routes and invite creators |
| Products | 63 products from 28 manufacturers; 18 unresolved research leads | Expand clothing and footwear; refresh specifications, availability and photos |
| Accounts | Signup, verification, sign-in, recovery, sessions, free membership and creator invitation acceptance implemented | Complete owner setup and verify the first real creator acceptance |
| Plus | Server-side access checks and complimentary membership support implemented | Connect subscription billing and preserve complimentary creator access |
| Stripe | Billing routes deliberately disabled | Checkout, webhooks, billing portal, renewal/cancellation/pause handling and reconciliation |
| Research maintenance | Existing daily automation remains active in the original website chat | Turn reviewed findings into articles and catalog updates; preserve its existing budget safeguards |

Inventory numbers describe repository files, not registered creator accounts or a fresh count of production database rows. A directory listing does not mean that its creator has joined Gold Trails. The checkout now includes the October 27 content release `a7e5498`, including the eighth article and Ghost Rivers pages.

## Membership decisions

- Public articles and creator videos remain free. Verified free accounts retain their existing personal calendar features.
- Plus remains **USD $5 per month**, covering the Almanac and existing Connections benefits.
- Invited creators receive **complimentary Plus with no expiry**, attached to their verified account. They need no card, paid trial or Stripe subscription.
- A cookie remembers a sign-in session; the database remembers the creator's free access. Creators can sign in on another device or recover their account without losing that benefit. Existing sessions last eight hours; longer remembered sign-in would be a separate improvement.
- Creator affiliation, Plus access and permission to edit a public creator profile stay separate. Initial invitations must not promise self-service profile editing, which is not implemented.

## First milestone creator access and invitations

Implementation and local acceptance are complete; see [creator invitation setup](creator-invitations.md) for the owner workflow and release checks. It can launch before Stripe.

1. Add an owner workflow to select a creator profile and verified contact email, then issue or revoke a unique invitation. Associate the owner action with a real verified member account so existing reviewer and grant audit fields remain valid.
2. Bind an expiring invitation to that email and creator profile; store only the token hash. Existing members sign in; new members register and verify their email. Show an explicit acceptance action so email link scanners do not consume an invitation.
3. Accept once, in a transaction, after the verified account matches the invitation email. Record creator affiliation and the complimentary Plus grant. Forwarding the link must not let a different account claim the profile.
4. Test new and existing accounts, another device, account recovery, expired/reissued/replayed invitations, wrong-email attempts, revocation and ordinary member permissions. Confirm that no new billing record or charge is created. Handle creators who already pay explicitly so accepting complimentary access does not leave an unwanted renewal running.
5. Send a controlled test invitation and confirm delivery, acceptance and access on the canonical domain.

The friends' guest pass expired October 31 at 9:19 p.m. Eastern. Its shared, temporary browser access is unsuitable for the creator program.

Implementation starts with the existing [account schema](../database/migrations/004_member_accounts.sql), [member store](../app/member-store.js), [membership rules](member-accounts.md) and [mail adapter](../app/member-mail.js). The schema contains invitation-token and creator-account association foundations; the creator workflow and copyable invitation message are now implemented. Automatic invitation email sending remains separate.

## Outreach on November 1 or 2

Prepare personal drafts and check contact routes now. Send the access invitation after its acceptance flow and sender have passed the controlled test. If reaching out sooner, use a public profile feedback message and explain that complimentary account access will follow.

The first two checked routes are Chris Ralph's published business email and Dan Hurd's general contact form. Obtain Dan's preferred account email through that form before generating his email-bound invitation. Expand the batch only as suitable creator-owned contact routes are confirmed; the full directory is not an email-ready list.

The [creator outreach plan and draft](creator-outreach.md) covers personalization, sender checks, tracking and future automation. Automate draft preparation, invitation generation, duplicate suppression and status tracking first. Keep a review step for recipients and final copy. Follow-ups must stop on replies, declines, delivery failures or opt-outs.

## Second milestone Stripe subscriptions

1. Configure the Stripe account and test environment; create a server-selected **$5.00 USD/month (500 cents)** price. Enter credentials privately in the hosting environment. Enforce the allowed provider and test/live mode consistently across member and Connections access checks.
2. Add hosted subscription Checkout for verified signed-in members, binding Stripe customer and subscription IDs to the account and preventing duplicate subscriptions. Complimentary creators should see their included access rather than a purchase prompt.
3. Process signed webhook events using the original request body, persistent event IDs and transactional updates. Handle duplicate and out-of-order events, failed initial/renewal payments, recovery and expiration. Never grant access just because the browser reaches a success page. Preserve complimentary grants when billing events arrive.
4. Add an account-bound billing portal for payment details, invoices and cancellation at the end of the paid period. Reconcile missed events on a schedule and surface failures privately.
5. Carry forward the already requested **three-month pause**: start after the paid period, stop charges and Plus during the pause, preserve the free account, allow early restart/cancellation, and explain automatic resumption with an advance reminder. Confirm the exact Stripe lifecycle and support the necessary provider states in local storage.
6. Test checkout → webhook → correct account access; renewal failure/recovery; account isolation; wrong prices/modes; duplicates and missed events; cancellation/expiry; complimentary grant preservation; and the full pause/resume cycle.

Stripe's [subscription webhook documentation](https://docs.stripe.com/billing/subscriptions/webhooks) explains the asynchronous lifecycle. Its [pause documentation](https://docs.stripe.com/billing/subscriptions/pause) covers suspending service and invoice generation; pausing collection alone does not implement the requested behavior. Use the [customer portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal) for supported account billing controls.

One-time donations are also disabled. Keep them a separate implementation with no Plus entitlement; decide whether to include them in the initial paid release or revise their public promotion before that release.

## Work that continues alongside launch

| Queue | Next deliverable | Completion condition |
| --- | --- | --- |
| Articles | What to wear for a day prospecting beside a river | Sourced guide with wader/boot distinctions, fit and care guidance, catalog links and relevant river safety sources |
| Articles | Planning your first prospecting outing | Connect existing technique articles, access research, clubs and equipment into one practical guide |
| Products | River clothing and footwear expansion | Refresh existing waders, boots and gloves; evaluate new footwear and fit options using the [research brief](river-clothing-research-2026-11-01.md) |
| Creators | Improve existing records | Resolve the 20 catalog leads and 23 missing video libraries; retain unresolved identity conflicts |
| Creator contributions | Invite equipment notes and profile corrections | Attribute creator statements only after actual confirmation; avoid implying endorsement from a directory listing |
| Research | Continue existing maintenance and editorial review | Preserve originals and review flags; only reviewed evidence becomes published claims |

Suggested initial cadence after the creator access work: one article draft and one small creator/product review batch per week, adjusted to available capacity. This is a work queue, not a newly scheduled automation.

The existing maintenance automation is **Gold Trails daily research maintenance**, attached to **Gold Trails — Website & Research**. It runs daily at 10 a.m. Eastern, with optional new-source discovery on Sundays under its usage safeguards. The November 1 run successfully imported 48 findings covering 12 videos into the private library; those findings still require review. Keep this automation rather than creating a duplicate.

## Paid launch acceptance

- [x] Creator invitations and permanent complimentary account access pass local end-to-end checks; production migration 014 is applied.
- [ ] The first real creator accepts a personal invitation.
- [ ] Live signup, verification, sign-in, recovery and sign-out work on goldtrails.org.
- [ ] Stripe test scenarios above pass, including cancellation and three-month pause.
- [ ] Price, renewal, cancellation, pause, support and relevant policy wording match implemented behavior.
- [ ] Production database backup, required migrations and rollback procedure are ready.
- [ ] Final deployment passes public/free/creator/paid access checks and a narrow-screen review of signup, checkout return and account controls.
- [ ] Live billing configuration is reviewed with Paul, then enabled and checked with a controlled real transaction and receipt. Remove staging notices in the release that enables working billing.

## Verification on November 1

The creator invitation release passes **453 automated tests** on Node 22.23.3, **10 real MariaDB checks**, and native Safari acceptance and owner-form checks with fictional accounts. The build passes **21 HTML pages and 732 local references**. These checks do not validate real Stripe transactions or inbox delivery.

Fresh unauthenticated public requests returned 200 for the homepage, Plus, articles, products, creators, signup, login and Connections pages. California Almanac research correctly returned 403, and `/billing/subscribe/` returned the intended 503 payments-disabled response. The live Plus page still says checkout is not connected. Authenticated flows and production database state were not exercised in this audit.

Use **Safari** for browser work, per Paul's preference.
