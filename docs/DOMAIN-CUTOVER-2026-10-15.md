# GoldTrails.org connection readiness
Checked October 15, 2026. New canonical domain: https://goldtrails.org. Mailbox: paul@goldtrails.org.

## Decision from this session
Paul authorized the connection, then explicitly gave discretion to wait rather than disturb development. Keep the existing preview working for now. No domain binding, DNS, environment value, mailbox, forwarding rule, email provider, or signup setting was changed. The connection warning was reviewed and canceled. A future domain cutover remains authorized; do not infer that DNS propagation itself requires stopping development.

## Verified facts
- Google DNS (8.8.8.8) and Cloudflare DNS (1.1.1.1) both returned A 2.57.91.91. This checks those resolvers, not worldwide propagation.
- Authoritative nameservers: cosmos.dns-parking.com and nova.dns-parking.com.
- Root and www HTTPS requests both passed certificate validation and returned HTTP 200. The root page is Hostinger's parked-domain page, not the Gold Trails application.
- www CNAME points to goldtrails.org.
- MX: priority 5 mx1.hostinger.com; priority 10 mx2.hostinger.com.
- Root SPF: v=spf1 include:_spf.mail.hostinger.com ~all.
- Hostinger Mailboxes shows paul@goldtrails.org Active and the email Connect domain step Completed. Mailbox contents were not opened for this work. No test email was sent. DKIM/DMARC and end-to-end delivery were not independently verified.
- The existing Node.js app still uses lightcoral-hedgehog-977933.hostingersite.com.
- Before proceeding, Hostinger displays a warning headed “Domain name will not change in databases”, and says the old temporary domain will no longer work. Do not promise continued temporary-domain availability through this operation.

## Email distinction
app/member-mail.js sends verification and password-reset messages through the Resend API. This is an outbound transactional-email adapter, not an email-forwarding tool. Actual live credentials/delivery were not inspected or verified in this readiness check. The new Hostinger mailbox does not automatically replace that adapter. Retain existing service/configuration until a replacement is configured and tested; do not cancel services or delete forwarders based only on mailbox creation.

## Coordinated cutover
1. Record existing app origins and relevant DNS values privately. Preserve the existing deployment, database and new mailbox. Do not use a destructive reset-domain/email operation.
2. Check current website/domain and mail status again. Use the existing Node.js application's Connect domain flow, selecting goldtrails.org. Keep the same application/repository/database; do not create a duplicate site.
3. Follow Hostinger's actual DNS requirements and automatic SSL process. Preserve Hostinger MX, SPF, DKIM and DMARC. Adding a sender service must not replace receiving-mail records or create duplicate root SPF records.
4. After the real application serves with valid HTTPS, set ADMIN_ORIGIN and MEMBER_ORIGIN together to https://goldtrails.org (no trailing slash) in Hostinger. Audit any saved absolute callback/redirect URLs before retiring the temporary address. Existing app URLs are generally relative; do not blanket-rewrite historical research/source links or production database rows.
5. Choose the outbound sending method explicitly. Existing Resend supports an authenticated Gold Trails sender once its domain is verified. Hostinger SMTP/API is an alternative requiring a separate adapter/configuration and delivery tests. A mailbox alone is insufficient. Do not place passwords or API keys in chat or source control; credential entry/changes remain user-owned.
6. Check root and www canonical behavior, certificate validity, homepage, public articles/creator profiles/video APIs, Plus gates, owner/member sign-in, exact-origin CSRF checks and sign-out. New host-only sessions may require signing in again.
7. Test a controlled real signup/verification and recovery message end to end, including links using the new domain. Open registration only after delivery works. Keep payments disabled under the existing approval boundary.
8. Confirm the established GitHub → Hostinger deployment still updates the same site, and update current setup examples/documentation only after the cutover succeeds. Local development can continue throughout; any public routing transition is separate from editing/building/testing.

Official guidance:
- https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/
- https://www.hostinger.com/support/4146975-what-is-dns-propagation-at-hostinger/
Hostinger says propagation normally completes within 24 hours, with rare cases up to 72 hours; preview development can continue while DNS updates. Waiting after registration alone will not attach the domain to the Node.js app.

## Follow-up after Safari parked-page report
At approximately 8:20 p.m. Eastern on October 15, root and www still returned the Hostinger parked-domain page with valid HTTPS. Cloudflare DNS still returned A 2.57.91.91 and www CNAME goldtrails.org. The existing app remained on the temporary domain. Hostinger’s Connect domain warning was inspected. Automatic approval review rejected submitting Change, citing the lack of clear current approval for a production cutover that retires the temporary site and requires coordinated origin/sign-in validation. No switch was submitted; the dialog was canceled. An explicit user approval request is pending. Preserve the mailbox and sending provider, and do not retry the cutover until that approval arrives.
