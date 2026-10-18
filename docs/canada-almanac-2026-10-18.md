# Canada on the Gold Almanac map — October 18, 2026

The existing premium Almanac map now extends into Canada. This is the same source application and deployment used by paying members and the existing read-only friends invitation.

## Implemented

- Added all 10 Canadian provinces and 3 territories to the existing map using adapted Statistics Canada 2021 cartographic boundaries. The official WGS84 source, metadata, licence, source checksum, projection parameters and an offline Node compiler are retained under `database/map-data/` and `scripts/build-canada-map.mjs`.
- Preserved every existing U.S. state path, label, Alaska/Hawaii inset and first-recognized-region creator placement. The same Leaflet controls, gold nugget artwork, popups, public profile links and video-library dialog are reused.
- Canadian regions use the matching plain Albers projection; they never pass through the U.S. composite projection's Alaska/Hawaii clip areas. The map extent expands to include both countries.
- Seven Canadian creator markers: Dan Hurd, Pioneer Pauly, Yukon Dan, Utmost Outdoors, Crux Prospecting, Nick Molnar and chercheurs d’or du Québec. The last two add Ontario and Québec coverage, with two checked videos each.
- Dan's official site publicly identifies Peachland. A rounded NRCan town reference locates that marker; it is not a home, claim or prospecting-site coordinate. Other markers show broad documented coverage. Vancouver Island is also indexed under British Columbia so Pioneer Pauly appears in the provincial filter.
- Province/territory clicks filter Canadian creator coverage, with keyboard support and working non-JavaScript filter links. The Canadian roster appears below the same map. Unlocated and other international creators remain in the existing list.
- Existing creator research and video libraries are preserved. New and updated regional facts, first-party sources, verification dates, and held-aside candidates are recorded in `docs/research/canadian-creator-locations-2026-10-18.json`.

## Scope and access

The 50 detailed research guides remain U.S. state guides. Canadian selections currently provide verified creator discovery; they do not claim province-by-province geology, production or legal-access research. The interface explains that distinction.

Creator profiles and video libraries remain public. The map and its Canadian marker data retain existing server-side Plus/guest checks. No new payment, account, writing, personal-data or administrative entitlement is introduced. The existing friends invitation keeps its original expiry and read-only scope; its raw URL remains outside Git.

## Validation

415/415 full project tests and 38 final focused Almanac checks pass. The production build checks 16 HTML pages and 579 local links/assets. Tests cover all 13 Canadian identities, actual source coordinates/checksum, projection and bounds, unchanged 50 U.S. outlines and placements, province filters, original research/video preservation, and paid/guest versus anonymous access.

Browser checks at 1280px and 928px: province selection, British Columbia's four matching creators including Pioneer Pauly, Dan's town popup, Ontario discovery, and Pauly's 10-video dialog work without horizontal page overflow. Exact phone viewport rendering was not independently verified because the available viewport override does not apply to the existing browser tabs; the narrow-screen map and controls retain their responsive rules.

Production publication and live checks are pending.
