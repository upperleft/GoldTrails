# Dark mode in Reading options

Prepared October 16, 2026. Paul approved publication together with the Compass cleanup on October 17, 2026, answering “y” to the combined publication request. The preceding bright yellow nugget package was approved, pushed and verified live at production commit `c7e7812` before this work.

## Behavior

- Added a labeled Dark mode checkbox to the shared Reading options disclosure on public and member HTML pages. Admin and API responses remain outside this enhancement.
- Uses the existing tab-scoped session preferences, applied in the head before the body paints. No account setting, permanent local-storage preference, cookie, or database write was added. Old saved reading preferences retain their values and default to light mode.
- Dark mode switches immediately, follows navigation in the same tab, and works alongside text enlargement, bold, spacing, font, and stronger contrast. Reset removes the dark preference along with the other reading choices.
- A dedicated, content-versioned `dist/dark-mode.css` uses warm charcoal surfaces, cream text, light blue links, visible input borders and gold buttons. All rules are opt-in and screen-only, preserving the existing light print appearance.
- Light parchment artwork is hidden while dark mode is enabled. Decorative nuggets, photographs, map tiles and illustrated homepage artwork retain their colors. Dark panels cover reading, directory/product controls, video dialogs, public forms, account shortcuts, Compass, membership, Connections and Almanac panels; calendar variables are supplied for its shared theme.
- No membership, navigation entitlements, payments, research, map markers or data were changed.

## Verification

- Seven reading-options tests passed, including restored settings before DOM readiness, malformed/missing dark values, compatibility with existing settings, blocked storage, cross-page persistence, combined contrast and Reset.
- Integration checks cover common public/member routes and confirm controls are excluded from admin/API responses.
- Build passed: 14 static HTML pages and 499 local links/assets checked. Dynamic styles use the existing `assetUrl` hash helper.
- Inspected article, product catalog, membership preview, sign-in form, fictional account, Compass demo, glossary and creator directory. Checked the illustrated homepage still offers Reading options.
- Product photograph dialog remained dark around an unfiltered, successfully loaded photograph. Click-to-shrink still works.
- At 390 px, menu bounds fit the viewport; at 200% text with dark mode and stronger contrast, the product page has no horizontal overflow. Reset restored the original light background. Temporary viewport overrides were reset.
- Live verification for the preceding gold package: production HEAD and origin/main both `c7e7812`; new nugget asset and style.css bytes match the approved files, and the live product header uses the new image.

## Preview

`scripts/preview-reading.mjs` serves on loopback port 4335. It uses a fictional Alex/TrailReader account only on the account-preview route and public creator catalog data. All mutations return 405; no database, email service, payment setup, or real member record is used.

Screenshots are in the task workspace's `outputs/dark-mode-preview-2026-10-16/` directory. The last published gold screenshot is `outputs/bright-nuggets-preview-2026-10-16/live-products.png`.
