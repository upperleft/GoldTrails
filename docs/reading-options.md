# Temporary reading options

The customer header offers Reading options beside Login / My account on full site pages. app/reading/handler.js injects the shared controls; admin pages and API responses are excluded. Without JavaScript visitors retain the original site.

Choices: text size 100%, 115%, 130%, 150%, 175%, 200%; bolder text; stronger contrast; more line spacing; simple Arial font. Reset restores original styles. Escape and Done close the panel and return focus. The panel scrolls within small viewports. Larger text reflows columns and the hero.

Settings use sessionStorage only, remain during navigation/reloads in the same tab, and are not saved to accounts or sent to the server. Browser session restoration can retain a tab's settings. Reset clears them. Storage denial still permits current-page controls.

Fixed CSS font sizes were converted to equivalent rem sizes so labels and captions enlarge with articles. Default root size preserves original sizes. SVG/illustration lettering and third-party graphics remain unchanged. This feature does not certify accessibility conformance; browser zoom remains available.

Verification: six focused tests cover state validation, bounded sizes, reset, storage denial, tab persistence, Back/Forward restoration, keyboard closing/focus, idempotent HTML injection, public/member/calendar markup, and unchanged API/admin boundaries. Browser checks cover articles, directory/profile pages, clubs, Plus, Almanac, sign-in, and a synthetic interactive calendar and event editor. No production calendar records changed.

Deployment is isolated from unpublished Stripe preparation. No payment configuration or activation is included.
