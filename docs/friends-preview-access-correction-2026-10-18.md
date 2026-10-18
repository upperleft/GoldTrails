# Friends preview access correction — October 18, 2026

Status: **published at `f712e4eb6d67aaffc3bfda937f1d782344170929`**. The production checkout matches `origin/main` and is clean.

User intent: friends should browse the Almanac and Gold Connections through the existing invitation without registration, login, or a subscription purchase.

Observed before the correction: browser navigation through a valid guest session already opened the full Almanac map and Gold Connections event directory directly. However, the shared sidebar still appended a $5/month subscription advertisement on these unlocked pages. Guest cookies also ended after one day even though the invitation remained usable until October 31.

Changes:

- Suppress the automatically appended subscription sidebar for verified paid members and valid guests throughout the site. Ordinary public/free reading and the deliberately opened Plus description retain their existing behavior.
- Issue the guest cookie for the remaining invitation lifetime. The existing pass expiry and revocation are still checked on every protected read; no extra account, writing, personal data, or administrative permission is granted.
- Reopening the original invitation replaces an older one-day cookie. Sharing only the clean homepage URL does not issue guest access. The raw invitation remains outside Git.

Validation: **407/407 Node tests pass**; build checks **16 HTML pages and 579 local links/assets**. Coverage includes paid/free/guest combinations, query spoofing, both feature pages, expiry and revocation, and blocked personal calendar access.

After publication, **17/17 live checks passed**. The original invitation exchanges for a secure, host-only guest cookie that lasts through the configured pass expiry, then returns to the clean homepage. Both premium links open their actual features without injected subscription promotions. Guest California research returns 200; anonymous California research remains 403 and the private calendar remains 401. Private/no-store, cookie-varying and noindex response protections remain intact. Public visitors retain the existing Plus description and price.

Live browser verification reopened the original invitation and clicked both homepage feature links: Connections displayed the event directory, and the Almanac displayed the real 50-state map without a subscription gate or sidebar advertisement. Entering California loaded all 12 research sections at `/gold-almanac/california/` using guest access without a member login.

Evidence outside Git: task workspace `outputs/friends-access-fix-2026-10-18/live-verification.json`, `connections-guest-access.png` and `almanac-guest-access.png`. No invitation URL, pass token or cookie is included in these notes or the committed code.
