# Gold Connections — implementation and release boundaries

Brief received October 16, 2026. This is an addition to the existing Node 22/MariaDB application, not a new site or membership. The public directory, state groups and public event details are free; create/RSVP/discuss/state-follow actions use the existing effective Plus entitlement. Free members retain cancellation, unsubscribe and privacy controls. The personal calendar remains private and free.

## Infrastructure assessment and plan

Reuse verified member sessions and session-bound CSRF, member_accounts IDs, effective subscription projection (Stripe or isolated Stripe-test adapter), server page shell/styles, Luxon, native calendar and Resend provider. The existing private calendar is not a public-event database. No live Stripe or email service changes are required for development.

Add migration 013: exactly 50 state categories; indexed national events; per-event unique RSVPs/waitlists and attendance; state follows and preferences; event discussions, photos and moderation reports; durable deduplicated notification outbox; audit metadata and write limits. No original tables or research are overwritten. No schema changes run at startup.

Pages: /connections/ national list/calendar and filters; /connections/states/ all groups; /connections/states/:slug/ upcoming/past and Almanac link; /connections/events/:id/ public/Plus detail; create/edit/manage forms; /connections/mine/ dashboard; notification preferences. The shared sidebar adds Gold Connections; Almanac states gain “Let’s Meet Up!” links; homepage shows at most three real upcoming public events.

Phases: (1) database/groups/discovery/CRUD/basic RSVP; (2) border coverage, opt-in follows/preferences, queue and reminders; (3) comments, photos, attendance, bounded recurrence, waitlists and organizer updates; (4) personal-calendar integration and ICS, browser QA and regression tests.

## Approval boundary

Do not deploy, apply production migrations, activate live Stripe, or send real notification emails without Paul’s approval. Test through injected mail stubs and an isolated preview. The notification worker is opt-in and not started automatically. A production database backup, migration review and production acceptance are required before release. No separate event payments/ticketing.

## Implementation notes

- `app/connections/model.js`: bounded text/URL/date validation, UTC instants with original IANA zone, public projections, AES-256-GCM meeting vault. DST gaps/folds are rejected with guidance rather than silently choosing a different time. Weekly/monthly series create up to 24 independent event occurrences with a shared series ID; edits/cancellations affect one occurrence.
- `store.js`: parameterized MariaDB queries; event-row locks serialize RSVP/capacity/waitlist changes; revision checks prevent stale edits; member effective eligibility is checked again before creation, RSVP and discussion writes. Draft and Plus-only content are excluded from public discovery.
- Exactly 50 state groups reuse existing Almanac identities. `adjacency.json` is reproducible from the vendored 2017 Census-derived us-atlas polygons, with source SHA256. Shared arcs give 105 land/river boundaries; point contacts and water-only borders are excluded. Alaska/Hawaii have no edges. `scripts/build-connections-adjacency.mjs` regenerates JSON and SQL seeds without network access. A current full legal-boundary dataset would be needed if water-only neighbors are later requested.
- `/connections/moderation/` uses the existing independent owner session and owner CSRF token. Organizers can moderate their own event discussions; owner moderation can suppress an entire event. Reports are private and do not display member email addresses. Hidden content is retained for review, not permanently purged.
- Photos use pinned Sharp 0.35.5: allowlisted JPEG/PNG/WebP magic bytes; full decoding; 20MP input limit; 1600px output; JPEG re-encoding strips metadata. 5MB upload/1.5MB output; two concurrent decodes; 8-second processing limit; ten stored photos/versions per member/event, 100 per event, 30MB per account and 500MB site total. Hidden photos still count toward storage limits. Storage is in the existing MariaDB backup domain. Future retention/purge requires a reviewed policy; no automatic irreversible deletion.
- Exact address/map can be public or confirmed-attendee-only. Private meeting credentials are only served to the organizer or a currently eligible Plus member with a confirmed RSVP. Waitlisted members do not get them. Calendar exports/copies omit meeting secrets and exact addresses.
- The member dashboard links to `/connections/mine/`, showing upcoming/past events, waitlists and organizing records. Notification preferences show followed states. The private-calendar action creates one idempotent snapshot; it is explicitly not a live subscription. Event changes are found on the event page and in opted-in notifications. ICS downloads use stable UIDs, UTC instants and event revision sequences.

## Notification operation (disabled until separately approved)

Required settings: existing `MEMBER_ORIGIN`, `RESEND_API_KEY`, `MEMBER_MAIL_FROM`; new secret `CONNECTIONS_ENCRYPTION_KEY` (64 hex characters) for online meeting credentials; independent `CONNECTIONS_UNSUBSCRIBE_SECRET` (at least 32 characters) for account-scoped unsubscribe links. Never paste secrets in chat or commit them. Back up the encryption key securely; losing it loses access to saved meeting credentials. Rotation requires re-encryption before replacing the key.

`CONNECTIONS_EMAIL_ENABLED` defaults off. No web request or server startup starts email delivery. After approval/configuration, schedule the same Node runtime to run `node scripts/dispatch-connections.mjs --send` once per minute. A database advisory lock permits one worker at a time; a durable dispatch gate allows at most one message per three seconds, with twenty jobs per run. Followed-state overlap queues one new-event message per account/event. Updates/reminders use event revisions. Preferences and current Plus status are checked again at delivery. All four email categories default off. Account-bound unsubscribe links can turn them all off without signing in; GET displays a confirmation and does not mutate preferences.

