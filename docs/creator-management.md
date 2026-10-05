# Gold Trails creator workspace

Routes: /admin/login/ and /admin/creators/. This phase supports one site-owner login, configured privately on Hostinger. Public creator roles confer no access. Subscriber accounts, contributor invitations, role delegation, MFA and billing remain separate future work.

Features: creator list, add/edit profile, existing channels plus one additional channel per save, channel draft visibility, primary region from existing vocabulary, biography sources, profile drafts and publishing, archive and restore as draft. Existing roles, topics, aliases, format associations, contacts and source references remain attached; editors for those relations are later work. At most 500 profiles and 30 existing channels per profile can be managed in this initial UI.

Saving edited profiles/channels resets their source-check label to pending. Added source evidence is explicitly for the biography; it does not certify all facts. No images are copied. Unknown inputs stay NULL. Archiving preserves records. An edit_version prevents stale saves; a database transaction covers changes, source references and audit entry. Audit records who performed create/save/archive/restore; it is not a full before/after version history. Changed slugs change public URLs without automatic redirects.

Security: salted scrypt password hashes (N=131072,r=8,p=1), 32-byte random sessions hashed in MariaDB, eight-hour absolute expiry, 15-minute anonymous form expiry, rotated sessions after login, Secure/HttpOnly/SameSite=Strict cookies, same-origin validation and CSRF tokens on every POST, no-store admin pages, CSP and framing protection, bounded form input, parameterized SQL, shared database limit of ten password attempts per 15 minutes. Password-hash rotation invalidates all prior sessions through credential-bound session digests. No public registration or password reset route. The shared login limit can temporarily deny the owner access under an attack; Hostinger edge rate limits are recommended as the site grows.

## Database status

002_creator_management applied 5 October 2026 after exporting the complete populated database through phpMyAdmin. Backup: /Users/paulshoemaker/Downloads/u474324596_goldtrails.sql (44,323 bytes). Do not commit database backups, especially after sessions are in use. Migration marker and Pioneer Pauly row were checked. Adds admin_sessions, admin_login_limits, creator_change_log and people.edit_version. No administrator credential or session was seeded. Do not rerun this migration.

## Private activation after code deployment

Keep the existing DB_* settings. Add these Hostinger environment variables:

- ADMIN_USERNAME: a username chosen by the owner.
- ADMIN_ORIGIN: https://lightcoral-hedgehog-977933.hostingersite.com (no trailing slash).
- ADMIN_PASSWORD_HASH: generated privately by the owner with the interactive helper below. Never use the database password or paste the password into chat/Git.

Run in your own Terminal (Node 22 required):

    node /Users/paulshoemaker/Desktop/GoldTrails/scripts/admin-password.mjs

The helper hides password input. Enter a unique 15–128 character password, then Return. Copy only the generated scrypt hash to Hostinger ADMIN_PASSWORD_HASH and Apply changes. The hash is a credential verifier and must also remain private. No access is enabled until all three settings are present. The browser/computer-use credential policy requires the owner to perform password creation and submission.

The helper does not store or transmit the password. To rotate it, generate a new hash and replace the Hostinger setting. Existing sessions stop matching after redeployment.

## Validation and remaining activation checks

Node 22 tests cover hash verification, invalid config, form validation, anonymous access, forged-origin/CSRF rejection, session rotation/logout, escaped output, transaction rollback, channel ownership, archive audit and draft restoration. Public directory tests and build link checks pass; require()-based Hostinger startup also passes. Administrator database writing and browser sign-in still need a live end-to-end check after owner credentials are configured. No live profile was edited by tests.

References: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html and https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Field-heavy page layout preference

Use compact workspaces for pages with many editable fields: short heading, persistent Home/list links, two columns on wide screens, compact labeled controls and a visible save action. The basic new-creator fields fit together at 1280×720. Long sets of existing channel records can scroll inside their pane; small screens use one readable column. Ordinary public browsing and reading pages retain the full themed header and sidebars. Apply this pattern to future data-entry screens.

## Public roles and content topics

The editor now loads public role checkboxes and content-topic checkboxes from the existing vocabularies. A compact classification pane joins the two main panels on wide screens. Unknown classifications remain unchecked. Role selections describe creators and do not affect administrator access.

Starter topic choices: gold panning, gold sniping, metal detecting, sluicing/highbanking, geology/placer deposits and maps/field research. Missing starter vocabulary rows are inserted only when explicitly selected and saved, inside the profile transaction. Existing/archived slugs are not silently overwritten or recreated. No schema migration is required.

Deselecting a role or content_topic archives that association; selecting it again restores the same record and source reference. Specialized topic relationships (specialty, equipment_discussed, etc.) are preserved. Current form marker is required so a stale pre-classification form cannot accidentally clear associations. Public profile topic links and directory topic filtering already read these associations. Validation includes vocabulary ID allowlisting, transactional rollback and tests for preservation of evidence and specialized relationships.
