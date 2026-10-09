# Creator atlas

Route: /creator-map/. Uses published, non-sample, unarchived directory people and public regions; no schema migration required. Coverage relationships and existing primary directory regions place creators near approximate state/province centers. Each creator receives one nugget using their first mapped region; other documented regions appear in the popup. It does not use home addresses, infer coordinates from videos, or imply public access. Unknown/unrecognized regions remain in the searchable list. Stable decorative offsets separate creators sharing a region; they are not actual locations and do not change under filtering.

Setting icons derive only from explicit public topic connections (excluding equipment-discussed links). Panning alone is unclassified because it does not establish river work. A creator may appear in multiple settings; categories do not imply exclusive work. All creators use a gold nugget icon; setting categories remain optional filters. Review classifications as research grows.

Leaflet 1.9.4 loads from unpkg; OpenStreetMap tiles require network access and retain attribution. No geocoding, visitor location collection, nearest-site search or offline tile prefetching is performed. Creator cards remain readable when JavaScript or map assets fail. Production tile usage must follow https://operations.osmfoundation.org/policies/tiles/ .

The atlas now merges the 68-person public research roster from app/creator-catalog.json with published database profiles. Existing database names and biographies take priority. Draft, archived and sample database profiles are excluded, including from fallback routes. The 61 catalog-only creators have basic research profiles, not editable MariaDB records; promotion into the editor is separate work. Catalog lead entries explicitly say details are under review.

The full local preview checks all 68 profile destinations: seven use live published profiles, and the other 61 use local basic research profiles. Known broad international areas can be mapped, while unknown locations remain in the list. Nearby access locations and winter resources are separate future features and have not been advertised as functioning tools.

External HTTP links open a separate tab/window with noopener/noreferrer. The shared external-links.js also covers map attribution and links inserted later. Internal profile/map navigation stays in the current tab. The browser chooses whether _blank opens a tab or a window.
