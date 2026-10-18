# Compact guest preview status — October 18, 2026

Status: **published at `a05dbfba83edfdc9848cf0aac787d93142e8abb8`** on https://goldtrails.org/. The public site and the existing friends invitation use the same release.

The guest preview bar remains visible as a small, single-line status strip on guest pages. It shows “Guest preview · Read-only · Ends [date]” and a short Leave control. The full expiry and participation notice remains in the summary title; the expiry also retains its machine-readable datetime.

The strip has a 30px minimum height, compact spacing and a 24px minimum-height Leave button. Narrow screens hide the secondary Read-only phrase; only the summary can truncate, leaving the Leave control available. The longer welcome text and repeated feature shortcuts were removed.

Only the presentation changed. Pass validation, expiry enforcement, private response headers, read-only access, and the same-origin POST used to leave the preview are unchanged. No payment or account changes are included.

Validation: **405 tests passed, 0 failed**; build passed with **16 HTML pages and 579 local links/assets checked**. After publication, all **49 live HTTP, asset-byte, navigation and access checks passed**. The existing invitation still exchanges successfully and opens the guest homepage; guest Almanac/Connections access and anonymous/private-calendar restrictions remain intact. No invitation credential is recorded here.

Live browser inspection at **1280 × 720** confirmed a 30px bar, artwork starting at y=30 and ending at y=720, and no page overflow. Reading Options/Done and Text View/Return worked. The native layout was also checked at 1027px width. **An exact phone-size render was not verified in this release.** Evidence outside the repository: task workspace `outputs/homepage-compact-live-2026-10-18/live-verification.json` and `desktop-friends-preview.png`.
