# Compass guidance, navigation, and Almanac promotion

October 15, 2026.

- Compass questions begin with a short explanation of recommendations, optional answers, saves and completion marks. Dashboard and public introduction use the same explanation.
- Shared sidebars say Return to My Gold Trail. The dashboard has a direct calendar link independent of customized modules. Calendar has a return link at the top of its sidebar and its header link remains visible at narrow widths or when the sidebar is collapsed.
- Nonmembers see a static illustrated Almanac promotion. The California public excerpt and preview links were removed; account promotion leads to Plus. Paying members retain the unchanged map and state research. Creators and their video links remain public.
- The same concise promotion is used on Plus, with billing details expandable and one disabled subscription button. Payments remain disabled.
- Promotion typography uses the shared body, heading and display sizes, regular/strong weights, more generous line height, and larger spacing around buttons.

Validation: existing Compass/dashboard tests passed. The promotion/access test now requires six illustrated highlights and absence of the old excerpt. Browser visual checks cover the introduction, sidebar return link, and new Plus promotion. A requested browser viewport override did not take effect (actual width stayed 1280), so do not report mobile screenshot verification; responsive CSS includes stacking and persistent Calendar return links.

Final validation: all 228 isolated-release tests passed and both builds passed. The parallel development run passed 253 of 254 tests; a calendar recurrence test failed during that concurrent run, then all 6 calendar HTTP tests passed when rechecked separately. No calendar recurrence implementation was changed.
