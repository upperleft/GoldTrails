# Compact Compass desk and text spacing

Prepared October 17, 2026 on `compact-compass-desk`, based on the unpublished dark-mode commit `a600265`. Local preview only; neither dark mode nor this cleanup has production publication approval yet. Production remains the approved brighter-nugget release `c7e7812`.

## Bounded screen audit

The user identified the local `/compass/demo/` screen and asked to clean up cramped text and replace the long square-card layout. Used the Product Design audit workflow with fresh browser screenshots before editing. User context preflight was performed with Node filesystem checks, honoring the user's instruction not to use Python; no Product Design saved context file existed.

1. **Entry and welcome — needed spacing.** `01-before-entry.png` and `02-before-cards.png` show the actual original 1280 × 720 preview. Welcome paragraphs and many resource paragraphs had computed zero margins; adjacent shortcut buttons and the following paragraph touched. A large duplicate welcome heading and metadata crowded the introduction.
2. **Desk overview — too long.** The default 18 expanded modules produced a 6,474 px document at the captured desktop viewport. Opening every module as a box made it hard to scan for a particular task. Existing hide/order settings were useful and worth retaining.
3. **Reading a recommendation — too dense.** Narrow modules stacked source labels, summaries, matching explanations and demo notes. The raw creator roster metadata was especially unhelpful as a dashboard label. A screenshot review cannot establish full accessibility compliance; keyboard and responsive behavior were tested separately below.

Screenshots are saved in the task workspace under `outputs/compass-cleanup-2026-10-17/`. This is a bounded audit of the Compass dashboard, not a site-wide accessibility audit.

## Implemented

- Kept existing recommendation records, profile data, module IDs, grouping, hidden settings, ordering, forms and server checks.
- Replaced square module cards with full-width native `details` rows and separator lines. The next adventure starts open; other rows open on demand. No JavaScript is needed to expand a row.
- Added progressively enhanced section filter buttons for the existing groups plus All sections. Counts reflect configured visible modules. Filtering uses a separate presentation attribute, never changes a user's saved visibility settings, and does not remove records from the page.
- Native button pressed states, a polite section announcement, native disclosure keyboard behavior, and focus return after hiding keep the interaction understandable. Move controls reorder within the selected group, or the full visible list in All sections.
- Added paragraph margins and 1.8 line height in reading areas, separated welcome shortcuts, shortened the introduction, and removed nested recommendation boxes. Kept heading/body/note typography consistent.
- Dashboard resources use short type labels instead of raw internal source metadata. Recommendation reasons become short bullets for known interest/goal/foundational phrases; unknown explanations and uncertainty caveats remain intact and escaped. Resource links, research and actual recommendation selection are unchanged.
- Updated the pending dark theme for rows and section buttons. No payment, entitlement, map or unrelated navigation change was made.

## Verification

- 32 tests passed across member-dashboard, Compass, and reading-options suites. Includes persisted layout ownership, CSRF/origin checks, profile-data preservation, demo isolation, source caveats and HTML escaping.
- Build passed: 14 static pages and 499 local links/assets checked. `git diff --check` passed.
- Browser: section counts/filtering, Enter on a summary, opening recommendations, moving an article later, hiding it, keyboard focus return, saving the example layout, reload persistence, and restoring defaults all passed. No real account data was changed; the preview rejects non-read requests, and example layout storage is browser-only.
- All 36 modules remain in the rendered page; switching sections left all 18 default visibility preferences intact.
- Desktop default document height decreased from 6,474 px to 2,420 px (about 63%). Sidebar content sets a lower limit on the total desktop height. Expanding more rows deliberately increases the reading area.
- At 390 px and at 200% text enlargement, there was no horizontal overflow. Recommendation paragraph line height measured 28.8 px at a 16 px font, with 14.4 px paragraph margins. Viewport and reading enlargement were reset after verification.
- Light/dark screenshots inspected; no warnings/errors in the checked preview browser log. Screen-reader testing and a full audit of all future/preview tools were not performed.

## Preview and handoff

`scripts/preview-reading.mjs` serves the read-only preview at `http://127.0.0.1:4335/compass/demo/`. It uses existing production renderers with public sample records and a fictional account only where needed. Do not deploy until Paul approves this cleanup and dark mode together.
