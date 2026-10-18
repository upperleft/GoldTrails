# Homepage changes saved October 18, 2026

## User direction

Keep the member homepage almost exactly like the public homepage: same artwork, hero, navigation arrangement and cards, with small changes that acknowledge existing access. Do not introduce a separate dashboard, panel, shortcut group or feature name. The generated “Your field tools” concept was rejected and is not part of the implementation.

## Completed locally

- Preserved the original “Explore. Learn. Connect.” hero typography and supporting copy.
- Removed both hero buttons and their question marks from the actual artwork and interactive controls. Source: `app/homepage/no-hero-buttons-v3.png`; optimized asset: `dist/assets/homepage/full-no-hero-buttons-v3.webp` (452,468 bytes). The previous artwork is retained.
- Removed the four duplicate feature links in the top utility row. Help, Reading options and Text view remain.
- Used the same v3 scene for public, registered-free, paid and valid guest-preview visitors.
- Public/free visitors retain the Plus badge, price and membership description links. Creator profiles and videos remain free.
- Paid/validated guest visitors see plain Almanac and Connections labels. The existing lower-right card keeps its art, uses a small “Welcome back” greeting instead of a price, and links its map/Almanac areas directly to the Almanac and its Connections areas directly to Connections.
- Suppressed the existing classic/text-homepage support promotion for entitled visitors only. Other pages are unchanged.
- Guest-preview banner retains its expiry, read-only explanation and Leave preview control. Home-only duplicate feature shortcuts are removed. Existing entitlement enforcement is reused; billing and authentication are unchanged.

## Verification

- Full test suite: **405 passed, 0 failed**, October 18, 2026. Log: `/private/tmp/gold-trails-home-full-tests-2026-10-18.txt`.
- Build passed: 16 HTML pages, 579 local links/assets checked.
- Focused member/public/guest tests include member-aware labels, correct links, no price/upgrade text for paid visitors, unchanged public offer, home-only promotion suppression and link/help hit-area separation.
- Public and fictional subscriber desktop previews were visually inspected. Both use the same scene; member text fits the existing card. Screenshot widths differ because the browser viewport override was inconsistent. Mobile/tablet behavior is covered by existing markup tests; no new mobile visual claim is made here.
- Screenshot evidence is outside the repo at `../../outputs/homepage-member-2026-10-18/public-preview.png` and `../../outputs/homepage-member-2026-10-18/member-preview.png`.

## Publication / continuation

**Published and verified October 18, 2026**, in release `cc70358900606fb20204330c3aae390ab3e496e8`, after Paul's explicit request to publish. The clean Desktop publishing checkout was fast-forwarded to that release and pushed through GitHub Desktop. Live HTTP and browser checks confirm the new public/member homepage and all three illustrations. See [publication verification](homepage-publication-2026-10-18.md).

Read-only local previews use `scripts/preview-design.mjs`: public on port 4352, fictional subscriber on port 4353 with `DESIGN_PREVIEW_ROLE=subscriber`. They make no production account or billing changes.

## Remaining ideas / work

- Publication and live verification are complete.
- Follow-up: two restrained Old-Timer illustrations are now implemented locally on Products and Glossary. See [the illustration notes](old-timer-vignettes-2026-10-18.md). They fit within the existing title areas; homepage artwork is unchanged by that follow-up.
- Optional redundancy cleanup: the first three lower cards each have two identical help buttons and three anchors to the same destination. Treat each card as one visual promotion; consider consolidating keyboard stops/help buttons only after reviewing the interaction. This has not been changed.

After the utility links are removed, Creators, Articles and Glossary have two visible homepage placements each (sidebar and card); Products has one (sidebar). Almanac/Connections use their sidebar and existing card. Do not count a card's image/title/button as three separate visual promotions. The user approved removing the utility links, not a broader redesign.
