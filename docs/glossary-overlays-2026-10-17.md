# Glossary definition overlays

Completed locally, awaiting approval to publish. Replaces the prior inline definition expansion, following Paul's approval of homepage-style overlay windows.

Selecting a term opens one centered cream-and-gold dialog, with its title, existing authored definition and original source links. The table stays unchanged, with source definitions hidden. Native dialog provides modal semantics and Escape closing; explicit Tab/Shift-Tab cycling keeps keyboard focus among the dialog controls. Close × and backdrop clicks dismiss it, reset expanded state and return focus to the term with preventScroll. Background scrolling is locked while open. On phones or with larger text, content scrolls while the title and Close control remain visible. Dark mode and stronger contrast are supported. Opening requires intentional activation, rather than automatically interrupting hover or keyboard navigation.

No glossary definitions, citations, checked dates, search data, categories or sort behavior were removed. All171 terms, including35 regional entries, are preserved. Existing inline hover fallback remains when JavaScript is unavailable.

Implementation: dist/glossary.js; new dist/glossary-overlays.css; scripts/build-glossary-regional.mjs and generated dist/glossary/index.html; updated tests/glossary-popups.test.js.

Validation: all299 tests pass; build14 HTML pages /493 local links and assets. Browser checked desktop1280, phone390, phone200% in dark mode, Close, Escape, backdrop dismissal, Tab/Shift-Tab looping, source links and unchanged table/scroll position after close. At phone200%, content scrolls with no horizontal overflow and Close remains on-screen. Explicit Escape check retained scroll277.5 and term top360.0625 before/after.

Preview: http://127.0.0.1:4335/glossary/?q=fossicking . Read-only loopback preview session19506. Screenshots in workspace outputs/membership-and-calendar-2026-10-17/glossary-overlay-desktop.png and glossary-overlay-mobile.png. No publication performed.
