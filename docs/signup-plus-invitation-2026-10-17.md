# Signup Plus invitation

Requested behavior: after registering, show a modal advertisement for Gold Trails Plus with Maybe later and Yes, subscribe.

Implemented immediately after a confirmed signup request, before email verification is completed. Both fresh and duplicate signup requests show identical content; the invitation makes no account-created or paid-access claim. Verification instructions and account-recovery links remain underneath. Validation errors, mail failures, throttling, sign-in and verification pages never open the offer.

The modal reuses the existing Old-Timer artwork and Western display type. It advertises only the approved 50-state Almanac and Gold Connections, at $5/month USD. Yes, subscribe goes to `/plus/` for details. All payment routes remain disabled, with no entitlement or database changes from choosing either action.

The normal HTML POST and enhanced JSON submission paths both support the invitation. In the enhanced path the existing dialog moves into the confirmation card before the success event. The native HTML path includes a no-JavaScript fallback. Reading controls are retained on HTML confirmation pages. Dismissal is supported through Maybe later, Close and Escape; focus returns to the signup confirmation. Focus remains inside the modal while open. A per-history-entry flag prevents the offer reopening when returning from Plus details; no account identifier or persistent marketing profile is stored.

Validation: 34 targeted tests passed across signup invitation, members and Plus. The build passed with 14 HTML pages /493 local links/assets. Browser checks covered desktop1280×720, phone390×844, dark mode with200% text, no horizontal overflow, sticky Close while scrolling, Tab containment, Escape, dismissal/focus restoration, initial signup without an offer, Yes→Plus and Back without a repeat offer. No console errors on the final navigation check. The browser fixture uses actual member-handler responses with no database or email provider; real signup, email delivery and payments were not exercised in the browser.

Screenshots are in the parent workspace at `outputs/signup-plus-offer-2026-10-17/`. The isolated preview is `scripts/preview-signup-plus-offer.mjs`, loopback4341. It uses fictional data and accepts no external write requests.

The user's additional Plus-perk request remains a proposal: original, source-linked research reports comparing methods/equipment with verified video timestamps. It is not implemented, advertised or included in the offer.

Saved locally; not published.
