# Illustrated river-rock article

Completed and published October 17, 2026, America/New_York. Publication verification is recorded below.

## Content and integration

Added `dist/articles/identifying-river-rocks/index.html` using the existing article shell, navigation, metadata and reading controls. The draft's descriptions, contextual citations, g/cm³ units, approximate ranges, practical voice, podcast reference and copyright/assistance credit are retained. An independent editorial review prompted one factual refinement: igneous rocks cool and solidify, rather than necessarily crystallizing, because volcanic glass is possible. The pattern table says “very fine texture” rather than implying that chert's tiny crystals are necessarily visible by eye.

The article is listed once in the searchable/sortable Articles page and the shared published-article catalog, tagged for geology/beginner education. Internal links to the existing bedrock-maps and comparable-test-pans articles were confirmed. No retired Compass interface or new premium feature was introduced.

## Photographs

Thirteen individually verified, commercially reusable photographs cover all twelve required materials. Smithsonian and GeoDIL selections are CC0; the USGS Ryan Mountain gneiss photograph is explicitly public domain. Photographer/institution credits and source/license links appear beside every image and in its enlarged view. Optimized local enlargements retain the full frame; separate thumbnails limit initial page transfer. Large versions load when opened. The directory totals about 5 MB, most of which is not downloaded on initial reading.

Individual inspection records are in:

- `database/map-data/river-rocks-igneous-photo-inspection-2026-10-17.json`
- `database/map-data/river-rocks-metamorphic-photo-inspection-2026-10-17.json`
- `database/map-data/river-rocks-other-photo-inspection-2026-10-17.json`
- Portable asset credit index: `dist/assets/articles/river-rocks/credits.json`

The two limestone photographs are separate examples/localities. The quartz photo is an identified crystal, not a rounded pebble. The greenstone specimen is from Minnesota, not the separately discussed Shenandoah locality. Gneiss is photographed beside a trail. Captions do not imply common scales, river origin, or before-and-after relationships. No mandatory material lacks a photograph. No additional reliably identified and individually reusable river-worn photograph was selected.

## Technical sources actually checked

- Domokos, Jerolmack, Sipos and Török, *How river rocks round: resolving the shape-size paradox*, arXiv 1311.6574: experiments/model support early rounding before substantial axis-dimension reduction; roundness is not a mileage counter.
- British Geological Survey rock/mineral introduction and NPS igneous, sedimentary and metamorphic guides: rock families, cooling, composition, textures, foliation/nonfoliation.
- Missouri Geological Survey PUB2929, PUB2928 and PUB0661: transported quartzite/erratics, quartz hardness and occurrences, chert texture/fracture/colors and resistant gravel residues.
- NPS Curecanti and Shenandoah guides: gneiss/schist comparison and altered basalt/greenstone. No collecting permission is inferred from an educational source.
- USGS Yellowstone color explanation: iron-bearing colors and green alteration minerals. Dennis P. Cox's USGS polymetallic vein model was read by direct HTTP retrieval after the web reader was restricted; it describes quartz/carbonate gangue plus multiple minerals. A white vein is not treated as proof of gold.
- Penn State MNG230, section 8.3.1: all nine approximate rock-density ranges match its table. The Open University density section gives quartz 2.65 and gold 19.3 relative to water; the article distinguishes specific gravity from density units. Equal-volume arithmetic (265 g, 1,930 g, ratio approximately 7.3) was checked.
- Nick Zentner's January 3, 2020 episode #36 is explicitly a podcast identification lab, not a video.
- Wyoming State Geological Survey's gold overview explains the density contrast behind placer concentration.

The user's source-check date remains October 17, 2026 because these sources were actually rechecked that Eastern date. The article does not promise gold, infer immediately underlying bedrock from transported stones, or turn overlapping density ranges into diagnostic boundaries.

`river-rocks-source-links-2026-10-17.json` records 31 distinct external link checks: 23 reachable by direct request, eight automated-access restrictions with prior direct source verification, zero missing/404/410 links and zero other failures. Image rights are supported by individual record evidence, not inferred from a site's general government or museum status.

## Validation

- Full test suite: 353 passed, zero failures. Eleven new tests check the article, all image identities/hashes/dimensions, per-image provenance, nearby captions/credits, units/qualifications, catalog/listing, anonymous HTTP serving, and modal lifecycle/fallback behavior.
- Build: 16 HTML pages, 585 local links/assets checked. `git diff --check` passed. New CSS/JS follow content-based asset versioning.
- Browser: desktop 1280px, tablet 768px and phone 390px; no page-wide horizontal overflow. Paired rock entries become a single column on tablet/phone. Both tables fit at phone width. All thirteen large images were opened and confirmed loaded at the expected dimensions.
- Tested native Escape, Close button and enlarged-image dismissal; focus returned to the original photograph link. Enlarged view preserved its alt text and clickable credits/license links. Article search returns the new entry.
- Viewport restored after testing. Screenshots: parent workspace `outputs/river-rocks-article-2026-10-17/`.

Preview: http://127.0.0.1:4335/articles/identifying-river-rocks/

Implementation changed no accounts, payments, database schemas or unrelated site design. The subsequent authorized publication is recorded below.

## Publication verification

Paul approved publication: “Please go ahead and publish this.” Published release `15779af174a25df2ed134e4e235f8193c8f83ba1` through the existing GitHub main / Hostinger workflow on October 17, 2026. Included the pending bedrock article and glossary commit because the river-rock article links that destination. Publisher HEAD and origin/main matched the release.

Anonymous live requests returned HTTP 200 for the river-rock article, bedrock article, article listing and updated 183-term glossary. All 26 full/thumbnail image files returned 200. Ten WebP files matched committed hashes exactly. Hostinger recompressed the sixteen JPEG files; their dimensions matched and downsampled decoded-pixel differences were below 0.0035 normalized RMSE. The live enlarged granite image rendered at 1400 × 930; native Escape and Close dismissed it and restored focus.

Public URL: https://goldtrails.org/articles/identifying-river-rocks/

Evidence is saved outside the repository in parent-workspace `outputs/river-rocks-article-2026-10-17/live-verification.json` and `article-live.png`. The raw guest invitation remains private and is not part of this publication note.
