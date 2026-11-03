# Complimentary creator accounts and invitations

Implemented November 1, 2026. The owner can create personal invitations at `/admin/creator-invitations/`. A creator accepts using a verified account with the invited email. Acceptance grants complimentary Plus with no expiry, no card and no Stripe subscription.

## Owner setup and invitation steps

1. Sign in through [administrator sign-in](https://goldtrails.org/admin/login/) and open **Creator invitations** in the administration menu.
2. Once, enter your own existing verified Gold Trails member email under **Set up your invitation account**. This identifies the account approving each grant; it does not change your administrator sign-in or grant a member administrator privileges.
3. Select a published creator profile and enter the email the creator wants for their account. If their profile is absent, review the creator roster/import or publish that profile first.
4. Select **Create invitation link**. Copy the creator-name link (`/invite/<creator-slug>/`) and suggested message from the response. The name selects the invitation; it never signs anyone into an account. Acceptance still requires the invited, verified email. No invitation email is sent automatically. Older private token links continue to work; their raw tokens cannot be recovered from the database.
5. The creator opens the link and sees the full Gold Trails homepage. A private notice at the top offers **Continue to your free creator account**. The rest of the homepage navigation is visible but inactive until acceptance. They follow Continue to create or sign in to their account, verify their email if needed, and explicitly accept. Acceptance returns them to the homepage with normal navigation and a welcome linking to their creator profile. Their complimentary access follows the same account on other devices.

Links last **14 days**. Creating a replacement for the same creator and email invalidates earlier pending links. The owner can revoke a pending link and see invitation status. Changing the configured owner member account invalidates its outstanding invitations. An accepted membership has no expiry; revoking a pending link is separate from removing accepted account access.

If verification opens in another browser, the creator can reopen the original invitation in that browser after signing in. A wrong email, suspended account/membership, blocked creator association or unresolved subscription prevents acceptance without consuming the link. Existing subscriptions require owner review so a creator is not left paying after accepting complimentary access.

## Implementation

- `app/creator-invitations/store.js` stores token hashes, creator/email binding, expiry, acceptance and audit records. Database transactions and a consistent lock order serialize reissue, revoke and acceptance.
- `app/creator-invitations/handler.js` handles link exchange, verified acceptance and owner actions. The bearer leaves the URL after its initial exchange into a Secure, HttpOnly, host-only cookie and a redirect to `/`. GET/HEAD never consumes it. POST requires the correct origin, form token and authenticated member session.
- A valid pending invitation preserves the illustrated homepage and equivalent phone/text layout, with inert navigation and one Continue destination. It contains no recipient email or bearer. Public event, suggestion, analytics and paid-promotion wrappers are bypassed so they cannot introduce competing links. Missing, invalid, expired, revoked or accepted invitations leave the ordinary homepage intact. Optional invitation-storage errors also leave the homepage available.
- `app/members.js` carries a valid pending invitation through signup, email verification, sign-in and recovery using a focused layout without public navigation or purchase offers. A wrong-account visitor can sign out through the native CSRF-protected form while retaining their invitation context. Optional invitation lookup failures do not block ordinary account access or recovery.
- The invitation email and acceptance page provide no profile link before acceptance. In a browser with a valid pending invitation, requests for that invited creator's public profile or video page return to acceptance. This is a journey aid, not a public profile paywall; ordinary public visitors remain unaffected.
- After acceptance, `acceptedProfile(accountId)` supplies only the published creator's slug and display name, requiring an active verified account, effective complimentary membership, a consumed invitation for that exact account and approved affiliation. The homepage success flag alone grants nothing. The account page also offers this verified profile link, without profile-editing permissions.
- Acceptance uses the existing membership entitlement. New creator affiliation has `permission='creator'`, which grants no profile editing or administrative role. Existing approved editor permissions remain intact.
- Invitation pages are excluded from optional analytics, public promotion wrappers, caching and indexing. Clean form pages preserve Origin for native Safari POSTs; the bearer exchange uses no-referrer.

## Database and release

Production migration **014 was applied and verified on November 1, 2026**, after a complete private SQL backup of all 75 existing tables. Verification found the migration marker and all three invitation tables, with zero invitations and no owner binding created automatically. Do not rerun this migration on production.

For a new database, apply [migration 014](../database/migrations/014_creator_invitations.sql) once after the existing member/account foundation, using a current complete private database export. It extends the creator affiliation enum and adds settings, invitation and audit tables. It seeds only an empty settings row; no real account, privilege or membership is created.

MariaDB DDL commits implicitly. If any statement fails, stop and inspect partial state before continuing; do not blindly rerun the migration or drop populated tables. Existing owner sessions, credentials, signup settings and email-provider settings do not need changing.

Deploy the tested source through the existing GitHub → Hostinger flow. Confirm unauthenticated admin access still redirects to sign-in, invalid personal links return 410, member signup/sign-in remain available and Stripe routes remain disabled. Complete the owner setup through the UI before creating actual creator invitations.

For rollback, restore the previous application release while retaining the additive invitation schema and audit records. Do not delete accepted membership grants as an incidental deployment rollback; review them separately.

## Verification

- **453 automated tests pass**, including HTTP owner authorization, link generation/revocation, signup and verification continuation, wrong-account/CSRF rejection, acceptance replay and failure handling.
- **10 real MariaDB checks pass**, including concurrent acceptance, transaction rollback, complimentary entitlement in separate sessions, ordinary free-account exclusion, editor permission preservation and subscription protection.
- Build passes **21 HTML pages and 732 local references**.
- Safari native forms generated a fictional invitation and accepted one in an isolated MariaDB fixture; the accepted account displayed no subscription fee/no expiry and opened all 12 California Almanac sections. No production creator account or invitation email was created by these tests.

Reproduce the database checks with `RUN_CREATOR_INVITATIONS_DB_TESTS=true` and `CREATOR_INVITATIONS_DB_SOCKET` pointing to the explicitly isolated `/private/tmp/goldtrails-invitations-db-.../mysql.sock`, then run `node --test tests/creator-invitations-mariadb.integration.mjs`. The fixture refuses production connections.

For Safari browser checks, apply migrations 001, 002, 004 and 014 to that empty isolated database, then run `scripts/preview-creator-invitations.mjs` with the same socket and `RUN_CREATOR_INVITATION_PREVIEW=true`. It listens only on loopback, supplies fictional sessions and cleans its seeded accounts on shutdown. It cannot send email or process payments.

Related: [launch roadmap](launch-roadmap.md) and [outreach drafts](creator-outreach.md).
