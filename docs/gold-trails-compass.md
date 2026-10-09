# Gold Trails Compass

Compass is integrated into the existing buildless Node server, MariaDB member accounts, secure member sessions, published directory, product catalog, static article library, and Gold Trails page shell.

## Deployment

1. Back up the database using Hostinger/phpMyAdmin before applying SQL. Protect the backup: it contains member authentication data and must never be committed to Git.
2. Apply `database/migrations/006_gold_trails_compass.sql` after migration 004. It adds six tables and its schema marker without changing existing member or creator records. MariaDB DDL commits implicitly. If interrupted, inspect the created tables before retrying; do not drop populated tables.
3. Build, test, commit and push the code. Hostinger's existing Git deployment loads `server.js`.
4. A verified member with an existing valid subscriber entitlement can open `/compass/`. Complimentary access requires the existing explicit owner grant; paid access requires a current linked payment subscription. Compass does not grant itself access or change billing status.

No new environment variables are required for the deterministic experience. Existing DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME and remote TLS configuration, plus MEMBER_ORIGIN, remain necessary. Missing migration gives an informative 503; existing pages continue working.

Optional AI-assisted matching requires **all** of:

- `COMPASS_AI_ENABLED=true`
- `OPENAI_API_KEY` (server secret)
- `COMPASS_AI_MODEL` (an explicitly chosen Responses API model supporting structured outputs)
- The member's explicit AI consent in optional preferences.

No default paid model, key, or external service is assumed. AI uses OpenAI Responses with `store:false`, a 15-second timeout and strict JSON IDs. Returned IDs are checked against the current allowed public records; no AI-produced URLs or factual claims are displayed. Questions and profile context are not logged. AI is called only on explicit guide requests, never dashboard loads; at most 10 attempts per account per UTC day with a 10-second cooldown. Failure returns useful deterministic matches without changing saved data. External provider retention is governed by the provider/account settings; `store:false` is not a promise of zero retention.

## Tables

- `compass_profiles`: account-owned JSON answers, optimistic revision, progress, completion timestamp.
- `compass_equipment`: account-owned detailed equipment inventory.
- `compass_activity`: saved/completed/dismissed/known items and more/less preferences.
- `compass_recommendation_cache`: account-owned scored recommendations, fingerprint and six-hour expiration.
- `compass_guide_usage`: rate limit counters; no question text.
- `compass_destinations`: empty vetted access catalog. Only published, unarchived, verified, currently dated access records are considered.

All profile queries use the account ID from the existing validated member session. The browser supplies no trusted account ID or membership tier. Writes check exact Origin, CSRF cookie, and session-bound CSRF hash. Private responses use no-store and noindex. Passwords remain managed by the existing membership system; cookies contain session/CSRF tokens only. There is no localStorage profile copy. Revision conflicts are rejected rather than overwriting another device's saved answers.

Expired members can still export/delete their own Compass data. Active database deletion removes Compass answers, inventory, activity, cache and guide usage only. Existing accounts, roles and subscriptions remain. Historical backups may retain copies until their retention expires.

## Actual content and recommendations

- Five published static Gold Trails articles are registered with stable article IDs, topic/goal metadata and a foundational order. Files must exist before they can be recommended.
- The existing merged public creator roster uses real published database profiles and existing public catalog entries. Draft, archived and sample profiles are excluded. Region reasons describe public coverage, not home addresses, expertise, or access permission. Catalog profiles with incomplete topic research are labeled honestly.
- Published source-checked/creator-confirmed database resources with safe URLs enter the guide/resource sections. Unverified video timestamps and indexed transcripts are not fabricated.
- The supplied 57-product catalog provides real product IDs and detail anchors. Core equipment is prioritized. Owned categories (including detailed inventory) are suppressed; powered equipment needs an explicit relevant interest and adequate experience. Accessories requiring unknown compatibility are excluded. Currency is not inferred from a dollar sign. Budgets exclude over-budget records only where matching currency and numeric price are established. Unconfirmed prices/currency are visibly labeled.
- No legal destinations are seeded. Creator maps remain labeled coverage maps. Postal code, mileage, camping and overnight preferences persist for future vetted geographic matching, but distances/geocoding are not implemented.

Weighted recommendation scores use interests, goal, region, learning format, experience, favorite creators and feedback topic overlap. Completed, already-known and dismissed material is suppressed. Reset clears recommendation tuning/dismissals, preserving saved and completed activity. Six-hour private caches are invalidated by answer/inventory/activity changes, explicit refresh, or the public content fingerprint. Public metadata caches last five minutes. No paid AI call happens on page load.

## Operational UI

`/compass/` provides a free feature preview or subscriber dashboard/onboarding redirect. Seven skippable core steps save partial progress with Save & continue/Save & pause; an eighth optional preferences step is individually editable. The dashboard shows a persona, an actual article-based adventure, learning sequence, creator matches, equipment, honest location empty state, passport and grounded guide.

Passport tracks saved content, completed lessons, detailed inventory and knowledge checks. First Steps uses the onboarding completion timestamp; Stream Reader uses actual article completion; Black Sand Student requires completed reading plus a correct answer; Gear Inventory records a confirmed inventory review; Trail Explorer needs a genuinely saved vetted destination. A stamp records site activity, not proof of real-world skill. The shareable SVG contains earned stamps and lesson count only; display name is added only after explicit checkbox consent. No private geographic/discovery/equipment fields are exported on that image.

## Limits and follow-up work

Payment checkout/webhooks were absent in the inspected system and are not implemented by this feature. Signup creates free accounts; verified paid-member onboarding can only be exercised in production once billing or an authorized complimentary entitlement exists. Member identity uses email sign-in, not the independent environmental administrator login.

The optional guide is AI-assisted **resource selection**, not an unrestricted generative factual advisor. Deterministic matching remains useful without credentials. Full narrated AI adventures, embeddings, transcript ingestion, verified timestamp matching, advanced technical learning paths, reliable nearby destination distances and actual payment-provider onboarding remain future work requiring data/integration. Advanced preferences are retained; fields lacking usable catalog metadata are not falsely represented as influencing scores.

## Verification

`node --test tests/*.test.js` covers existing functionality plus Compass HTTP account isolation, persisted requests, returning-member behavior, premium/CSRF/origin enforcement, differing recommendations, owned-equipment suppression, budget honesty, validated IDs, caching, passport privacy, real activity stamps, AI failure/consent, bounded answers and transaction rollback/scoped SQL. HTTP fixtures use an isolated test store, not live paid accounts. SQL migration/application and live paid-member sign-in must be reported separately; passing fixture tests is not proof of production billing or cross-device browser login.

## Session deployment verification — October 9, 2026

Migration 006 was applied successfully to the Hostinger MariaDB database after a full SQL export (94,470 bytes, in the user's Downloads; filesystem permissions restricted to the owner). All six CREATE TABLE statements and the schema marker succeeded. A separate transaction used disabled, unverified synthetic accounts to exercise profile insert/update, two-account isolation, inventory/activity/cache inserts, and guide-limit SQL. All four result checks returned 1, including cleanup after ROLLBACK. No test accounts, sessions, roles, or membership grants were retained. Auto-increment account-number gaps from rolled-back inserts are normal.

At inspection time the production member account table contained zero accounts. A genuine paid-account signup/sign-in across devices has therefore not been verified. Responsive visual checks used an isolated local example profile at desktop, 390×844 phone, and 820×1180 tablet dimensions; neither mobile check showed horizontal overflow. Checkbox exclusivity was exercised in the browser. This is viewport testing, not physical iPhone/iPad hardware testing.
