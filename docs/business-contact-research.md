# Researched alternate business contacts

Research is private administrator reference data, separate from member_accounts.email and public_contacts. Nothing here verifies an account, connects a member to a creator, grants complimentary membership, sends an invitation, or changes existing public biographies.

Migration 008_business_contact_research adds one table containing immutable evidence snapshots. Each snapshot retains all gathered background, aliases, public business contacts, contact purposes, source URLs, social links, research confidence and freshness notes, original source observations, and typed product/manufacturer catalog references. Published-on-official-source means publication was observed; it does not establish delivery, current ownership or permission for bulk email. Historical/third-party addresses keep their original qualifications. Purpose-restricted shipping/order/privacy routes must not be treated as general contact permission.

The reviewed batch contains 23 existing catalog entities: nine creators and fifteen manufacturers, with Klesh counted in both. GPAA and AMRA remain in the separate research library because they are new candidates. Creator connections resolve actual live people.id by exact slug; missing or archived people are reported and not created. A manufacturer match can still retain research without a live person row. Product and manufacturer IDs refer to the existing file-backed product catalog; there is no manufacturer account table to invent IDs for.

Before applying the additive SQL, export a full database backup. MariaDB DDL commits implicitly. Apply database/migrations/008_business_contact_research.sql, then explicitly import the reviewed batch. This does not run on startup or during deployment.

With configured private DB_* settings:

    CONTACT_IMPORT_CONFIRMED=true node scripts/import-business-contacts.mjs

For the existing phpMyAdmin session, generate parameter-safe UTF-8 hexadecimal SQL:

    node scripts/export-business-contact-sql.mjs /private/tmp/gold-trails-business-contacts.sql

The SQL resolves people in the live database and inserts only matched creators or existing catalog manufacturers. Replaying the same batch preserves snapshots; future changed evidence produces a new version. It may fill an initially missing person_id, but never replaces an existing person connection or an account email. Keep the SQL file and database backups private and outside Git. The creator-domain backup now includes this table if migration 008 exists.

After deployment, /admin/contacts/ provides searchable research cards. Relevant creator editors and product editors also show attached research in compact expandable sections. All routes inherit administrator authentication, same-origin/CSRF checks for POSTs, no-store responses and escaped rendering. Contact research itself is read-only. Original external sources open in a new tab.

Validation covers 23-record source/catalog matching, preservation of tentative email status, repeated import, missing creators, rollback, escaping, admin-only access, search and encoded SQL. Full existing website tests also run. Production counts and deployment results are recorded separately after execution.

## Live import — 10 October 2026

Full pre-import backup: /Users/paulshoemaker/Downloads/u474324596_goldtrails.sql-6 (109,017 bytes, mode 0600). Migration 008 applied through the existing Hostinger phpMyAdmin session. The reviewed import committed 21 snapshots: fifteen catalog manufacturers plus six matched live creators. Klesh manufacturer research is retained, but its creator is not in live people. Chris Ralph and Adventure Gold were not created or imported as people; their source records remain in the reviewed input and local research library. No member/account email, public profile or existing contact was updated.
