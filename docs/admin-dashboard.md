# Gold Trails administration

Open `/admin/` and sign in using the existing administrator username and password. Member sign-in remains separate.

- Creators & profiles: existing creator editor and roster import.
- Products: search/sort the 57-product catalog and edit approved names, brands, models, descriptions, official/purchase links, and availability. A private reason is required; a supporting public URL is optional. Existing specifications, price research, and creator evidence remain intact.
- Product corrections: reports submitted from each public product row; review New, Reviewing, Resolved, or Dismissed records. Contact details stay private. Marking a report resolved never publishes its suggestion. Open the linked product editor, make a reviewed change, and save separately.
- Member accounts: searchable, read-only account and profile records. This view does not edit membership, grant access, or expose password hashes/session tokens.

## Database

Migration `007_admin_products_reports.sql` adds `product_overrides`, `product_change_log`, `product_reports`, and `product_report_events`. Back up first; MariaDB DDL commits implicitly. Apply once and inspect partial failures rather than blindly rerunning.

Applied to the existing Hostinger database on October 10, 2026 after exporting a private 47-table SQL backup. Verified the migration marker, preserved member count, and insert/update/audit transactions followed by rollback. All four new tables had zero rows after the transaction-only checks.

No new environment variables or email provider configuration are needed. Uses existing database and administrator/member session settings. Public corrections accept optional contact details, use CSRF and same-origin checks, cookie/global rate limits, size limits, duplicate-submit protection, and escaped output. Business names are self-reported; no manufacturer ownership or complimentary membership is granted by a report.

Approved overrides persist in MariaDB across redeploys and appear on public Products immediately. Compass reads these catalog records through its existing content cache (up to five minutes); discontinued and unavailable products are suppressed from new recommendations.

## Limits

This version edits existing products only; adding new catalog entries, images, richer specification/price editors, member editing, billing administration, and manufacturer ownership approval remain future work. Reports and edit history are preserved. No email is sent when a report is submitted.

## Verification

Automated HTTP and transaction tests cover the report-to-review-to-catalog path, administrator authorization, Origin/CSRF rejection, private field handling, escaping, unsafe links, rate limiting, idempotent submissions, revision conflicts, and missing-migration states. Browser checks cover form submission and publication in an isolated memory fixture, plus phone/tablet layouts.
