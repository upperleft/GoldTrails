# Reader suggestions — 2026-10-15

The misleading “Help improve Gold Trails?” statistics invitation is removed. Statistics no longer open automatically; the footer offers Visitor statistics for an explicit choice. New browsers remain unmeasured until allowing statistics there; existing choices continue until withdrawal or expiry. This reduces coverage in exchange for a quieter site.

Public pages have a compact, expandable Suggest an improvement text box in the footer. /suggestions/ offers the same form without JavaScript or a login. Messages are private, limited to 5–3,000 characters, and do not request identity or contact information. Only the message, originating clean public path, random submission ID, creation time and review status are saved. No analytics identifiers, account IDs, emails or IP addresses are attached. The form explicitly asks readers to leave out passwords and personal details.

/admin/suggestions/ uses existing owner authentication and CSRF protection. New and Reviewed views show the latest 100 per status. Marking reviewed is reversible. Messages are escaped and shown as plain text, never treated as HTML or instructions; nothing is published automatically.

Signed forms expire after one hour or a process restart; a validation error preserves the escaped message for resubmission. UUID uniqueness prevents duplicate submissions from reloading the success response. Cross-site origins, invalid tokens, duplicate fields, oversized payloads and honeypot submissions are rejected. A process-wide cap of 30 form submissions/minute provides basic protection; it is not a complete anti-spam system. Suggestions are retained for owner review; no automatic deletion is introduced.

Files: app/suggestions.js, dist/suggestions.css, database/migrations/011_reader_suggestions.sql; integration in app/server.js, app/admin.js and server.js. Migration 011 is additive and requires a fresh database backup before application. No new service, credentials, payment or email delivery.

Validation: 19 focused analytics and suggestion checks passed, including real HTTP public submission, owner-only review, reversible status, CSRF rejection, duplicate prevention, escaped errors and unavailable storage. Full suites passed: 212 release tests and 238 development tests. Both builds passed (13 release pages/354 references, 17 development pages/549 references). Live publication/receipt verification pending.

Fresh pre-DDL backup: /Users/paulshoemaker/Downloads/GoldTrails-pre-calendar-2026-10-12.sql-3, downloaded 2026-10-15 16:53 UTC (Safari reused an older filename template), 213371 bytes, 59 tables, SHA-256 73e2ebf2f9e1096dfafae89cca2202071ae69856b722c0749c32536324514fea. Private backup remains outside Git.
