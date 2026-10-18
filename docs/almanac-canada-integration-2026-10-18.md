# Canadian Almanac integration — October 18, 2026

The existing Almanac now includes server-rendered guides for all ten Canadian provinces and three territories. The existing Canadian polygons open their canonical guide URLs, with the same map, zoom controls, gold nugget creator markers and public profile/video destinations. U.S. state research and geometry are preserved.

The import selects 94 documented, source-checked findings from the dated Canadian research library and 43 supporting sources. Planning interpretations, evidence-limit notes, unresolved gaps, conflicting dates and unscored report cards stay in the research library. Production notes preserve periods, units, geography and preliminary/approximate/lower-bound qualifications rather than presenting every number as a province-wide total. Missing public categories are omitted.

Canadian guides use the existing section layout and citation bibliography. Province/territory labels replace the U.S. state label, and the meetup link opens Gold Connections rather than a nonexistent U.S. state event route. Existing canonical Canadian creator profiles and video libraries are reused; no new creator records or guessed locations are added.

All Canadian page and API routes share the existing server-side Almanac entitlement check. Paid Plus members and active Friends passes can read them. Anonymous visitors, free members and expired passes cannot retrieve the research. Canadian IDs never enter U.S.-specific database queries. Responses remain private/no-store and vary by Cookie. The complete research source snapshot remains preserved under docs/research/canada-almanac-2026-10-18; its original publication-status field describes that full snapshot, not the separately approved website subset.

## Validation

- Full suite: 423 tests passed.
- After final navigation/source-label refinements: all 47 Almanac tests passed.
- Build: passed; 16 static pages and 579 local links/assets checked.
- All 13 Canadian HTML/API guides tested for Plus, Friends, free-member and anonymous access; Friends expiry tested.
- Every imported fact matched to its original research classification and text; all citation anchors reachable; production-statistic scope preserved.
- Browser checks: British Columbia guide; switching to Yukon through Region; Alberta map activation and refresh; desktop (1280), tablet (820) and phone (390) layouts without horizontal overflow.
- Screenshot: task outputs/Gold-Trails-Canada-Almanac-2026-10-18.png.

No payment configuration, account data, U.S. research or public creator permissions changed.