Outbox states distinguish pending, sending, sent/provider-accepted, skipped, failed and uncertain. Provider acceptance does not prove inbox delivery. Payload and Resend idempotency key are fixed on first attempt. Retries are bounded; ambiguous jobs older than 23 hours are retained as uncertain for manual reconciliation, never blindly replayed beyond the provider’s 24-hour deduplication window. Outbox payloads contain the recipient and event summary/link, never Zoom secrets. Do not expose this table publicly. Real sender deliverability, provider limits and a controlled email test remain release acceptance work.

## Sources consulted October 16, 2026

- https://github.com/topojson/us-atlas — 2017 Census-derived state cartographic topology.
- https://github.com/topojson/topojson-client — shared-arc neighbor semantics.
- https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html — original boundary data documentation.
- https://resend.com/docs/dashboard/emails/idempotency-keys — 24-hour provider deduplication boundary.
- https://resend.com/docs/api-reference/emails/send-email — sending and idempotency headers.
- https://sharp.pixelplumbing.com/api-constructor/ and https://sharp.pixelplumbing.com/api-output/ — untrusted image limits and metadata removal.

## Database acceptance command (not yet run)

This computer currently has no MariaDB server or Docker command available. SQL-contract tests use controlled query adapters and are not a substitute for executing the migration and concurrency test on MariaDB. A separate `gold_connections_test` database must be prepared with the existing foundation/member/calendar schema and migration 013. Never use production credentials or the production database name. With only that isolated database configured, run:

```
RUN_CONNECTIONS_DB_TESTS=true node --test tests/connections-mariadb.integration.mjs
```

The test refuses any other database name and requires an empty member database. It creates only fictional `.invalid` members and test subscription records; no Stripe API calls or email sends occur. It checks SQL execution, a concurrent last-seat race, waitlist promotion, overlapping-state email deduplication, ciphertext storage and paid eligibility. Cleanup is scoped to the newly created fixture IDs. Before production: run this acceptance test, review migration/backup/restore, validate real test-mode subscription and email round trips, provision encryption/unsubscribe secrets, then obtain separate release approval. The current Stripe implementation is still sandbox-only; deployment alone must not activate real charging.

Privacy integration: all `/connections/` paths are excluded from the optional usage collector on both client and server. This prevents attendee-only meeting links, event management activity and unsubscribe flows from becoming outbound-click records. A future public-event analytics design must explicitly separate public summaries from private meeting destinations before enabling collection here.

## Local verification — October 16, 2026

- Complete development regression suite: **317 passed, zero failed**. Dedicated Connections tests cover validation, 50 states/borders, DST and recurrence, encryption/public projections, SQL transaction/rollback and owner scope, account/Plus/CSRF/Origin boundaries, waitlists, comments, owner reports, image decoding and binary HTTP upload, preferences, ICS/copies, homepage selection and calendar filtering.
- Analytics exclusion change additionally passed all 15 analytics/server/client privacy checks. No actual provider send was made: notification tests inject a transport stub.
- Existing build: 17 HTML pages and 566 local links/assets pass. The CommonJS deployment compatibility check is recorded separately at final save.
- Browser: public discovery, Plus RSVP → private meeting visibility, organizer draft creation, changing geographic notification range, state groups and month grid. 390px phone, 820px tablet and normal desktop have no horizontal overflow on the checked directory, form and calendar views. No browser console errors. Tests use clearly labeled fictional local data only.
- Preview: `node scripts/preview-connections.mjs` at `http://127.0.0.1:4329/connections/`. A visible “LOCAL TEST” banner and test-role form distinguish this from production. The fixture store is process memory and resets on restart. The production entry instead uses `createConnectionsStore` and MariaDB. The preview’s private-calendar copy tests do not provide a complete personal calendar UI; production uses the existing calendar tables.
- Saved screenshot: `outputs/Gold-Connections-Local-Preview-2026-10-16.png` in the parent task workspace.
- **Not yet verified:** execution of migration 013 and concurrent queries on MariaDB; a real Stripe sandbox subscription → Connections entitlement round trip; controlled provider email/deliverability, configured encryption-key recovery, and production deployment. No production migration, deployment, Stripe modification or real notification was performed.
- Optional event map view is not implemented. List and month-calendar views are implemented. External calendar delivery is an ICS download or explicit private-calendar snapshot, not an automatic external sync.

## Immediate continuation

The next required dependency is a separate empty MariaDB test database. An asynchronous question asked Paul whether one already exists. Use only an isolated `gold_connections_test` database for the opt-in acceptance test. Keep live Hostinger unchanged until the migration/permissions/notification acceptance is complete and release approval is given. Preserve the existing deployment checkout and isolated Stripe preparation; never push the whole development branch without release review.

Final save: Node 22 CommonJS-to-ESM loading passed for the handler and photo processor. The final complete suite passed **317/317** after privacy and outage handling changes. The last cover-credit rendering refinement passed all 22 relevant model/store/HTTP checks. Event cover captions/credits are retained in public rendering even though image metadata is stripped. Production remains unchanged.
