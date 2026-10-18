# Product photographs at 200% size — October 18, 2026

Requested: enlarge product photos to twice their previous displayed width and height.

- Image display: 52 × 52 → 104 × 104 CSS pixels; frames: 58 × 58 → 116 × 116.
- Desktop retains the existing 124px media column, stacking two photographs so the description keeps its width.
- At 600px and below, photographs follow the full-width summary in a right-aligned wrapping row.
- Regenerated all 44 approved local thumbnails from their full-size originals as 208 × 208 WebP assets, using contain fit, a white background, no source upscaling and quality 85. Credits, source records and full-size images are preserved.
- Thumbnail query version `v=208` refreshes cached small assets. Intrinsic image dimensions now match the 104px display.
- Existing image dialog, photo-to-shrink, Escape and focus-return behavior is retained.

Verification: 19 existing product/presentation tests passed; build checked 16 pages and 579 local links/assets. Desktop browser confirmed 104 × 104 rendered images, 116px frames, 208px natural image width, no horizontal overflow, and photo open/shrink/focus return. Mobile rules were reviewed in code; the browser's viewport override did not apply during this check, so no new phone screenshot is claimed.

Published to https://goldtrails.org/products/ in release `feade313c8cb3ff5a11f6becea5880105e7de94b`. Live checks at 13:45 UTC confirmed the new stylesheet, refreshed thumbnail matching the local asset, 104 × 104 rendered images with 208px natural width, and working photo open/shrink behavior. The existing friends' preview receives the same catalog update.

Evidence: task workspace `outputs/product-photo-size-2026-10-18/live-products.png`, `live-verification.json`, `desktop.png` and `tests.txt`.
