# Bedrock maps article and glossary additions

Prepared and checked October 17, 2026 (America/New_York). Saved locally for review; not deployed.

## Website changes

- Added `dist/articles/how-deep-is-bedrock/index.html` using the existing article shell, editorial attribution, metadata, reading controls, and source-list format. Approximately 960 words before the reference list, including the contents and takeaway labels.
- Added the article to the existing searchable/sortable article listing and shared published-content catalog. The retired Compass interface remains retired.
- Added scoped `dist/bedrock-article.css`: blue underlined links, readable heading spacing, and a captioned comparison table with scoped headers and its own keyboard-accessible horizontal scrolling area on narrow screens.
- Added 12 sourced glossary terms: Depth to bedrock, Bedrock topography, Lithic bedrock, Paralithic bedrock, Densic bedrock, Soil horizon, Topsoil, Unconsolidated sediment, Crystalline basement, Quaternary, Pleistocene, and Holocene. The glossary now has 183 terms. Existing Bedrock, False bedrock, Overburden, and all other original/regional definitions are preserved.
- Stored reusable definitions, aliases, related terms, references, source locators, and actual check dates in `app/glossary/bedrock-map-terms.json`. The normal glossary build imports them, rejects duplicate names/unsafe citations, and remains idempotent. Updated the homepage's existing glossary count.

## Source verification and editorial decisions

All three requested resource descriptions were opened and read, including the national model in the browser. Live Web Soil Survey labels were checked through Area of Interest, Soil Data Explorer, Soil Properties and Qualities, Soil Qualities and Features, Depth to Bedrock, and View Description. Its description includes lithic, paralithic, and densic bedrock, representative values, and reporting limits. The walkthrough uses the general report, not an unverified claim that hard-rock-only output is available for every survey area. Close the description with Escape before requesting View Rating. The sample AOI used to inspect the interface is not presented as a gold locality.

The NRCS soil guide is dated July 2015 in its footer; its 2024 upload path is not its publication date. The glaciated-region maps are Soller and Garrity (2018), SIM 3392, at 1:5,000,000. The national data release is Sweetkind, Zellman, and Goldberg (2024; version 1.1 April 2025), with 2.5-km cells and region-dependent geological boundaries. It must not be treated as a shovel-depth lookup. The USFS/BLM crevice discussion is on printed page 8, PDF page 12.

The two short excerpts are USGS Gold's “often concentrated on or near bedrock” and Soller/Garrity's “provide a regional overview.” Both are attributed beside direct source links. The example is expressly hypothetical; mapped soil depths are distinguished from stream gravel, and interpretations are labeled. The Klamath study concerns ancient mineralization; modern earthquake counts are not presented as a prospecting predictor. No new map layers are claimed for Gold Trails. No video was inserted without a verified relevant example or timestamp.

`bedrock-source-links-2026-10-17.json` records HTTP checks and browser verification. Automated 403 responses from three USGS landing pages were distinguished from unavailable pages. The Publications Warehouse SIM 3392 record returned HTTP 500; the redundant article link was replaced with both direct map-sheet PDFs, which returned HTTP 200. The requested USGS resource landing link remains in place.

## Validation

- Full suite: 342 tests passed. After the final densic entry and map-download link changes, all 27 focused article/catalog/glossary tests passed again.
- Build: 15 HTML pages and 531 local links/assets checked; `git diff --check` passed.
- Browser: desktop at 1280px and phone at 390px; no page-wide horizontal overflow. Phone at 200% text with dark mode also stayed within the viewport. The table scrolled independently with keyboard input. Restored reading preferences and viewport afterward.
- Confirmed article search finds the new article, title sorting works, contents links resolve, glossary search finds the new entries, sourced definitions open, Close and Escape dismiss them, and Escape returns focus to the initiating term.

Preview: http://127.0.0.1:4335/articles/how-deep-is-bedrock/

Screenshots are in the parent workspace's `outputs/bedrock-article-2026-10-17/` directory. No production data, membership rules, payments, or deployment settings changed.
