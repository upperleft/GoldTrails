# Design review and homepage publication — October 18, 2026

Paul explicitly authorized publication: “publish!”

Published release **`1a61ac30f8ac8d73380a96cc25fe611d48f1808e`** to the existing GitHub `main` deployment branch. Hostinger is serving it at https://goldtrails.org/. This includes the first ten review findings, remaining review improvements, and the revised homepage artwork/navigation.

The clean existing GitHub Desktop checkout was fast-forwarded from `15779af` to the approved release. GitHub Desktop completed the authenticated push. The remote main SHA was then verified. No forced push, environment change, database migration or billing activation was performed.

Prepublication validation: **402 tests passed**; build checked **16 HTML pages and 579 local links/assets**. An independent release audit found no material deployment blocker.

## Live checks

Checked October 18, 2026 at 13:31 UTC:

- Homepage returns 200, references `full-menu-v2.webp`, contains the permanent Products menu control, and has no `nav-plus` control.
- Deployed artwork returns 200 as `image/webp`, is 434,214 bytes, and its SHA-256 matches the approved local asset exactly.
- Articles, Products, creators, glossary, About, signup and Connections return 200. The article listing and signup reference their new stylesheets.
- Public state-research and creator-map APIs remain 403; private calendar events remain 401; account redirects to login.
- Existing friends' invitation returns 303 to the clean homepage with its dedicated guest cookie. Guest homepage returns 200 with the new artwork, Products control, guest welcome and direct Almanac link. Guest California research returns 200. The invitation URL and cookie are excluded from the report.
- Live browser shows the updated homepage at the canonical domain with the friends' preview welcome strip, correct Products and Almanac destinations, no standalone Plus menu control, and no horizontal overflow.

Evidence in the task workspace: `outputs/homepage-menu-2026-10-18/live-verification.json` and `live-homepage.png`. The existing friends' link automatically receives this release; no replacement invitation is needed.

This completion note records the verified deployment; it does not introduce further website changes.
