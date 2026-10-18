# Friends calendar and compact product photos — October 18, 2026

The same Gold Trails source and Hostinger deployment serve the public site and the existing Friends invitation. No separate preview deployment or new invitation is created.

Status: **published at `bf4331c118a4b76a3cbc2b0322e11b1854d00865`**. The clean deployment checkout matches `origin/main`.

## Changes

- Valid invited guests can open `/calendar/` without registering. The existing FullCalendar library, styling, Month/Week/Day/Agenda views, date navigation and search are reused in a read-only tour with clearly labeled fictional events. Event details open in a closeable dialog. No examples are saved, and no private calendar API is called. Signed-in members continue using their own existing planner. Anonymous visitors retain the registration screen; expired or revoked invitations lose tour access.
- The compact guest status appears on the fictional tour only. Personal account pages, authenticated calendars and calendar APIs remain excluded. The pass expiry and guest permissions remain unchanged.
- Product photos sit side by side at their existing enlarged size, preserving click-to-enlarge and click-to-shrink. The first two measured desktop listings shrink from 317px to about 196px. On narrow layouts the image pair moves below the text and remains horizontal.
- The three bottom homepage browse buttons no longer have extra question-mark controls. Their centered labels cover the obsolete marks in the approved artwork. Other help controls remain. Mouse/touch focus outlines are suppressed while keyboard focus indicators remain visible; the persistent expanded-help outline is removed.

## Validation

420/420 regression tests pass, including guest expiry/revocation, no private-store access, private API rejection, genuine member calendar isolation, and existing homepage interactions. The production build checks 16 HTML pages and 579 local links/assets.

Browser checks at 1280px and 928px cover calendar Month/Week/Day/Agenda navigation, search, event details and close, homepage button appearance, no outline after a pointer click, visible focus after Tab, and product image enlargement/shrink. No horizontal overflow at these widths. Exact phone viewport rendering was not independently verified because the available viewport override does not apply to existing browser tabs; the existing narrow-screen styles are retained.

Publication verification is recorded outside Git in the workspace `outputs/friends-calendar-products-2026-10-18/` directory. Invitation credentials are not recorded in this document.

**23/23 live checks passed** after publication. They confirm the original invitation exchange, working guest calendar HTML and separate client, exact deployed styles/scripts, unchanged private calendar API rejection, anonymous registration gate, unchanged Almanac/Connections access, and the removed bottom help controls. Live browser checks confirm guest calendar details open/close and product photo pairs remain 116px square, aligned side by side, in rows measuring about 196px high. `live-homepage.png` and `live-calendar.png` retain visual evidence outside Git.
