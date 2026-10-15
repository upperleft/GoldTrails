# Regional glossary — 2026-10-15

Added 35 sourced regional prospecting words, historical slang terms, and tool names to the existing glossary. Total: 171; all 136 previous entries preserved verbatim.

## Reusable research

- Dataset: app/glossary/regional-terms.json; 19 source records linked to individual terms.
- Records distinguish slang, historical terms, ordinary translated words, community usage, and equipment-maker usage.
- Country labels document usage, not exclusive origin. Definitions do not establish current permission to prospect.
- References carry verification dates, publication dates where available, authors where established, and page/section locators. PDF links include page anchors.
- Original agency PDFs were inspected for the Gympie tool glossary, BRGM batée/couy descriptions, and Brazil DNPM terminology. Source records identify indexed-text inspection where direct full-page access was unavailable.
- Held aside: snifter as a suction-tool name, because the located usage was isolated and contested. No speculative origins or etymologies imported.

## Integration

scripts/build-glossary-regional.mjs merges additions into the existing static table during build without replacing the page shell or existing row content. dist/glossary.js supports country/alias/English-equivalent search, accent-insensitive matching, topic filtering, sorting, and keyboard/tap definitions. Added Regional words & tools filter and an expandable source bibliography.

## Validation

- Production build: 13 HTML pages, 354 local links/assets checked.
- Regression suite: 193 passed, zero failures.
- Content invariants: 136 original rows preserved; 35 additions; repeat generation is idempotent.
- Browser: fossicking query; batee → Batée; yabbie → Yabby pump; category → 35 entries; descending sort; Escape closes definition; source links visible.
- Phone viewport 390 × 844: no horizontal page overflow; definition and links remain accessible.

Published release 76ef08c to GitHub through GitHub Desktop; verified live on Hostinger 2026-10-15. Public glossary has 171 terms, 35 regional entries, 19 bibliography records, working query filtering, and expanded Fossicking citations opening in new tabs. Preview: https://lightcoral-hedgehog-977933.hostingersite.com/glossary/?q=fossicking
