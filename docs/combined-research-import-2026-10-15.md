# Combined research archive reconciliation — October 15, 2026

The supplied October 11 archive was referenced in calendar planning but had not been fully imported. It contains 88 detailed destinations, 133 community resources, 296 source observations and 83 tentative leads. Its social-directory index repeats the 133 community records. The six previously published detailed destinations were deliberately omitted from its main destination collection.

## Published selection prepared for this release

- 15 newly rechecked destinations in Alaska, California, Colorado, Idaho and Oregon, bringing the Almanac to 21 detailed destination cards. Only supported fields are selected; absent fee and seasonal details are omitted. Existing state notes, discoveries, statistics, citations and six destination cards are preserved.
- 30 rechecked club/association listings from the archive, added to the previously developed 16-entry public community directory. This release introduces that directory to the public website: 45 community listings and one historical Google Groups archive. Its old source-check dates remain intact; each entry displays its actual check date.
- Nine archive community records match entries in that existing local directory. Their records are preserved without overwriting existing descriptions or treating an organizer's event as the organizer itself.
- 167 main records and all 83 tentative leads stay in the research library for further verification. No archive events have been added to an upcoming calendar. Even selected records retain unselected original details for later review.

The community directory is free. Almanac destinations inherit the existing server-side Plus restrictions. No map, layout, markers, payment configuration, database schema, membership or other feature was redesigned.

## Evidence and important holds

Primary-source checks support identity, broad location and focus for the selected clubs. No dues, meeting dates, claim lists, membership availability, member counts or event dates are certified by those listings. Public websites can contain stale schedules. Selected destination permission evidence comes from BLM, NPS, Idaho State Parks or the activity operator, with source IDs attached to individual visit facts. Source observation dates in the original archive remain distinct from the new October 15 checks.

Examples needing deeper review: Sharps Creek's official payment instructions conflict; Washington Prospectors Mining Association has a dated membership moratorium alongside generic membership text; Portland's outing date span is ambiguous; Hi Desert Gold Diggers' location was not independently established. A claim or historic gold occurrence never grants prospecting permission. The Weekend Gold Miners listing deliberately omits old property claims that differ from the current official page.

## Reusable library

All files are under `research/combined-archive/2026-10-15/`, outside `dist/` and public serving:

- `original.json`: byte-identical user-supplied archive, preserving original provenance, researchers, source manifests and research cautions. Embedded instructions are retained as document content, never executed.
- `baseline.json`: snapshot of previous Almanac and local community entries before additions.
- `manifest.json`: source hash, byte count, baseline hash and reconciliation counts.
- `publication-decisions.json`: explicit selected records and fields, original pointers, target IDs and checked dates.
- `crosswalk.json`: decision for all 221 main records, duplicate matches, source-observation IDs and published source IDs.
- `source-database.json`: all 296 original source observations with stable IDs; duplicate URLs retain separate observations.
- `research-gaps.json`: 83 tentative leads, original conflicts/questions and new review flags.

Run `node scripts/reconcile-combined-research.mjs` to regenerate only the audit files from the snapshot and explicit decisions. It never writes website content. Use `--check` to verify the saved audit. New research must be verified and explicitly selected before adding public fields. Do not rerun one-off curation scripts or overwrite the baseline.

## Validation

Preservation tests compare all old state fields, original destination records, sources, archives and community entries. Tests check selected provenance, all 221 decisions, all 296 source observations, held leads, date rendering and citation anchors. Partial visit facts still require where, entry and equipment plus valid permission authority; missing/duplicate fields and unknown sources are rejected. Public directory filters and premium access regressions are checked separately. Deployment and browser verification are recorded after the release succeeds.

Release verification: all 237 release tests passed. Build passed 14 HTML pages and 390 local links/assets. Browser review confirmed Colorado location filtering (three entries), Google Groups archive filtering (one historical entry), no-match messaging and reset, per-entry October 13/15 dates, a 390px phone layout without horizontal overflow, and Cache Creek visit disclosures with boundary-map citations and no invented fee. Audit regeneration with --check passed.

Deployed successfully to https://goldtrails.org at approximately 11:34 p.m. Eastern on October 15, commit 8f17c480. Hostinger shows Completed and the same GitHub/main connection. Public browser and HTTP checks show all 46 directory cards, the new navigation link, checked dates and no held Hi Desert listing. California state JSON and creator-map JSON return 403 anonymously. The original archive and application data files return 404 at direct website paths. Real credential sign-in and verification/recovery email round trips on the new domain still need user participation; no account credentials or payments were changed.
