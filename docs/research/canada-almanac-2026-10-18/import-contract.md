# Import contract

This is an import-ready research schema, not a drop-in replacement for app/almanac/content.json. The current handler validates U.S. states and its Canadian map filters creator locations. Canadian guide routes require a deliberate later integration.

1. Keep canonical province/territory IDs identical to app/almanac/canada-provinces.json. Keep Canada country context; avoid collisions between Nunavut/Northwest Territories administrative regions and geological “provinces.”
2. Match existing records by stable identifier and source URL. Link/reconcile duplicates; never overwrite prior U.S. research or Canadian creator data. Preserve app/almanac/creators.js and docs/research/canadian-creator-locations-2026-10-18.json as canonical existing creator evidence.
3. Import a claim only with its sourceIds, locator, classification, checked date and historic scope. Source_checked means the named passage was inspected; it is not blanket editorial approval. Planning interpretations need review. Evidence_scope items usually belong in internal notes.
4. Keep all gaps, conflicts and partially resolved investigations in the research library. Do not render missing public fields as zero or invent filler. Do not import unresolved candidate URLs as verified citations.
5. Preserve numeric qualifiers such as approximately, greater than, preliminary and the geographic boundary in the visible statistic. Do not sum overlapping mine/camp/annual figures. Do not infer current mine operating status from historic documents.
6. Add no digging coordinates from this release. A mine coordinate or a creator’s hometown is not a public prospecting site. Any future location needs positional precision, source provenance and separate access evaluation.
7. Keep source publicationDate, reportingYear, updatedAt, consolidationDate and checkedAt distinct. Null publication dates must remain null. Recheck current land and water guidance during integration.
8. Provincial guides and map remain under existing Plus/Friends-preview server controls. Free creator profiles, directory and outgoing video links retain their public access. Preserve U.S. map design, controls and nugget behavior.
9. The five report-card fields remain null. Their rubric is defined, but jurisdiction assessments are withheld. Never convert null to 1 or compute an overall score from missing components.
10. During integration test province navigation, source links, creator filters, U.S. regressions, authenticated/unauthenticated/Friends-preview access, direct API denial and mobile layout. A docs-only research validation does not claim those website tests occurred.
