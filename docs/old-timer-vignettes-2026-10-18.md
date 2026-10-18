# Small Old-Timer illustrations — October 18, 2026

Implemented Paul's request for restrained, page-appropriate appearances of the existing character beyond the homepage. Two decorative transparent illustrations use the existing character reference: reading a field book on the Glossary, and holding an unbranded camp coffee mug on Products. They occupy the unused right side of the existing page introductions, without a new panel, banner, heading, feature or minimum header height.

## Files

- Source PNGs and exact built-in ImageGen prompts: `app/artwork/`; prompts and references are recorded in `generation-records.json`.
- Optimized transparent WebPs: `dist/assets/old-timer-reading-v1.webp` (54,540 bytes) and `dist/assets/old-timer-coffee-v1.webp` (53,502 bytes). Each is 384 × 351 pixels; originals are retained.
- Markup: `app/products-page.js` and the existing `dist/glossary/index.html`. Products is regenerated through the existing build.
- Scoped `.old-timer-vignette` rules in `dist/style.css`. The build updates stylesheet version references throughout generated pages; other pages have no new illustrations.

These are decorative character illustrations, not specimen or product-identification photographs. They have empty alt text, are hidden from assistive technology, contain no link, and do not intercept clicks. Real catalog photographs and their credits remain unchanged.

## Responsive / reading behavior

The illustrations display at 110px wide only at viewport widths of at least 1100px, contained within the existing introduction height. Narrower picture sources select a transparent pixel, and the decorative element is hidden. Enlarged reading text, stronger contrast and print hide the illustration and release reserved text space. No character was added to pages already using a full Old-Timer scene or to individual creator portraits.

## Verification

- Existing Products, glossary popups/research and reading-controls tests: **21 passed, 0 failed**. Log: `/private/tmp/gold-trails-old-timer-tests-2026-10-18.txt`.
- Build passed: 16 HTML pages and 579 local links/assets checked. Both responsive image assets were also directly observed loading in the browser, with natural dimensions 384 × 351.
- Browser inspected Products and Glossary at an actual 1280px desktop width: clear text, contained artwork, no horizontal overflow, introduction height 125.586px.
- Actual 928px glossary view hides the image and selects the transparent source. The browser viewport override did not reliably apply requested sizes, so no phone-size screenshot claim is made.
- Larger text at 115% hides the illustration, releases its padding, and preserves no horizontal overflow. Reset restores the illustration.
- Screenshots: workspace `outputs/old-timer-vignettes-2026-10-18/products-desktop.png` and `glossary-desktop.png` (outside this repo).

## Community illustration follow-up

Paul requested a community scene with the Old-Timer, a slender male prospecting friend, and a Black woman prospector. A third matching transparent illustration now sits in the existing Clubs & Groups introduction. The three friends gather around one pan; no new copy, feature or panel is introduced.

- Source: `app/artwork/old-timer-community-v1.png`; optimized asset: `dist/assets/old-timer-community-v1.webp` (629 × 300 pixels, 84,198 bytes). Exact prompt and character reference are in the generation records.
- `app/communities-page.js` reuses the decorative picture pattern; `dist/communities.css` permits a 210px group illustration only at widths of at least 1200px. The existing enlarged-text, stronger-contrast and print behavior still applies. The mobile source remains a transparent pixel.
- At an actual 1280px browser width, the introduction height is unchanged at 105.594px and directory content starts at the same 289.781px position before and after the addition. No horizontal overflow; image loaded at natural dimensions 629 × 300.
- Browser checked enlarged text and stronger contrast: image hidden, reserved text padding released; Reset restores it. At an actual 928px width, image is hidden, transparent source selected, and no horizontal overflow.
- Screenshot: workspace `outputs/old-timer-vignettes-2026-10-18/community-desktop.png` (outside this repo).
- Existing community/reading tests: **12 passed, 0 failed**; normal build passed (16 pages, 579 local links/assets checked). Log: `/private/tmp/gold-trails-community-art-tests-2026-10-18.txt`. The directory data and its links are unchanged.

**Published and verified October 18, 2026**, in release `cc70358900606fb20204330c3aae390ab3e496e8`, including the preceding homepage work. Live asset hashes match the local approved assets; the community scene was also visually checked on the live page. See [publication verification](homepage-publication-2026-10-18.md). No authentication, membership, payment or data changes are included.
