# Existing-account recovery guidance

October 15, 2026.

## Diagnosis
A read-only lookup of the two user-confirmed email addresses found both website accounts active and verified. The Mac.com account was created October 10; the Gold Trails domain account was created October 15. No password hashes, raw tokens or session values were selected.

Submitting signup with an existing email does not create another account or replace its password. Resending verification to an already verified account intentionally sends no message. This explains the missing repeat verification; it does not establish an email-provider delivery failure. Hostinger dashboard, Hostinger mailbox and Gold Trails website credentials are separate.

## Change
Signup confirmation now provides sign-in and existing-account password recovery alongside verification resend. Resend confirmation explains that verified accounts do not get another verification email. Responses stay identical for missing and existing accounts; no anonymous account-status disclosure was added. The client asset version was advanced. No credentials, memberships, mail settings or domain settings were changed.

## Validation
254 development tests and 228 isolated-release tests passed. Both builds passed (17 development pages / 549 links and assets; 13 release pages / 354 links and assets). New checks cover identical fresh/duplicate signup responses, identical missing/verified resend responses, absence of duplicate mail, and client recovery links.

## User acceptance pending
A website password-reset request for the verified Gold Trails domain account was accepted by the live recovery page. That generic confirmation does not prove email delivery. The user must open the newest reset email, enter/submit/save the new credential, and test website sign-in. Mailbox access may require a separate Hostinger mailbox password reset. Do not create additional website accounts or bypass verification.

Official Hostinger mailbox reset instructions: https://www.hostinger.com/support/1583468-how-to-reset-a-hostinger-email-mailbox-password/
