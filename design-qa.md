# Gold Trails illustrated homepage QA

final result: passed

Date: October 16, 2026. Approved design scope: desktop artwork; original HTML homepage on tablets and phones. Homepage publication still requires Paul's approval.

## Visual truth and capture

- Original visual: `/Users/paulshoemaker/Library/Messages/Attachments/30/00/CE77D8B9-6137-4DC6-9EC9-7FC064A8170D/IMG_2706.PNG` (1672 × 941).
- Clean production artwork: `app/homepage/clean-artwork.png` (1672 × 941). ImageGen removed only the annotation boxes, their leader lines and circle markers; the annotated source remains unchanged.
- Implementation: http://127.0.0.1:4332/; anonymous, default reading settings, dialogs closed, local application with no production database or mail transport.
- Full desktop capture: parent workspace `outputs/Gold-Trails-Homepage-1440x900-2026-10-16.png` (1440 × 900 CSS/pixel viewport, density 1).
- Artwork-only capture: `outputs/Gold-Trails-Homepage-Art-QA-2026-10-16.png`; DOM bounds 1440 × 810.43 at (0,0); screenshot normalized to 1440 × 810.
- Combined comparison opened for inspection: `outputs/Gold-Trails-Homepage-Comparison-2026-10-16.png` (2880 × 810; source left, rendered right). Source was proportionally downsampled to 1440 × 810; implementation normalized to the same dimensions. Browser chrome and utility row excluded from the artwork comparison.
- Focused navigation comparison opened: `outputs/Gold-Trails-Homepage-Navigation-Comparison-2026-10-16.png` (490 × 440; equal source/render crops side by side). Necessary to inspect labels, help icons, boundaries and text softness.
- Full requested viewport screenshots saved with dimensions in their filenames in the same parent output directory.

## Required fidelity surfaces

- **Fonts/typography:** raster logo, headings, labels, line breaks and weights retain the supplied design. The real help/search UI uses existing DM Sans at 18px/1.55. The source's small raster text becomes slightly softer through WebP/resampling; this is P3. Text view and existing reading controls provide adjustable real text rather than pretending raster lettering can change size or weight.
- **Spacing/layout:** source proportions preserved. Final desktop artwork bounds: 1819.48 × 1023.99 at 1920×1080; 1440 × 810.43 at 1440×900; 1265.10 × 711.99 at 1366×768. All maintain 1672:941, without clipping or stretching. Utility row fits below the artwork in these viewports. Tablets/phones intentionally use the original homepage, per Paul's revised instruction.
- **Colors/tokens:** source dark wood, gold, forest green and parchment remain in the raster. No substitute CSS illustration or icon set was introduced. Real help panels use readable dark text, parchment background, gold border, and visible blue/white focus treatment.
- **Image quality:** exact Old-Timer, logo, scenery and panel arrangement preserved; source annotations removed with a clean image edit. Optimized WebP is about 536KB. Image box reserves its exact ratio before loading. Tablets/phones select the transparent fallback and no desktop artwork source.
- **Copy/content:** visible artwork wording retained. Accessible labels and help describe actual features. Destinations use the existing Plus Almanac. Search chooses among existing searchable libraries; no global search engine or nonexistent destination page is advertised as implemented. Member navigation uses the existing session and My Gold Trail route. Existing prices/payment state are unchanged.

## Comparison history and fixes

1. **P2 tablet legibility/empty space:** initial segmented tablet experiment left excessive blank space and shrank hero copy. Revised the layout, then Paul explicitly chose the original HTML homepage on tablets/phones. Removed the tablet image layout and unused slices. Final 1024×768, 834×1194 and 390×844 captures show the original homepage, with reading controls available and zero large artwork sources selected.
2. **P2 inherited main padding:** the semantic main element inherited the site's generic width/padding. Reset only the illustrated main's box. Final same-viewport source/render comparison shows source regions in the intended proportions.
3. **P2 loading/resize geometry:** a transparent placeholder's intrinsic ratio could move hotspots while changing image sources. Reserved source ratio explicitly and placed the picture inside that fixed canvas.
4. **P1 collapsed artwork after ratio fix:** generic navigation flex styling gave the now-out-of-flow image canvas no intrinsic width. Set the illustrated navigation to block and its canvas to 100% width. A fresh screenshot confirmed the artwork was present. Final browser checks now require nonzero stage width/height, correct aspect, no link/help overlap and minimum control size; all desktop sizes passed.
5. Final post-fix comparison: full and focused source/render pairs opened together; no actionable P0/P1/P2 visual differences remain. Tablet/phone variation is intentional, not design drift.

## Verification results

- **286 automated tests passed**, zero failed/skipped. Covers existing application and new homepage coordinate bounds, unique IDs, help/link separation, mobile markup and media selection, calibration default, member routing, private cache/no account leakage, and real upcoming-event retention in both responsive views.
- Build passed: 14 existing HTML pages, 404 existing local links/assets checked. Additional dynamic homepage assets loaded and were inspected through the browser. CommonJS loading previously passed for the published Connections modules.
- Browser viewports: 1920×1080, 1440×900, 1366×768, 1024×768, 834×1194, 390×844. No horizontal overflow. Desktop: 44 visible controls, all at least 24 × 24 CSS px, zero help/link overlaps, valid nonzero artwork bounds/aspect. Tablet/phone: original HTML view, zero art hotspots, zero large artwork sources, reading control visible.
- All 19 desktop help buttons opened, stayed inside the viewport, and closed. Also verified toggle-to-close, outside click, Escape, focus return and Enter activation.
- Search opens six existing library destinations. Primary Articles and Glossary buttons navigated successfully. Sign-in and membership hrefs use the existing routes. Logged-in behavior/privacy covered by injected-session HTTP tests; no real account was created or altered.
- Reading enlargement switched to the original HTML view, reset worked, and Return to illustrated homepage worked. Tablet/phone reading control placement checked.
- Browser warning/error log checks returned empty lists.
- Calibration exists only in the local preview invocation; production registration has no calibration option or user-controlled query switch.

## Follow-up polish / limits

- P3: raster text has the source's finite resolution and minor WebP softness; larger future source artwork could improve very large displays. Existing Text view handles adjustable text now.
- No changes were made to real billing, authentication, research, creator access, or payment activation. The local preview has no real database; production database-backed directory and member routes are not simulated there.
- Gold Connections is separately live at https://goldtrails.org/connections/. Its independent database-concurrency acceptance and approved secret/email configuration remain operational follow-up, not claimed as completed by the homepage tests.

## Implementation checklist

- [x] Clean source artwork and optimized desktop asset.
- [x] Existing routes, independent help controls, keyboard/focus/search behavior.
- [x] Original tablet/phone homepage, reading controls, no desktop artwork download there.
- [x] Default-off local calibration and editable coordinate config.
- [x] Regression/build checks and post-fix browser/source comparison.
- [ ] Obtain approval before publishing the illustrated homepage to Hostinger.
