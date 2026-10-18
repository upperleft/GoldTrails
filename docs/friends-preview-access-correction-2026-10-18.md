# Friends preview access correction — October 18, 2026

User intent: friends should browse the Almanac and Gold Connections through the existing invitation without registration, login, or a subscription purchase.

Observed before the correction: browser navigation through a valid guest session already opened the full Almanac map and Gold Connections event directory directly. However, the shared sidebar still appended a $5/month subscription advertisement on these unlocked pages. Guest cookies also ended after one day even though the invitation remained usable until October 31.

Changes:

- Suppress the automatically appended subscription sidebar for verified paid members and valid guests throughout the site. Ordinary public/free reading and the deliberately opened Plus description retain their existing behavior.
- Issue the guest cookie for the remaining invitation lifetime. The existing pass expiry and revocation are still checked on every protected read; no extra account, writing, personal data, or administrative permission is granted.
- Reopening the original invitation replaces an older one-day cookie. Sharing only the clean homepage URL does not issue guest access. The raw invitation remains outside Git.

Validation before publication: 407/407 Node tests pass; build checks 16 HTML pages and 579 local links/assets. Coverage includes paid/free/guest combinations, query spoofing, both feature pages, expiry and revocation, and blocked personal calendar access. Production verification is pending deployment.
