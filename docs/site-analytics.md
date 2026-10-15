# Gold Trails traffic and resource-click reporting
Date: 2026-10-15

## Status
Implemented and browser-verified locally. Isolated production release prepared separately. Hostinger database activation and live publication are pending because the existing Safari Hostinger session is signed out. A request to sign in is pending; do not infer approval from elapsed time. Hostinger was rechecked after Paul asked to continue; sign-in and saved-password autofill remain unavailable. No live migration has been applied and no historical traffic has been invented. Tipping and membership pricing remain unchanged.

## Owner report
Open /admin/analytics/ after the existing owner sign-in. The administration menu includes Traffic & clicks. Report and CSV routes use the existing owner session and no-store policy; ordinary member sessions grant no access. Reports are read-only and work without client JavaScript.

- Measured visitors: distinct random browser identifiers within the selected period, after explicit opt-in. Counts are browser estimates, not identified people or the entire audience.
- Visits: tab-scoped session identifiers refreshed after 30 minutes without a measured page load or external click. Multiple tabs/devices can count separately.
- Public page views and outbound clicks, daily activity, popular pages, external destinations, referring domains, and screen-size groups.
- Percentage of measured visits containing an outbound click uses only sessions with a pageview in the same selected period. Clicks per 100 pageviews is a separate count ratio and may exceed 100.
- Previously measured visitors means activity before the selected period in the retained window; it is not a lifetime return or cohort-retention measure.
- Known catalog YouTube video titles and creator names supplement the retained canonical destination URL. Timestamped YouTube destinations remain distinguishable. Unknown destinations retain domain/path labels.
- 7-, 30-, 90-day presets and inclusive custom UTC date windows within retention; CSV export follows the same range. Popular-page/destination reports are capped at 100 rows and referral sources at 50, with caps explained. Summary totals include all eligible events.

No watched-video, article-completion, purchase, signup-attribution, revenue, accurate-person, or willingness-to-pay claim is inferred from a click. Registration counts stay in the existing account reporting. No engagement collection is added to private member pages or questionnaires.

## Collection and visitor choice
Public successful HTML responses receive content-versioned first-party JS/CSS only while the analytics migration is ready. Collection starts after Allow statistics; No thanks preserves access. A Usage preferences button reopens choices. Withdrawal removes local identifiers and stops future events; a storage event carries withdrawal to other tabs. Browser storage failure disables measurement. Existing GPC/DNT signals disable measurement. Owner-cookie browsing, obvious crawler/headless user agents, private/auth/calendar/Compass/prototype paths, errors and non-HTML assets are excluded. An expired preference prompts again after 90 days.

The browser stores a random visitor code for up to 90 days and a tab-scoped visit code. The server hashes both, with no account association. Events contain only an event UUID, hashed codes, event type, validated public path, stripped external URL, referring domain, broad screen-size class and server timestamp. No IP addresses, raw user agents, account IDs/emails/names, free-text answers, search text or private calendar descriptions are added to this analytics dataset. Pseudonymous does not mean completely anonymous.

URL query data is removed except validated YouTube video identifiers and timestamps; fragments and link credentials are excluded. POST payloads reject unexpected keys, missing affirmative consent, protected paths and unsafe URLs. Same-origin checks, JSON/content-size limits, a process-level intake limit, a per-browser rolling-day limit and event-ID uniqueness constrain abuse and duplicates. Browser-origin and client consent assertions do not authenticate a genuine human; these measurements must not be used as a financial ledger.

Data stays in the existing Gold Trails database. Raw usage events are retained for the last 90 UTC calendar dates. Indexed cleanup runs at most hourly per server process when recording/reporting is used; an idle installation can retain older rows until analytics next runs. No background scheduler or third-party analytics service is introduced. Public explanation: /privacy/usage/. Hosting logs are separate.

## Files
- app/analytics/model.js: validation, query scrubbing, UTC ranges and reference aggregation for local fixtures.
- app/analytics/store.js: migration readiness, inserts, deduplication, retention and SQL aggregate reports.
- app/analytics/handler.js: bounded intake, public privacy explanation, and HTML-only asset injection.
- app/analytics/views.js and labels.js: owner report, charts, safe catalog labels, escaped tables and formula-safe CSV.
- dist/site-analytics.js and .css: consent, preferences, event dispatch and report styling.
- database/migrations/010_site_analytics.sql: one additive table and migration marker. Application startup never changes schema.
- app/admin.js, app/server.js, server.js: owner/report and request-handler integration.

## Safe rollout
1. Finish source/release review and verify the production checkout remains clean. The isolated release excludes unpublished dashboard, community, film/music/joke and product-demo changes.
2. Sign in to Hostinger in the existing Safari tab. Export a fresh complete private database backup before DDL. Keep the backup outside Git and the public document root.
3. Inspect schema_migrations and confirm site_usage_events does not contain existing data from a partial or earlier installation. Apply migration 010 once in the correct existing database. DDL auto-commits: inspect a partial failure before retrying; never drop existing tables as recovery.
4. Verify table columns, indexes and the migration marker. Exercise a controlled transaction/rollback against the new table and real aggregate queries. Do not mix fictional preview data into the live table.
5. Publish the isolated release through the established GitHub Desktop → Hostinger workflow. No new dependencies, paid provider, credentials or environment variables are required. Existing MEMBER_ORIGIN/ADMIN_ORIGIN must match the live origin.
6. Verify public pages, owner-only report/export authorization, the real privacy/consent flow and collection. Distinguish controlled QA events from actual audience data; document them instead of presenting them as traffic.
7. Record deployed commit and verification here. Counts begin at activation; previous visit counts cannot be reconstructed from this feature.

If migration is absent, the report explicitly shows not connected (HTTP 503), no zero-valued traffic is fabricated, and public pages receive no collection script. If rollback is required, revert code to stop collection and preserve the table for reviewed recovery rather than deleting it.

## Verification completed locally
- Full feature workspace: 233 tests passed; build checks 17 HTML pages and 549 local links/assets.
- New tests: 14 across analytics.test.js and analytics-client.test.js cover ingestion, actual request paths, protected pages/owner auth, date limits, cross-site and oversize rejection, duplication, query scrubbing, safe CSV/HTML, consent/withdrawal/GPC/DNT, failed browser storage and cross-tab withdrawal.
- Browser test: allowing measurement on the real article in the local fixture added one visitor, visit and pageview; following its USGS source link added one outbound destination click. Declining and reloading produced no additional events. The report period controls and readings were verified.
- Isolated production release: 207 tests passed; build checks 13 HTML pages and 354 local references.
- Phone report at 390 × 844 has document width 390 with no horizontal page overflow after a grid-sizing correction. Wide tables scroll within their containers.
- Preview uses clearly labeled synthetic events and simulated owner authorization only on a loopback server. scripts/preview-analytics.mjs is not the deployment entry point. Its sample totals are not production evidence.
- Real MariaDB execution and live collection remain separate pending checks; SQL behavior was tested through bounded-value fixtures, not a local MariaDB engine.

## Local preview
Run the bundled Node 22 executable with scripts/preview-analytics.mjs; default port 4323, bound only to 127.0.0.1. The preview report is http://127.0.0.1:4323/admin/analytics/. Restart after server-module changes. Production uses server.js with actual owner authentication and MariaDB.

## References checked
MDN sendBeacon describes asynchronous outbound analytics delivery and its limits: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
MDN Global Privacy Control: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl
