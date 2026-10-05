# Member account foundation

Migration 004 creates ten private tables; only four role definitions are seeded. No user accounts, credentials, subscriptions, invitations or privileges are created. Existing owner login and public creator profiles remain independent.

Signup must create the account, optional profile, free membership and member role in one transaction. UUID is the permanent internal ID; auto-increment account_number displays as GT-000001 (minimum six digits, never truncated). Account numbers are identifiers, never authentication secrets. Username uses case-insensitive ASCII uniqueness; validate 3–40 characters of letters, digits, underscores and hyphens. Store canonical email trimmed and lowercased consistently, without provider-specific dot/plus rewriting. Require verified email before account activation. Reserve administrative and route names in the application.

Store password hashes only; reuse the existing asynchronous salted scrypt implementation. Enforce server-side password validation and login/signup/recovery rate limits. Store SHA-256 digests of cryptographically random session and one-use email/reset/invitation tokens. Sessions use Secure, HttpOnly, SameSite cookies, CSRF checks, expiry and account auth_version. Password resets and account suspension revoke sessions. Reset requests return identical outward responses for known/unknown addresses. Consume tokens atomically and do not log raw tokens or passwords.

Membership, roles and creator editing are independent. Effective subscriber access requires active account, active membership, valid dates and either verified provider subscription belonging to that account or an audited administrator complimentary grant. Never trust client-submitted level or roles. The application must check subscription ownership and signed payment webhooks; a database record alone does not prove payment. Keep provider IDs/status only, never card data. Cancellation does not automatically remove access before the verified paid-through date. Expiry falls back to free access unless the account is suspended.

Public creator connections default requested. Approval requires an identified administrator reviewer and timestamp. Requests and invitations never confer admin/subscriber access automatically. A creator can have several approved editors and an account can manage several creator profiles. Do not publish account emails or private member profiles in the directory.

The owner credential currently lives in environment configuration. Do not switch existing owner authentication during this migration. A later controlled owner-account setup will allow audited member-role grants and creator approvals. No temporary passwords are created for creators.

Email delivery, signup/login UI, reset flow and subscription checkout are the next implementation steps. These tables alone do not enable public registration. Back up the database before applying migration 004; MariaDB DDL commits implicitly. Stop and inspect partial results on failure; never blindly rerun or drop tables.

Applied 5 October 2026 on Hostinger MariaDB after full backup u474324596_goldtrails.sql-3 (64,676 bytes). Verified 10 member tables, 0 accounts, 4 role definitions, 3 creator profiles preserved and migration marker present. Membership defaults verified free / active / free. Database now contains 41 base tables.
