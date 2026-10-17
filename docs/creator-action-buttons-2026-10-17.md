# Creator action buttons

Completed locally, not published. User requested Find on Map only for signed-in Plus members, with the creator video-library button moved to the far right in its former position.

The directory renderer defaults to no map buttons. Production passes the existing member-session store to the server. The server uses the existing Almanac entitlement check with member sessions only; an admin cookie alone does not grant button visibility. Membership lookup failures hide map buttons while keeping the public directory available. Personalized directory HTML has Cache-Control: private, no-store and Vary: Cookie. The existing server-side Almanac access gate remains unchanged.

Video library and eligible map actions share a right-aligned action group. On phones the actions sit below the description, aligned to the right. Existing video-library markup, counts, popup behavior, profile URLs and public access are preserved. No data, map, directory order, or navigation changes.

Validation: all 295 tests pass, including visitor/free/expired/invalid/Plus sessions, membership outage, admin-only session, Plus followed by visitor cache checks, and public creator profile/HTML/JSON video access. Build: 14 HTML pages, 492 local links/assets. Browser checked desktop1280 and phone390 with no horizontal overflow; video button right edge equals creator row right edge. Public video dialog opens with all26 Dan Hurd videos and direct YouTube links.

Files: app/prospectors-page.js, app/server.js, server.js, dist/creator-map.css, tests/creator-map-buttons.test.js; regenerated asset references in static HTML. Screenshots: outputs/membership-and-calendar-2026-10-17/creator-buttons-desktop.png and creator-buttons-mobile.png in the main workspace. Preview: http://127.0.0.1:4335/prospectors/?q=Dan%20Hurd (read-only public preview; loopback session16996).
