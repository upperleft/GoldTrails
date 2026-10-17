# Parchment, Camp Kitchen and product photographs

Prepared October 16, 2026, on `parchment-and-camp-kitchen`, based on the published account release `b87f39e`. Implementation is local; production publication still requires approval under the existing project brief.

## Presentation

Paul approved the generated paper sheet and requested wider use. Larger cards have 14px rounded corners; article reading panels use 16px. Generated parchment frames public section introductions, article reading panels, takeaways, field notes, callouts and public information panels. A clean version is used most often; the coffee-ring version is reserved for takeaways/field notes. The paper is a nine-slice decorative border, so corners remain intact when live text expands. No text is baked into the images. Form and admin workflows retain their practical surfaces.

The paper is hidden in stronger-contrast mode and in print. Existing text remains real HTML, with its sources and content preserved. The illustrated homepage's pointer-hover outline/glow was removed; keyboard focus and expanded-control indicators remain.

Project assets:

- `dist/assets/parchment-plain-v1.webp`
- `dist/assets/parchment-coffee-v1.webp`

Both were created with the built-in Image Generation tool, with genuine alpha transparency preserved, then encoded as WebP with Sharp. They are decorative artwork, not photographs or research evidence.

### Generation prompt

Create one production website texture asset, not a mockup, for Gold Trails, a warm friendly gold-prospecting field library. A single blank square sheet of warm ivory parchment viewed exactly straight down, with a genuinely transparent background outside the sheet and its natural soft shadows. Target square 1024 x 1024. Paper occupies almost the entire canvas with only a slim transparent safety margin (about 16 pixels) around all sides. Slightly irregular softly worn edges, never burnt or heavily distressed. A small gently curled lower-right paper corner lifted to reveal a warmer underside, with a convincing soft shadow below it; a subtler lifted upper-left corner. One faint incomplete coffee-mug ring tucked near the upper-right edge, entirely inside that outer corner area, muted enough for readable text. Keep every decorative curl, shadow and coffee detail inside the outer 200-pixel corner regions. The central 60% must be completely blank, clean, nearly uniform warm ivory (#fff9eb), with extremely delicate paper fibers only, suitable for live dark text over it. The middle stretches of all four edges must be visually quiet and consistently aligned, because the image will be used as a CSS nine-slice border with preserved corners and stretchable center/edges. No perspective, no desk, no objects, no lettering, no symbols, no text, no border lines, no dark stains, no yellow or orange cast. Natural crafted storybook realism, understated and welcoming. Output alpha transparency, not a checkerboard painted into the image.

Clean version edit: remove only the coffee ring and drops, preserving the outer contour, transparent margin, curled corners, shadows, texture and square framing. Generated output dimensions are 1254 × 1254 for both files.

## Camp Kitchen

Six new records (`GT-P0058`–`GT-P0063`) and three manufacturer records were appended. All 57 existing product records and 25 manufacturer records were checked against the previous commit and remain exactly unchanged. The catalog now has 63 entries in 11 categories.

- [Coleman Triton stove](https://www.coleman.com/grills-stoves/camping-stoves/multi-burner/triton-2-burner-propane-camping-stove/SAP_2157352.html)
- [Camp Chef Everest 2X stove](https://www.campchef.com/collections/shop-cooking-systems/products/everest-2x)
- [GSI blue 8-cup percolator](https://gsioutdoors.com/products/8-cup-percolator?variant=43788006752488)
- [GSI Glacier stainless percolator](https://gsioutdoors.com/products/glacier-stainless-coffee-percolator)
- [GSI blue 12 fl oz mug, sold individually](https://gsioutdoors.com/products/12-fl-oz-cup?variant=43788006424808)
- [GSI blue 15-piece camp set](https://gsioutdoors.com/products/pioneer-camp-set?variant=43788007669992), including four mugs and a percolator.

Manufacturer descriptions and blue variant data were checked October 16. Prices are recorded only where the selected blue variant was explicitly identified. Availability is not inferred from the mere existence of a listing. No purchase was made, and no creator endorsement was inferred.

## Photographs

`app/product-photos.json` contains 44 visually checked manufacturer/product-publisher photographs across 31 records. Up to two photographs appear as 48px clickable targets at the bottom right of the product entry. Separate 96px thumbnails are loaded lazily; larger photographs load when opened. The native dialog overlays the page, with click-photo-to-shrink, Close, Escape and backdrop dismissal. Keyboard focus returns to the originating thumbnail. Without JavaScript, the image links still work.

Photographs live in `dist/images/products/`; every record retains original image URL, source product page, credit, verification date and alt text. They are actual publisher images, not generated product representations. Visual verification is not a claim of an independent product test, creator endorsement or a separately granted image license. Manufacturer branding and watermarks were preserved.

Generic scenery, unrelated upsell images, duplicate views and cream/green alternatives for explicitly blue records were rejected. Remaining 32 records have no verified photograph in this release. Gaps, retrieval failures and review contact sheets are saved outside the repository in `outputs/product-photo-review-2026-10-16/`; no placeholder product pictures are substituted. `scripts/research-product-photos.mjs` gathers candidates for review and never imports them automatically.

## Validation

- Full regression suite: 289 passed, no failures or skips.
- Final thumbnail optimization: 4 focused product tests passed afterward.
- Build: 14 HTML pages, 499 local links/assets checked.
- Browser: article parchment, creator information paper, Camp Kitchen filtering, source credit, full-photo open/shrink/Escape and keyboard focus return.
- Measured product headline bounds before/after opening a photograph: identical (including text width and document position); no horizontal overflow at 1280px or 390px.
- Phone photo dialog fits inside a 390px viewport. Parchment also checked at 390px; 200% text reflows without horizontal overflow. Stronger-contrast mode removes the decorative paper.
- No browser console warnings/errors in checked preview pages.

Preview: `node scripts/preview-warmth.mjs` → `http://127.0.0.1:4334/` (public catalog renderers only, no database, emails or payments).

Premium navigation/access changes discussed earlier remain a separate pending task; this change does not alter entitlements or publish new premium content.
