# Almanac research publication · 15 October 2026

This release integrates 80 individually cited research selections across 41 state guides: 76 notes and four statewide historical production statistics. The other nine states retain existing sourced material; duplicate and unverified additions were not imported. All 50 state routes remain available.

New notes cover deposit geology, associated minerals, particle size, historical mining, site-specific seasons, scoped access guidance and geological maps. Every note includes a source and locator with its actual review date. California (1848–1965), Georgia (1830–1959), North Carolina (1799–1960) and Michigan (through 1959) gain dated, qualified historical production figures. Cornwall and Coker Creek quantities appear only as mine/district notes, never statewide totals.

Existing Almanac records are preserved. Draft Tennessee access rules, conflicting permit/season statements, provisional editorial report-card scores and unsupported statewide best-month recommendations remain unpublished. Existing references and original verification dates remain intact. No database migration is required.

The release also includes the previously requested Almanac cleanup: no default map selection, no search dropdown, hidden empty fields, supported discovery histories, Texas research and sourced state birds without tree decorations. Typography variables are scoped to the Almanac so it can be deployed independently of the unfinished dashboard work.

Validation: complete release suite 193/193 passing; production build checks 13 static pages and 353 local references. Desktop and 390px phone checks passed, including bird loading, no horizontal overflow, direct state URLs, the unselected map and client-side selection of Texas with its new Llano note. All 50 state renderings have resolving citation anchors. Regression tests preserve the pre-import state records and reject held/unattributed research notes.

This isolated release starts from live GitHub main a230564b5f866ee276e0f9d2e07f5f74666012cc. It contains only Almanac application/assets/tests and this note. The full dated research library and publication decisions are retained in the working research repository; no research-only files are served publicly.

Deployment verified: application release `84cea9f0cf71d9647bbbe9a9f564d671e04528dc` is live. All 50 public state pages, all 80 imported research records and their citation anchors, all 28 used bird assets, the unselected map and connected database output passed live checks on 15 October 2026. A full verification report and screenshot are saved in the task outputs directory. This post-deployment note is retained locally; the published commit records the pre-deployment check.
