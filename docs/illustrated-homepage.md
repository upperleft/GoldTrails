# Illustrated homepage

Paul supplied the annotated 1672 × 941 design on October 16, 2026. The artwork is the visual foundation; HTML owns navigation, help, and account routing. The original homepage implementation used branch `illustrated-homepage`, based on Connections release `4bb5d8e`, and excluded development-only Stripe/culture changes. **Paul approved initial production publication on October 16, 2026; the homepage is live at https://goldtrails.org/.**

## Current published release

**Published October 18, 2026 at `a05dbfba83edfdc9848cf0aac787d93142e8abb8`:** [the consolidated homepage critique](homepage-consolidated-critique-2026-10-18.md) implements the requested sidebar controls, nine-item navigation, shorter introduction and Almanac-only card using v4 artwork. The [compact guest status bar](guest-preview-compact-status-2026-10-18.md) is included. Production checks passed **49/49**, including exact deployed asset bytes, public/guest navigation and existing invitation/access protections. The existing friends invitation remains active on the same production site; no invitation credentials are stored in these notes.

Live browser inspection at **1280 × 720** confirmed the 30px guest strip and full artwork fitting below it without page overflow, Reading/Text View controls below About, and functioning Reading Options/Done and Text View/Return. A 1027px native layout was also checked. **An exact phone-size render was not verified for this release.** Evidence: task workspace `outputs/homepage-compact-live-2026-10-18/live-verification.json` and `desktop-friends-preview.png`. Creator profiles/videos remain free; subscribers and validated guests receive direct Almanac/Connections links, while public/free visitors receive the Plus description. Server-side restrictions, guest expiry/read-only behavior and payment activation are unchanged.

**Hero appearance preference, October 18, 2026:** Paul prefers the original illustrated hero: large serif “Explore. Learn. Connect.” with gold “Connect” and parchment. Both hero buttons were removed in v3. The approved v4 introduction reads “Gold prospecting knowledge, real-world experience, and a supportive community of gold prospecting enthusiasts.” Equivalent HTML remains available to assistive technology, and reading preferences switch to the flowing text homepage. Future design reviews must not replace the hero typography or paint new text/backgrounds over it without a specific request.

## Original implementation history

The details below record the October 16 release. Current navigation, copy, card links and verification limits are described above and in the linked October 18 notes.

- `app/homepage/clean-artwork.png`: non-destructive ImageGen cleanup of the two annotation labels, leader lines, and circular anchors. Original attached image remains unchanged. No annotations were hidden with overlays.
- `app/homepage/hotspots.js`: original-canvas coordinates, IDs, accessibility labels, destinations, and help text. There are 44 independent controls, including 19 help buttons. No link encloses a help button; coordinate tests reject overlap.
- `app/homepage/handler.js`: semantic, server-rendered navigation; signed-in account link uses existing member sessions and routes to My Gold Trail. No account details or session values are rendered. The response is private/no-store and varies by Cookie.
- `dist/assets/homepage/`: optimized WebP full artwork (about 536 KB), with the original aspect ratio reserved before loading. `<picture>` media conditions select only a transparent pixel on tablets and phones, avoiding the large artwork there.
- `dist/home-art.css`, `dist/home-art.js`: responsive composition, visible focus indicators, nonmodal help/search panel, outside click/toggle/Escape dismissal, focus return, and viewport clamping.
- `server.js`, `app/server.js`: homepage handler registered through the current application. Authentication, subscriptions, database, and other routes are reused.
- `app/connections/handler.js`: existing real-upcoming-event shelf is retained in both responsive homepage views. Only one view is displayed at a time; no new event records are created.

## Routing decisions and limitations

The working site has no separate public Destinations page or global search engine. Destinations/Find Gold therefore use the existing Almanac route, with help explaining the Plus requirement. Search opens a short chooser linking to the existing article, glossary, creator, product, event, and community search/filter interfaces. No dead destinations or duplicate search engine were invented.

As agreed in chat, the artwork is desktop-only: at least 1280 CSS px wide, with a fine pointer and hover support. Tablets, phones, and smaller windows retain the original HTML homepage. Touch devices do not download the full artwork even when wide. Desktop preserves the full composition and aspect ratio, fitting the illustration and utility row into typical first screens; unusually short windows can scroll rather than shrink controls below 24 × 24 CSS px.

Raster lettering cannot respond to font-size/weight CSS. The existing Reading options control remains available; changing a reading preference switches desktop into the existing HTML view where those settings work. Text view can also be selected directly and reversed. Original mobile reading controls remain available. Existing scripts, free creator links, prices, and payment activation state are unchanged.

Local preview: `node scripts/preview-homepage.mjs` → http://127.0.0.1:4332/. No real database, emails, payments, or member accounts are used. Creator database search and actual sign-in are checked on the production application independently; the local preview does not simulate a complete member login.

Calibration: `node scripts/preview-homepage.mjs --calibrate` enables outlines and names locally. Production passes no calibration option, and query parameters cannot enable it.

## Verification

- Source-coordinate uniqueness, bounds and link/help overlap; mobile markup preservation and media selection; calibration default; authenticated routing and no private account leakage; upcoming-event shelf retention.
- Full release tests/build results and visual evidence: see root `design-qa.md`.
- Browser checks: all 19 help buttons on the desktop; in-bounds dialogs; toggle, outside click, Escape and focus return; Enter keyboard activation; Search chooser links; Articles and Glossary navigation; reading enlargement → HTML view → reset and return.
- Requested viewports: 1920×1080, 1440×900, 1366×768, 1024×768, 834×1194, and 390×844. No measured horizontal overflow or undersized controls. Tablet and phone viewports select zero large homepage artwork sources. Browser console checks returned no warnings/errors.

Publication approved and completed on October 16, 2026. Hostinger completed commit 2b0c801. Live verification confirmed the artwork loaded, 44 controls, all 19 help panels, Search destinations, no browser warnings/errors, and original HTML at 1024px tablet and 390px phone widths with no desktop artwork selected. A follow-up registers the WebP MIME type explicitly. No payment or email activation changed. Connections remains public at https://goldtrails.org/connections/.
