# Member email identity and password autofill
October 15, 2026.

A real verified signup exposed a credential-selection problem: Safari offered the administrator credential when Paul tried to sign into his new member account. Member sign-in uses email, while signup marked the separately chosen username as autocomplete="username" and email as autocomplete="email". The administrator and member forms also share the same temporary hostname. The incorrect field identity can contribute to confusing saved-account selection; the actual contents of Apple's password store were not inspected.

## Changes
- Signup and login both identify the email credential with type="email" and autocomplete="username", per Apple's documented recommendation. Email fields disable autocapitalization and spellcheck.
- The separate username and optional display name use nickname hints. Signup places email immediately before the password guidance/password field, with other name fields earlier.
- Existing new-password/current-password hints and password rules remain in place. Login copy explicitly asks for the email used to join.
- A valid, unused, unexpired reset token can identify its own active verified account through a read-only database query. The reset form shows that email as a read-only username field alongside the new-password field. The query does not consume the token, return a password/session, or use an email supplied in the URL.
- Reset POST still identifies the account only by its token and rechecks the token under lock. A submitted email cannot redirect the password change. Old/used/invalid links return the expiry page without showing an account email or password form.
- No database migration, password reset, new account, session grant, mail-setting update or saved-password edit is part of this code change. Existing verified accounts and credentials are preserved.

Existing saved credentials are not repaired retroactively. Paul can choose the existing member entry in Apple's Passwords app or use the existing-account password recovery flow. Do not request passwords in chat or overwrite/delete the administrator's saved credential. User password creation/changes remain user-operated.

## Verification
225 release tests and 251 development tests passed, including three new checks covering consistent autofill identity, reset form account ownership/non-consumption, and the guarded reset lookup. Both builds passed. Tests of reset identity used controlled local fixtures; an actual user-performed recovery remains part of live acceptance testing.

Sources:
- https://developer.apple.com/documentation/security/enabling-password-autofill-on-an-html-input-element
- https://support.apple.com/en-ca/guide/passwords/mchl9e425295/mac

Published release `fea8abb` to the existing Hostinger application on October 15. Live checks confirmed email autocomplete="username" on signup and login, nickname on the separate signup username, and HTTP 400/no password form for an invalid reset token against the actual database. Creator profile/video routes remain public, and state research JSON remains restricted. A fresh browser rendered the explicit email-sign-in instruction and corrected email field. No user password was read, reset or changed; sign-in and a possible user-performed recovery remain pending.
