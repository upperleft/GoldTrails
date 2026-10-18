# Design review: first ten findings

Implemented October 18, 2026 against the ten numbered findings in the October 17 review (`outputs/design-audit-2026-10-17/audit-findings.json` in the parent workspace). This covers findings 1–10, rather than the separate nineteen-step walkthrough.

## Completion record

| # | Finding | Result |
|---|---|---|
| 1 | Put page purpose ahead of mobile navigation | A native, initially closed Menu appears above page content. Main content precedes sidebar material in the DOM and on phones. Desktop keeps the full sidebar. Gold price and support remain available below the task on phones. |
| 2 | Introduce articles before contents | Five legacy articles now open with title, metadata, existing introduction and takeaways. The closed “In this article” disclosure follows, preserving all 32 existing jump destinations. The two recent articles already followed this order. |
| 3 | Consistent navigation and destinations | Shared server-rendered navigation uses “Creators & Videos.” Legacy `/creators-experts/` addresses redirect to `/prospectors/` with queries preserved. The artwork's duplicate Destinations route now discovers public creators. Premium navigation uses verified effective membership or an authorized guest read pass. |
| 4 | Put the creator first | One creator-name H1, documented location, direct channels and selected-video actions; no empty portrait/future-biography placeholders. Existing biographies and factual records remain. Research detail, dates, qualifications and source links are retained in closed “Sources & profile notes.” |
| 5 | Readable hierarchy | Clubs & Groups has a 32px H1, one short introduction and then search. Article body text is 18px with a 1.75 line height and approximately 65-character text measure. Glossary copy is shorter, and its topic selector is labeled “Topic.” Site reading preferences still work. |
| 6 | Reduce competing furniture | Optional Help is a small header disclosure. Article takeaways use a simple inset treatment within the article paper. The glossary and community directory no longer stack redundant introductory headings/panels. Existing warm parchment and gold styling remains. |
| 7 | Compact product comparison | Product rows emphasize name, short description, modest thumbnails, manufacturer link and secondary price. Availability, research dates, relationships, source notes and correction links remain in “Details & sources.” Image enlargement remains intact. |
| 8 | Explain Plus at the first decision | The Almanac, Gold Connections and $5/month USD appear near the page title. The approved Old-Timer hero, All 50 States emblem and detailed offer remain. The duplicate Plus sidebar pitch is omitted from Plus/support pages. Payments remain disabled. |
| 9 | Match account access to entitlement | Reverified the existing account fix. Free and missing/expired effective entitlement do not expose Connections in Your Camp. A fictional effective Plus account retains the shortcut and premium navigation. |
| 10 | Adapt artwork navigation and sales text | The existing homepage artwork asset is unchanged. Important headings, navigation labels, benefits and pricing are live HTML over it. Creators & Videos is prominent; public rows offer Products and Clubs & Groups. Larger hero/card help targets fit without colliding with links. The narrow sidebar help targets retain their existing 24px minimum. Text view, phone/tablet fallback and reading controls remain. |

## Main implementation areas

- `app/site-navigation.js`, `app/server.js`, `dist/design-refinements.css`: shared navigation, verified entitlement filtering, HTML cache protection, content order and responsive reading layout.
- `dist/site-help.js`, `dist/site-help.css`, `dist/home-art.js`: compact optional help, coordinated with the illustrated/text homepage.
- Creator page/view modules and `dist/creator-map.css`: public creator hierarchy and notes.
- Product/community renderers and styles: compact rows and useful directory openings.
- Homepage renderer, hotspot configuration and styles: live lettering over existing artwork.
- Five legacy article HTML files: introduction before optional contents.
- Plus views/markup: early price/benefits cue without a repeated sidebar pitch.

## Verification

- Full Node regression suite: **384 passed, 0 failed**.
- Production build/site check: **16 HTML pages; 585 local links/assets checked**.
- New regressions cover nested article/form/dialog preservation while moving the sidebar; idempotent transforms; legacy redirects; verified effective entitlement, guest access and failures; static/dynamic HTML cache privacy; unchanged asset responses; article jump links; and retained creator/product content.
- Browser checks at **390 × 844, 768 × 1024 and 1440 × 1000**: representative page hierarchy, navigation, horizontal overflow, article contents, product search/photo enlargement, public creator video dialog, Plus offer, homepage artwork and text fallback.
- Tested text at 200% and dark mode, then reset the preview preferences. Free and Plus account checks used fictional local fixtures; no real account or payment records were changed.
- Screenshots and the full test report are in the parent workspace's `outputs/design-fixes-2026-10-18/` directory.

## Delivery state

Saved locally for review. **Not published to Hostinger.** The read-only preview is `http://127.0.0.1:4344/`; it uses public catalog content and a fictional free account only. No production data migrations, payment activation or research changes were made.

Decorative logo lettering and the artwork's small handwritten quotations remain part of the image. Important actionable text is live HTML. The narrow illustrated-sidebar help buttons retain their existing dimensions; enlarging them further would collide with adjacent links.
