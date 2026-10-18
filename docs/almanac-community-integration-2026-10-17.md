# Clubs & Groups in the State Almanac

Implemented October 17, 2026. Saved locally; not deployed to Hostinger.

## What changed

- Each state guide now has a **Clubs & groups** section and a section-navigation link. The same section is returned by the existing state-selection API.
- Listings show the original name, location, summary, website/social links, membership/access notes, verification scope and source-check date. **Full listing & sources** opens the existing public directory entry and its source notes.
- The standalone `/clubs-groups/` directory remains public for visitors and free members. Almanac HTML and JSON retain the existing server-side Plus checks.
- No records, research, check dates, database relationships or public directory content were rewritten. The existing map, controls, creator markers and popups are unchanged.

## Matching and maintenance

`app/community-catalog.json` remains the single source. `app/almanac/communities.js` selects existing listed records using explicit state names in the reviewed `region` field, sorts them alphabetically and returns the original objects. The explicit **Oregon & Washington** region appears in both states. Names, city text and broad geographic descriptions are not used to infer a state.

There are **39 unique local listings across 18 states**, producing 40 state appearances: Arizona 5, California 8, Colorado 3, Georgia 2, Idaho 2, Massachusetts 1, Missouri 1, Montana 1, Nevada 2, New Mexico 1, New York 1, North Carolina 1, Ohio 1, Oregon 3, South Dakota 1, Texas 1, Virginia 1 and Washington 5.

The remaining **32 states have no state-specific catalog listing yet**. Their sections explain the coverage gap and link to the free directory, which also contains nationwide and online communities. This does not imply that those states have no clubs. Nationwide, worldwide, Australian and historical entries are not presented as local state groups.

Future checked records added to the public catalog with an exact state-name region (or explicit `State & State` region) appear in the Almanac automatically after restart/deployment. Other region formats require extending the matching rules deliberately; do not infer memberships from names or addresses.

## Verification

- Build passed: 14 HTML pages; 493 local links/assets checked.
- 50 targeted tests passed: Almanac community integration, public community directory, Almanac content, client selection, Plus authorization and unified creator map regressions.
- New integration tests cover all 50 state projections, catalog identity/immutability, exact state matching, shared Oregon/Washington coverage, Virginia/West Virginia separation, excluded broad/foreign/archive listings, HTML escaping, safe outbound links and original provenance.
- HTTP tests confirm anonymous/free public directory access (200), active Plus state HTML/API access (200), and anonymous/free state HTML/API denial (403), including after the state cache is warm.
- Browser verified California rendering, Oregon selection through the existing map, section navigation, keyboard-operated notes, safe outbound links and the public directory permalink opening its source notes.
- Phone check at 390 × 844: readable wrapping; document width and scroll width both 390px; no browser console errors in the checked flow. Temporary viewport override reset.

Read-only fictional Plus preview: `node scripts/preview-almanac-communities.mjs`, bound only to `127.0.0.1:4342`. This separate preview uses no real account, database or mail service and rejects writes. It is not the production server or an access-control bypass in the application.

Screenshots are saved under `outputs/almanac-communities-2026-10-17/`.
