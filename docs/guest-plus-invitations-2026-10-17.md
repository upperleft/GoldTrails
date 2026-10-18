# Friends’ Plus preview

Paul requested a public URL to show friends the Plus experience without registering, signing in or entering a password. This implements an intentionally shareable, limited-duration guest pass for reading the real premium pages.

## Access and expiry

- `/plus/guest/?pass=...` exchanges a random 256-bit bearer for a separate `__Host-gold-plus-guest` cookie, then redirects to the clean homepage.
- The current invitation is `friends-2026-10-17`. Its absolute expiry is **November 1, 2026 at 01:19:18 UTC**, which is **October 31 at 9:19 p.m. Eastern**. The invitation remains reusable until that time. Each browser cookie lasts at most 24 hours and never beyond the invitation expiry; reopening the original link renews it within that window.
- Only the SHA-256 token hash, ID, label and expiry are deployed in `app/plus/guest-passes.json`. The raw invitation is saved outside Git in the task workspace’s private directory. Never add the raw URL to source control, public pages, analytics, screenshots, logs or documentation.
- Removing the hash entry, setting `revoked: true`, or replacing the hash and deploying revokes existing guest cookies. Each premium request validates the configured hash and expiry before reading cached content.
- The link can be forwarded by its recipient. It is a friends’ preview invitation, not a permanent free subscription or an administrator/member session.

## What guests can do

- Browse the complete Almanac, all 50 state guides, unified creator map, source links and state clubs/groups.
- Use the creator directory’s Find on map action. Creator profiles and videos remain public to everyone.
- Browse published Plus Connections events, readable discussions/photos and redacted calendar exports.
- Navigate the rest of the existing public site. A welcome strip links directly to the Almanac and Connections and offers Leave preview.

The guest session grants no account identity or writing permission. Creating an event, RSVPing, commenting or uploading still needs a genuine eligible account and the existing CSRF/database checks. Guest access does not open personal calendars, accounts, preferences, attendee lists, drafts, moderated records, organizer tools, private addresses or meeting credentials. Real paid members retaining a guest cookie keep their existing account permissions. No subscription, payment, account or production event is created by an invitation visit.

## Implementation

- `app/plus/guest-access.js`: secure cookie exchange, expiry/revocation, banner and same-origin Leave preview POST.
- `app/plus/entitlements.js`, `app/almanac/handler.js`, `app/server.js`: independent read access for approved features and creator map controls; dispatch invitation before usage collectors.
- `app/connections/{handler,store,views}.js`: explicit read-only Plus visibility, distinct from member identity or participation.
- `dist/guest-plus.css`: responsive welcome strip using the existing colors and type.
- `scripts/preview-guest-plus.mjs`: isolated read-only local preview with a fictional invitation/event; never imported by production.

Token exchange/canonical redirect uses `Referrer-Policy: no-referrer`; clean guest HTML uses `strict-origin` so native form POSTs preserve Origin. Guest HTML is private/no-store, varies by Cookie and has noindex. Cookies are Secure, HttpOnly, host-only, SameSite=Lax. Leaving clears only the guest cookie. No database migration, environment change, new service or live billing activation is needed.

## Verification before publication

- Full Node 22 suite: **330 passed, 0 failed**. Includes 16 new invitation/Connections tests and an additional signup-dialog preservation regression.
- Corrected the old signup test fixture’s missing DOM methods; production signup code unchanged.
- Build: 14 HTML pages and 493 local links/assets passed.
- All 50 state APIs tested closed normally and open for guests, including cache warming, expiry and revocation. Wrong/duplicate invitation values, external redirect attempts, forged member/admin cookies and unauthorized personal API access rejected.
- Connections tests cover guest Plus visibility, photo/ICS access, no private fields, draft/moderated rejection, denied guest/free-account writes and unchanged real paid-member behavior.
- Browser: invitation opens clean homepage with no login; Almanac map starts unselected, keyboard selection opens California and state clubs; Connections shows the fictional Plus event; private details and RSVP forms absent; native Leave preview clears the session and returns home.
- Independent source review found a form-Origin issue with no-referrer on clean HTML. Fixed to strict-origin and verified native Leave preview. No other material access-control issue found.

Security reference: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), reviewed October 17, 2026. Existing member authentication is retained; this limited guest capability does not replace it.

Production deployment and live verification are recorded below once complete.
