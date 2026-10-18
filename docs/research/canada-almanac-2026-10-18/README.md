# Canada Almanac research library

Actual source check date: **October 18, 2026**.

This research pass covers **all 10 provinces and 3 territories**. It contains **114 cited findings and evidence/planning notes**, **46 source records**, and **12 scoped production statistics**. It preserves 41 open and 5 partly resolved research gaps, plus 10 conflicts or exclusions. Coverage does not mean every requested field has a verified answer.

**Integration update:** 94 documented findings and 43 supporting sources have now been imported into the working Almanac, with guides for all 13 Canadian jurisdictions. See [integration and verification details](../../almanac-canada-integration-2026-10-18.md). The full source snapshot retains its original research-only status and open investigations. Existing U.S. research, map geometry and public creator access are preserved.

## Read or reuse

- [Readable dossiers for all 13 jurisdictions](jurisdiction-guides.md).
- [Structured research and fact/source relationships](research.json).
- [Source catalogue, authors, dates and inspection scope](sources.json).
- [Comparison with rating status](comparison.md).
- [Objective report-card rubric and reasons for withholding scores](report-card-rubric.json).
- [Reusable state/province page content template](page-template.md).
- [Import and preservation rules](import-contract.md).
- [Validation results](validation-report.json).

## Material findings

Canada needs jurisdiction-specific access notes. Saskatchewan’s pan-only guidance excludes shovels and classifiers. BC and Yukon distinguish their limited pan-and-shovel activity from other equipment. Alberta separates nonmechanized hand panning from licensed sluicing. Ontario’s hobby policy is conditional enforcement discretion. Elsewhere, the reviewed general prospecting frameworks do not by themselves establish a stream-panning exemption. Follow each cited source and its scope in the dossiers.

Production is retained with its original geographic and historical bounds: a historic mine or camp does not become a province-wide total; preliminary annual mine production does not become a placer yield. Gold size is likewise locality- and deposit-specific.

## Remaining research

The largest shared gap is locality-specific seasons: climate and flow tools are verified, but individual station/gauge records have not been analyzed. Exact recommended months are therefore withheld. Recreational site access and representative placer-size distributions are also insufficient for a defensible nationwide numeric report card. No scores were guessed.

Québec’s Beauce chronology needs a directly retrievable source; Northwest Territories hobby permissions need fresh authoritative confirmation; Newfoundland and Labrador needs deeper Labrador-specific gold evidence. PEI has no verified gold occurrence in the sources reviewed, which is recorded as unknown rather than an invented discovery or zero production. Other district-level gaps are listed against the relevant category.

This is a reusable research foundation and an explicit investigation queue, not a claim that all Canadian prospecting questions are settled.

## Validation

Run from the repository root with Node 22:

```sh
node docs/research/canada-almanac-2026-10-18/validate.mjs
```

The validator checks all 13 map-region identities, required categories, unique identifiers, fact/source links, evidence labels, dates, scoped statistics and withheld scores. It does not replace factual review or a current land-status check. Website tests/build are unnecessary for these documentation-only files; no runtime code was changed.
