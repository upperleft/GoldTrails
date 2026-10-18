# Homepage menu refresh — October 18, 2026

Implemented Paul's request to add Products, use one named Almanac entry, and remove the separate Gold Trails Plus navigation item from the homepage. Published to Hostinger on October 18, 2026 after Paul's explicit approval. See `design-review-live-2026-10-18.md` for live verification.

## Result

- Replaced the illustrated sidebar's separate Plus row with a permanent, free Products link and equipment icon.
- Almanac has one sidebar entry with a visible Plus badge. Public/free visitors open the existing Plus description; effective subscribers and validated guests open the protected Almanac. Research access rules are unchanged.
- Replaced the old Destinations artwork with Creators & Videos and a play icon. The creator panel, profile directory and linked videos remain free. Creator-map discovery remains within the Almanac.
- Kept the existing public Clubs & Groups / entitled Gold Connections discovery behavior. No private account or participation permissions were added.
- Removed the separate Plus link from the illustrated utility navigation and the homepage's classic/mobile menus. Other pages retain their existing Plus navigation. The lower-right Plus promotion remains.
- Updated real links, accessible names, active Home state, semantic navigation, help popups and responsive menus alongside the artwork. All ten sidebar rows retain their original positions, and help targets remain separate from links.

## Files and assets

- `app/homepage/hotspots.js`, `app/homepage/handler.js`, `dist/home-art.css`: illustrated navigation and help behavior.
- `app/site-navigation.js`: homepage-only classic/mobile menu rules.
- `app/homepage/menu-artwork-v2.png`: edited source image, retained separately from the original.
- `dist/assets/homepage/full-menu-v2.webp`: optimized 1672 × 941 project asset, 434,214 bytes. A new filename avoids cached old artwork. The original artwork is preserved.
- `tests/homepage.test.js`, `tests/site-navigation.test.js`: navigation, roles, membership and responsive-source regressions.

## Verification

- Full regression suite: **402 tests passed, 0 failed**.
- Build: **16 HTML pages, 579 local links/assets checked**.
- Browser: desktop at 1440 px, compact desktop at 1280 px, tablet at 768 px and phone at 390 px; no horizontal overflow in checked layouts. Sidebar labels fit at 1280 px.
- Browser: Products opened the 63-item catalog; the public Almanac entry opened `/plus/`; the fictional subscriber entry opened `/gold-almanac/`. Products and Almanac help displayed the appropriate descriptions and Plus status.
- Phone/tablet selected the transparent image source and retained the flowing HTML homepage. Their menu includes Products and Almanac · Plus, with no separate Plus navigation item.
- Subscriber checks used a read-only local fixture, with no real account, payment, email or event changes. Temporary responsive overrides were reset.

Preview: http://127.0.0.1:4348/

Screenshots and test report: task workspace `outputs/homepage-menu-2026-10-18/`.

## Image generation record

Used the built-in ImageGen tool, in edit mode. Input: the existing `dist/assets/homepage/full.webp`. A second precise edit corrected only the Glossary book icon. No Python or PDF was used.

First edit prompt:

> Use case: text-localization. Edit target: the supplied existing Gold Trails desktop website illustration. Preserve the entire approved scene: identical old prospector face, pose, gold pan, logo, mountains, sunset river, wood frames, colors, composition and wide 1672 by 941 aspect ratio. This is a precise navigation lettering/icon correction, not a redesign. Keep ALL TEN left menu row rectangles in exactly their existing positions and sizes, and keep every round question mark at its existing position. Left rows top to bottom must read exactly: 1 Home, 2 Articles, 3 Almanac with a small distinct gold badge reading Plus immediately after Almanac, 4 Creators & Videos, 5 Glossary, 6 Gold Connections, 7 Products, 8 Search, 9 About, 10 Sign In. Row 4 replaces the old Destinations row: replace its mountain icon with a small old-fashioned gold video/play icon. Row 7 replaces Gold Trails Plus: replace its star icon with a small gold equipment/rucksack icon and label Products. Match the established engraved gold and wood navigation style, readable cream serif text. No remaining Destinations menu label or separate Gold Trails Plus menu row. In the lower-left feature panel, replace FIND GOLD with Creators & Videos; subtitle Free to explore; body Meet prospectors and explore their linked videos.; replace Explore Destinations button label with Browse Creators and change its round location-pin emblem to a small gold play emblem. Preserve the river photo, panel dimensions and button/help positions. Leave hero wording, the Articles and Glossary panels, and the lower-right Gold Trails Plus promotional panel unchanged. That lower-right promotion is intentionally retained. No extra controls or objects, no callout annotations, no new layout.

Final correction prompt:

> Precise object edit of this supplied Gold Trails homepage image. Change ONLY the small icon at the left of the FIFTH left-sidebar menu row, beside the word Glossary: it is currently a mountain triangle. Replace that triangle with a small engraved GOLD OPEN BOOK icon matching the existing Almanac open-book style and size. Preserve every pixel outside that tiny icon area as closely as possible. Keep all lettering, all ten menu row bounds, every question mark, Products, Almanac Plus badge, Creators & Videos, lower panels, logo, old-timer, landscape, colors, 1672 by 941 composition unchanged. Do not change any text or redraw the scene.
