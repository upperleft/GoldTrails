# Article photographs

The first illustration pass adds three sourced photographs to two articles:

- `is-that-really-gold`: Smithsonian gold specimen NMNH R6705-00 and USGS pyrite with quartz, beside the look-alike discussion.
- `where-gold-settles`: the original annotated Powder River aerial from USGS Fact Sheet 004-03, Figure 4, beside the inside-bar explanation.

These are identified reference specimens and a documented landform. Captions describe what the sources establish. They do not imply a common specimen scale, typical finds, gold in the photographed river bars, or modern access permission. The individual photographer or institutional credit, image record and reuse rights are visible beside each photograph. The Smithsonian image is CC0; the USGS works are public domain.

`database/map-data/article-photo-inspection-2026-10-12.json` preserves source URLs, direct asset URLs, reuse evidence, dimensions, inspection notes and byte hashes. Images are stored in `dist/assets/articles/` and served locally. Source-provided sizing is retained; the full frame is preserved with no generative edits. Images load lazily and have explicit dimensions and descriptive alt text. A normal link opens a larger photograph in a separate tab. The shared `article-photos.css` supports phone layouts, keyboard focus and printing; the build versions it by content hash.

The five published article HTML files are their editable source; the build does not regenerate them. Add images beside the passage they explain, rather than as unrelated decoration. Check the exact image, identification and reuse permission before use. Update any no-images source note when an article gains photographs. Keep technical citations separate from photograph credits.

The remaining articles stay text-only pending suitable images. A display of abundant gold in several pans does not illustrate controlled sampling. Generic laboratory or food sieves do not document a prospecting classifier. A crystal reference is not a pan concentrate. Images and caption fields with unresolved provenance remain in the photo holding report outside the deployed application.

## River-rock identification article · October 17, 2026

`identifying-river-rocks` adds thirteen authentic photographs covering twelve materials: granite, diorite, basalt, sandstone, limestone, gneiss, mica schist, quartzite, marble, quartz and chert, plus greenstone. Two different limestone examples illustrate variation. Each image's own Smithsonian, GeoDIL or USGS record was checked for identification and reuse rights, then the downloaded photograph was visually inspected. Smithsonian/GeoDIL selections are individually CC0; the USGS gneiss record explicitly states public domain. A restricted Smithsonian marble candidate was excluded.

Full-frame enlargements and separate 560px thumbnails are served locally from `dist/assets/articles/river-rocks/`. `credits.json` in that directory carries portable source URLs, credits, licenses, specimen context, dimensions and hashes. Detailed inspection evidence is retained in the three `database/map-data/river-rocks-*-photo-inspection-2026-10-17.json` files. There are no AI-generated identification examples, recolorings or invented river origins. No verified reusable river-worn extras were selected; the required identified photographs are complete.

`article-photo-viewer.js` follows the product photographs' existing modal pattern: tap to enlarge, Close/Escape/backdrop/image click to dismiss, focus restored to the original link. Credits and license links remain visible in the enlarged view. With JavaScript or native dialogs unavailable, each thumbnail remains an ordinary link to its full photograph. The new article alone loads this viewer and its scoped `river-rocks.css`; existing article and product viewers are unchanged.
