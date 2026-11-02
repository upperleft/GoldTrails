# Gold sniping field guide

Article route: `/articles/gold-sniping/`. Local preview: `http://localhost:4173/articles/gold-sniping/`. Paul approved publication to GoldTrails.org on November 2, 2026. This is a research edition with explicit evidence limits, not a claim that footage review or matrix integration is finished. Production verification is recorded below after deployment.

## Source and build

- `scripts/build-gold-sniping.mjs` renders the complete article into `dist/articles/gold-sniping/index.html` and creates the blank CSV sample log. It runs in the existing build before asset versioning and site checks.
- `app/articles/tabbed-article.js` provides `renderTabbedArticle({id, label, sections, className, showAll})`. Each section has a stable `id`, visible `label` and trusted, repository-authored `html`. Labels and attributes are escaped; section HTML must not come directly from untrusted user input. Wrapper, section and generated tab IDs are checked for collisions.
- `dist/tabbed-article.js` progressively enhances the native section links. It supports nested guides, roving keyboard focus, arrow/Home/End keys, Enter/Space, shareable section hashes, browser history and Read all sections. ARIA tab roles and hidden panels are added only when the script runs. Deep links to content inside a panel reveal its ancestors. All content stays in the initial HTML.
- `app/articles/gold-sniping-traps.js` exports the six trap records and `renderTrapDiagram(id, {prefix})`. Diagrams have unique accessible title/description IDs and independent flow, potential-gold, scour and sampling layers. Use a unique prefix if repeating a scene on the same page.
- `app/articles/gold-sniping-evidence.json` retains source identity, provenance, setting, reported position, result, confidence and review status. This is a local article dataset, not a new content system or live research database connection.
- `dist/gold-sniping.css` extends the existing Gold Trails typography and palette. Responsive, reduced-motion, print and reading-dark-mode rules are included. Print and Read all expose every trap and section.

Future articles can use the tab renderer and enhancement script without copying interaction code. Trap diagrams are separate from the renderer; another article can supply its own illustrations and section content. The existing article directory and recommendation catalog include this guide.

## Editorial boundaries

All diagrammed gold positions are conceptual. The hero is an AI-generated illustration with an explicit caption; it does not document a discovery. Asset paths and the complete generation prompt are in `docs/gold-sniping-hero.md`.

Three geological/field citations and five official safety/access sources were checked. Two creator video identities were checked, and a free automatic-caption export supplies three timestamped reports from one video. Captions are not independent audio/footage verification. No measured yield, undisturbed gold position or safe/legal collection site is established. See `docs/gold-sniping-research.md` for provenance and outstanding work.

The original interactive demo, Gold Behavior Matrix and previously imported sniping findings were not found in this checkout. The article links available related articles and explicitly records the missing connection. `docs/gold-sniping-chatgpt-handoff.txt` is a one-message request for the original ChatGPT conversation to export those resources without fabricating replacements.

## Verification

The existing build pipeline passed, checking 22 HTML pages and 754 local links/assets. All 458 automated tests passed (453 existing plus five new article tests). Tests cover full static/no-JavaScript content, unique anchors and accessible SVG labels, current asset hashes, source ledger preservation, generated component validation, article discovery, and actual anonymous HTTP delivery of the article, images, interaction assets and sample log.

Browser checks cover desktop (1440px) and phone (390px), all five sections, nested trap selection, layer controls, arrow and End keyboard selection, shared trap links, Read all/Return to tabs, and horizontal overflow. All five panels fit a 390px viewport without horizontal overflow. No browser warnings or errors were recorded in the initial article view.

Checks used bundled Node 24.22.1 because Node/npm were not on the shell PATH. The repository declares Node 22; a Node 22 run remains a deployment-environment check. The build commands were executed directly from the existing `package.json` build script with the bundled Node executable. No new dependency was added. A package-manager wrapper unexpectedly attempted dependency installation; it was stopped, the moved existing modules were restored, and its temporary store was removed before final tests.

The release is limited to this article, its assets, reusable components, directory entry, build integration, tests and documentation. No production database changes are required.
