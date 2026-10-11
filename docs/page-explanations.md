# Optional page explanations

The checkbox at the top of the left field-desk navigation enables short Old Timer tips. Compact creator editors put the checkbox in their toolbar because their left navigation is hidden.

- Off by default. Only the `on`/`off` preference is stored in browser localStorage (`gold-trails-explanations-v1`); it is not an account preference and does not sync between devices. If storage is blocked, the switch still works for the current page.
- Hover or keyboard focus opens a tip; Escape dismisses it. The pointer can enter the bubble without closing it. Touch users press and hold a control; ordinary taps keep their original action. Scrolling cancels a pending hold.
- Navigation, search, filters, sorting, forms, product details, recommendation feedback, and dashboard layout controls receive explanations from `dist/site-help-content.js`. Dashboard headings explain connected/sample/future states. Existing glossary definitions, source previews, and map marker pop-ups keep their own behavior.
- Descriptions never read entered field values. Bubbles use textContent and preserve existing aria-describedby IDs. Help does not use AI, call APIs, or change account authorization.
- New unusual controls should supply a specific `data-help` description. Generic field and form tips explain basic behavior; source definitions remain editorial content.
- `scripts/version-assets.mjs` versions the CSS, entry module, and description module to avoid stale help after deployment. Static pages and the server shell include the assets. Product report pages allow same-origin scripts for help; inline and third-party scripts remain blocked by their CSP.

No database migration or new environment variables are required.

Verification: regression suite, help event tests (off/default, remembered preference, blocked storage, keyboard/ARIA, mouse bubble persistence, touch hold and scroll cancellation), and browser checks on homepage, articles, and dashboard demo. Narrow viewport verified at 390px. Touch event behavior is tested with a DOM fixture; no physical iPhone test was performed.
