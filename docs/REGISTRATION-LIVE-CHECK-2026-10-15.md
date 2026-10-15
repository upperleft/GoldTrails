# Live registration and membership checks
October 15, 2026. Current application origin remains the Hostinger temporary domain. GoldTrails.org cutover is deferred under the coordinated-domain plan.

## Completed
- Public signup and password-recovery forms are enabled on the deployed application.
- Hostinger environment configuration includes MEMBER_SIGNUP_ENABLED, RESEND_API_KEY and MEMBER_MAIL_FROM. Secret values were not copied or changed.
- The sender address visible in Paul's supplied screenshot is noreply@goldtrails.safereportsma.com. The new Hostinger mailbox is the receiving inbox, not an automatic replacement for outbound Resend delivery. Sender configuration was left unchanged.
- Paul created the free test account and confirmed its email verification. Safari displayed “Your email is verified” and “Your free Gold Trails account is ready. Welcome to the camp!” This confirms the real signup → email → confirmation path, beyond the local mocks.
- The initially reported missing message was resolved by checking the intended receiving inbox rather than the unrelated Mac.com inbox. No mail-service replacement or account recreation was needed.
- 34 automated registration, form-feedback, recovery, Plus-access and unified-map checks passed. Tests used temporary local HTTP servers; no production payment or membership grants were made.

## In progress / not yet verified live
- Member sign-in: the email field is prepared in Safari; Paul must enter the password privately and submit. Never request the password in chat or copy it into development files.
- Account overview and effective Free membership.
- Calendar and personal dashboard access for the verified account.
- Almanac restriction for that Free account while creator profiles/videos remain public.
- Password-recovery email and a user-performed password update, then sign-in/sign-out and session revocation. Password entry/change must remain with Paul.
- Real subscription checkout, cancellation, failed-payment handling, provider webhooks and billing reconciliation remain unimplemented and untested. Existing payment routes remain disabled. No live payment activation is authorized by this test.

## Handling notes
The MEMBER_MAIL_FROM editor was opened for inspection and inadvertently left visible; Paul was told to cancel it. No Update/Delete confirmation was submitted, and no environment setting was changed during diagnosis. Do not expose verification/reset tokens, password hashes, raw session cookies or provider keys in reports/screenshots. Keep the current application origin until the coordinated domain change is performed; update both server origin settings together at that time.
