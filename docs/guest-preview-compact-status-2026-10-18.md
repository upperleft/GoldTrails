# Compact guest preview status — October 18, 2026

The guest preview bar remains visible as a small, single-line status strip on guest pages. It shows “Guest preview · Read-only · Ends [date]” and a short Leave control. The full expiry and participation notice remains in the summary title; the expiry also retains its machine-readable datetime.

The strip has a 30px minimum height, compact spacing and a 24px minimum-height Leave button. Narrow screens hide the secondary Read-only phrase; only the summary can truncate, leaving the Leave control available. The longer welcome text and repeated feature shortcuts were removed.

Only the presentation changed. Pass validation, expiry enforcement, private response headers, read-only access, and the same-origin POST used to leave the preview are unchanged. No payment or account changes are included.

Validation: **405 tests passed, 0 failed**; build passed with **16 HTML pages and 579 local links/assets checked**. No browser visual inspection was performed for this small follow-up.

Saved for the user-approved publication together with the consolidated homepage release. **Publication is pending; this change has not been deployed by this task.**
