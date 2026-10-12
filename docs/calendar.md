# Gold Trails calendar

## Implementation plan

Phase 1 adds a private native calendar to the existing buildless Node 22 server, MariaDB database, and verified member sessions. Calendar ownership always comes from the validated session. Both free and subscriber members may manage their own calendars; membership and billing do not change.

Calendar access is part of the Gold Trails website: use the existing site sign-in, then choose My calendar in the shared navigation, the account page, or the My Gold Trail dashboard. The calendar entry links to `/login/?next=/calendar/`; a successful website sign-in returns there, and an already signed-in member continues without another password prompt. Return destinations are restricted to the three named member pages. The homepage remains public and can be shared without a login.

Components: `app/calendar/model.js` validates calendar/event input, `recurrence.js` expands bounded wall-clock series, `store.js` owns transactions and scoped SQL, `handler.js` enforces session/Origin/CSRF checks, and `views.js` with `dist/calendar.js`/`.css` presents accessible dialogs and four calendar views. FullCalendar 6.1.19, Luxon 3.7.2 and rrule 2.8.1 are pinned; browser libraries are served locally. FullCalendar's maintained version 6 documentation and rrule's official recurrence documentation informed the implementation. Official references: [FullCalendar global builds](https://legacy.fullcalendar.io/v6/initialize-globals), [Luxon](https://moment.github.io/luxon/), and [rrule](https://github.com/jkbrzt/rrule).

Migration `009_native_calendar.sql` adds calendars, events, occurrence exceptions, display preferences, read/write-limit buckets and audit records. Existing member/creator/public-content tables are preserved. Apply after migration 004, with a complete private database backup first. MariaDB DDL commits implicitly; inspect partial failures before retrying. No migration runs during startup or build, and no table is dropped. Account deletion cascades its private calendar data.

Security: owner-scoped SQL, exact-origin checks, session-bound CSRF, bounded JSON input, per-member read/write limits, revision conflicts, transactional writes, escaped/text-rendered content, no private browser storage, and private/no-store/noindex responses. Audit rows identify actions and entities without appointment text. No public event endpoint or private feed exists in Phase 1. A nonce allows FullCalendar's generated stylesheet while script execution stays limited to local assets.

Time model: wall-local starts/ends and original IANA zone accompany indexed UTC instants. All-day dates use an exclusive end date. Series use validated RFC 5545 recurrence rules; expansion is bounded by range and occurrence limits. Individual edits/cancellations retain the original occurrence key. DST and leap-year behavior receive focused tests. Ambiguous starts choose the earliest offset; an ambiguous end uses a later offset only when needed for positive elapsed time. Daily/weekly infinite series jump by whole original recurrence periods. A pool of at most two isolated workers, an eight-request queue and a two-second hard timeout prevent opaque library scans from blocking the HTTP event loop. Cooperative 250 ms per-event and 1.5 s aggregate limits also bound calculation. Owner/revision/range keyed private expansion entries expire after 15 seconds and are limited to 64 entries.

Costs: this phase introduces no paid service, external calendar account, email delivery, or ongoing provider API calls. It uses existing hosting and MariaDB capacity; any added hosting/storage charge depends on the current plan and actual usage.

Milestones:

1. Native private calendars, month/week/day/agenda, personal CRUD, colors/visibility, recurrence, zones, mobile and isolation tests.
2. Verified public events, organizer/destination associations, follows/copies, and a dry-run research importer. The supplied archive actually has 88 destinations and 133 community resources. Its seven lost index dates, mixed state codes, source-catalog gaps, conflicts and pending review flags must be retained and resolved before publication.
3. Optional subscriptions and standards-based ICS import/export/sharing with protected private feeds and SSRF-safe remote fetches.
4. One fully tested provider adapter first (Google), then Microsoft Graph, with encrypted server tokens, least-privilege OAuth, cursors, idempotent jobs, conflict handling and connection status. ICS/Apple subscriptions remain read-only; authenticated CalDAV is evaluated separately.
5. Approved organization editors, submissions, moderation and maintenance.
6. Consent-based notifications, group planning and further providers/performance work.

Provider synchronization remains unavailable in this phase. No credentials or authorization are fabricated. Future connectors should share an adapter contract for capabilities, calendar discovery, bounded incremental changes, conflict-aware writes and revocation, backed by mappings/jobs added through later migrations.

## Validation and deployment

All 176 Node 22 tests pass, including 40 calendar tests. Coverage includes account isolation, authentication/Origin/CSRF, owner spoofing, preferences, revisions, guarded deletion, exceptions and moved instances, DST gaps/folds, leap days, recurrence limits, worker timeout/queue/shutdown and store transactions. Existing 136 tests also pass. Build/static checks cover 13 HTML pages and preserve the 57-product catalog. The existing CommonJS deployment loader starts the ESM server on Node 22 without asynchronous module loading.

Browser QA passed at 1440 × 1000 desktop, 820 × 1180 tablet and 390 × 844 phone sizes: four views, keyboard Enter/Space event activation, create/edit/save, calendar visibility through reload, sidebar collapse and repeated-hour endpoints. No horizontal document overflow or browser console errors appeared. These are browser viewport checks, not a physical iPhone test.

Before migration, a complete private SQL backup of the 52-table production database was downloaded and verified. Migration 009 succeeded on Hostinger MariaDB 11.8.9, with all six new tables and the readiness marker. A live transaction exercised calendar/event/exception/preference/audit/rate-limit inserts and a one-hour DST fold endpoint, then rolled back; the test calendar count was zero afterward. No test appointment was retained in a member account.

Limits: up to 20 private calendars, 10,000 events per account, 1,000 exceptions per series, 93-day view ranges and dates from 2000 through 2100. Recurrence supports the documented DAILY/WEEKLY/MONTHLY/YEARLY RFC 5545 subset; subdaily recurrence and arbitrary ICS rules are not accepted. Search covers the selected date range. Large candidate sets ask the user to narrow the range or hide a calendar; finite-series end indexing/pagination remain future scaling work. There are no public events, subscriptions, sharing, imports/exports, reminders, OAuth providers or background delivery in this phase. No new credentials are needed for the native calendar; future Google/Microsoft adapters require real provider applications, OAuth consent and encrypted token storage.

Release status: source and production browser verification are recorded with the final release handoff.
