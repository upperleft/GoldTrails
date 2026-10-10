# Member account foundation

Migration 004 creates ten private tables; only four role definitions are seeded. No user accounts, credentials, subscriptions, invitations or privileges are created. Existing owner login and public creator profiles remain independent.

Signup must create the account, optional profile, free membership and member role in one transaction. UUID is the permanent internal ID; auto-increment account_number displays as GT-000001 (minimum six digits, never truncated). Account numbers are identifiers, never authentication secrets. Username uses case-insensitive ASCII uniqueness; validate 3–40 characters of letters, digits, underscores and hyphens. Store canonical email trimmed and lowercased consistently, without provider-specific dot/plus rewriting. Require verified email before account activation. Reserve administrative and route names in the application.

Store password hashes only; reuse the existing asynchronous salted scrypt implementation. Enforce server-side password validation and login/signup/recovery rate limits. Store SHA-256 digests of cryptographically random session and one-use email/reset/invitation tokens. Sessions use Secure, HttpOnly, SameSite cookies, CSRF checks, expiry and account auth_version. Password resets and account suspension revoke sessions. Reset requests return identical outward responses for known/unknown addresses. Consume tokens atomically and do not log raw tokens or passwords.

Membership, roles and creator editing are independent. Effective subscriber access requires active account, active membership, valid dates and either verified provider subscription belonging to that account or an audited administrator complimentary grant. Never trust client-submitted level or roles. The application must check subscription ownership and signed payment webhooks; a database record alone does not prove payment. Keep provider IDs/status only, never card data. Cancellation does not automatically remove access before the verified paid-through date. Expiry falls back to free access unless the account is suspended.

Public creator connections default requested. Approval requires an identified administrator reviewer and timestamp. Requests and invitations never confer admin/subscriber access automatically. A creator can have several approved editors and an account can manage several creator profiles. Do not publish account emails or private member profiles in the directory.

The owner credential currently lives in environment configuration. Do not switch existing owner authentication during this migration. A later controlled owner-account setup will allow audited member-role grants and creator approvals. No temporary passwords are created for creators.

Member signup/login, account overview, email verification, resend verification and password recovery are now implemented. Subscriber checkout, creator claims and member profile editing remain future steps. These tables alone do not enable public registration. Back up the database before applying migration 004; MariaDB DDL commits implicitly. Stop and inspect partial results on failure; never blindly rerun or drop tables.

Applied 5 October 2026 on Hostinger MariaDB after full backup u474324596_goldtrails.sql-3 (64,676 bytes). Verified 10 member tables, 0 accounts, 4 role definitions, 3 creator profiles preserved and migration marker present. Membership defaults verified free / active / free. Database now contains 41 base tables.


## Member service configuration

The routes `/signup/`, `/login/`, `/account/`, `/forgot-password/`, `/reset-password/`, `/verify-email/` and `/resend-verification/` share the Gold Trails navigation and compact forms. Owner access remains at `/admin/login/`. Account numbers display as GT-000028, for example.

Hostinger environment variables:
- `MEMBER_ORIGIN`: exact HTTPS site origin, without a trailing slash. Defaults to `ADMIN_ORIGIN`; update both when the domain changes.
- `RESEND_API_KEY`: private email-provider API key, entered directly into Hostinger environment settings. Never commit it.
- `MEMBER_MAIL_FROM`: sender address authorized by Resend. The sending domain needs verification with the provider.
- `MEMBER_SIGNUP_ENABLED`: defaults to closed; use `true` only after sender configuration and delivery testing. Missing email configuration keeps registration closed even when this flag is enabled.

Deployment alone does not open registration. Signup creates a pending account with free membership; the email link requires an explicit confirmation POST before activation. Reset links expire in 30 minutes, verification links in 24 hours, and sessions in 8 hours. A successful reset invalidates existing sessions. Link GET requests do not consume tokens, so email scanners cannot activate accounts or reset passwords.

Current rate limits use global per-action database buckets for the small initial launch: signup 10, login 30, recovery 10, token confirmation 30 per 15-minute window. Before a larger public launch, add gateway limits and privacy-conscious per-client throttling without trusting arbitrary forwarded IP headers. No production member accounts or email deliveries were created during development. Automated tests use local HTTP fixtures and a simulated database; actual MariaDB signup and email round trips must be checked after email setup.

Next deployment validation: leave signup closed, confirm pages and owner login, configure email, then perform a controlled verification/sign-in/reset/sign-out round trip. Payment activation requires a future verified payment integration; no account form can assign paid access or elevated roles.

Member passwords accept 8–128 characters on signup and reset. These forms use one new-password input with Apple-compatible password rules and an optional show/hide control; they do not require copying a generated password into a confirmation field. The server still rejects mismatched confirmation when an older form submits that field. Member hashing uses the existing salted scrypt implementation with an explicit eight-character minimum; the administrator setup retains its existing 15-character minimum. Existing hashes remain valid.

Signup uses a same-origin form-encoded fetch with JSON feedback when JavaScript is available, avoiding a full-page navigation during submission. The exact Origin and CSRF checks are unchanged; native form POST remains supported. Responses and passwords are not placed in browser storage. Success appears inline only after a successful server response. Requests abort after 30 seconds, restore the button on failure, and offer verification recovery because a lost response does not prove that account creation failed. A browser/API request failure is distinct from an email provider rejection; delivery still needs a genuine inbox verification.
