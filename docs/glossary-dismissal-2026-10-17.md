# Glossary definition dismissal

Completed locally, not published. Definition panels now have a visible Close × button with a term-specific accessible label. Escape, clicking the same term again, and clicking outside also dismiss them. Only one definition opens at a time. Hover/focus previews remain, while closed panels respect hidden even when the term retains focus. Close/Escape retain keyboard focus on the term when appropriate. Filtering and sorting dismiss open panels. New Close labels are excluded from the glossary search index.

Root cause: CSS hover and focus-within rules overrode the hidden attribute applied by the original toggle script. The enhanced glossary now manages visibility explicitly and has a scoped hidden rule. No glossary definitions or citations changed.

Files: dist/glossary.js, scripts/build-glossary-regional.mjs, generated dist/glossary/index.html, tests/glossary-popups.test.js. Build retains 171 terms and all35 regional entries.

Also updated shared sidebar copy exactly as requested: “Gold Trails Plus unlocks the Almanac and Connections.” (app/plus/views.js).

Validation: all298 tests pass, including focused-term Close/Escape, repeat-click/outside dismissal, hover reopening and search behavior. Build14pages/492links. Browser checked Close, retained focus and display:none while term still focused, Escape, repeated click, outside click, and phone390 Close with no overflow. Screenshots: workspace outputs/membership-and-calendar-2026-10-17/glossary-close-desktop.png and glossary-close-mobile.png.
