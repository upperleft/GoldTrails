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

Saved locally for review, not published. The previous homepage work is saved in commit `109250f` and also remains unpublished. No authentication, membership, payment or data changes are included.
