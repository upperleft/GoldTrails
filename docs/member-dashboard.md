# Gold Trails member dashboard — Phase 1

Implemented October 10, 2026. This expands the existing Compass member dashboard; it does not replace authentication, subscriptions, recommendations, the creator map, or public content.

## Open and customize

- `/compass/`: existing authenticated subscriber dashboard; returning members keep their existing onboarding behavior. Free accounts retain the existing feature preview.
- `/compass/demo/`: isolated public prototype using two fictional member profiles and real public catalog records. Switch between the New England panner and experienced Colorado detectorist.
- Choose **Customize my desk** to show/hide modules and choose positions. Earlier/Later/Hide buttons on visible cards also work with a keyboard. Choose **Save layout** to persist; **Restore default desk** restores the initial 18 cards; **Show every module** exposes all 36.
- Signed-in layout preferences persist in `compass_profiles.answers_json.dashboardLayout`, using the authenticated account ID and optimistic profile revision. Existing answers, onboarding progress, activity, inventory, and consent are preserved. Normal profile editing also preserves the layout.
- The public example stores ONLY module order and hidden IDs in browser local storage (`gold-trails-dashboard-demo-v1`). It never reads member sessions, member records, or AI services. The sample packing checklist is intentionally not persisted.
- No new tables, migrations, environment variables, dependencies, external providers, AI calls, or paid services are introduced. The existing migration 006 must already be installed for authenticated Compass use.

## Module inventory

“Connected” means integrated with existing site functionality, including honest empty states when supporting data is absent. On the public example, personal values and activity are explicitly illustrative. All future previews are read-only: there are no pretend submission controls.

| Module | Status and limits |
| --- | --- |
| Welcome/profile | Connected: broad region, interests, experience, goal; existing profile editor |
| Your next adventure | Connected: existing grounded recommendation and published article |
| Learning progress | Connected: recorded article/video completions; no skill certification claim |
| Dashboard customization | Working: visibility/order/default restoration, persisted per member |
| My Gold Maps | Connected to creator coverage map; personal saved layers are future work |
| Saved Rivers and Locations | Connected to saved vetted destination records; empty if none exist |
| Research a River | Future preview: source-based research outline |
| Regional Prospecting Guides | Future preview: regional collection outline |
| Historical Gold Discoveries | Future preview: dated source/geography outline |
| Weather and River Conditions | Future preview: no live readings or provider |
| Prospecting Regulations | Future preview: no claimed permission or live rule service |
| My Learning Trail | Connected: existing ordered learning recommendations |
| Recommended Articles | Connected: actual published articles, existing completion/save/tuning controls |
| Recommended Videos | Connected: verified indexed resources only; honest empty state |
| Favorite Creators | Connected: selected/saved actual creator records; recommendations if none saved |
| Digital Bookshelf | Future preview: no downloads, invented titles, or imported books |
| Prospecting Glossary | Connected: existing searchable glossary |
| Ask the Old Timer AI | Connected: existing grounded guide; optional configured AI and consent unchanged |
| Learning Achievements | Connected: actual passport achievements; illustrative in example mode |
| My Equipment Shed | Connected: existing category/inventory data and passport inventory editor |
| Equipment Wish List | Connected: existing saved product records |
| Equipment Comparison | Future preview: comparison criteria only |
| Recommended Equipment | Connected: actual catalog; owned categories suppressed by existing scoring |
| Equipment Maintenance Notes | Future preview: no note collection |
| Trip Planner | Future preview: example trip outline, no trip creation |
| Prospecting Calendar | Future preview: no bookings, invented events or reminders |
| Packing Checklist | Interactive demonstration: ephemeral checkboxes, no saved trip association |
| Field Journal | Future preview: no field-note collection |
| Gold Finds Log | Future preview: no private discovery collection |
| Photo Gallery | Future preview: no upload input or location-bearing photo collection |
| Trip History | Future preview: no invented personal trip history |
| Community Discussions | Future preview: no fabricated member posts or discussion submission |
| Member Field Reports | Future preview: no member reports collected or published |
| Followed Locations | Future preview: no feed or inferred visits |
| Creator Updates | Future preview: no invented recent videos or update feed |
| Prospector’s Vault | Nonfunctional preview; zero-knowledge encryption is NOT implemented; no GPS, finds, photos or notes accepted |
| Privacy Settings | Connected: existing privacy/AI-consent editing and Compass deletion controls |
| Data Export and Account Controls | Connected: existing Compass export and account view; account closure/billing management remain absent |

## Files and storage

New reusable module registry/validation: `app/compass/dashboard-layout.js`; shared cards/forms: `components.js`; dashboard renderer: `dashboard.js`; isolated public example: `demo.js`. Existing `views.js`, `handler.js`, `store.js`, and `recommendations.js` integrate those pieces. New `dist/member-dashboard.css` and `.js` provide responsive cards and progressive enhancement. `tests/member-dashboard.test.js` covers persistence, authorization, isolation, private-preview restrictions, source validation and cache behavior.

Layout writes use the existing same-origin/CSRF/subscriber checks. The store locks the account/profile and rejects stale revisions. No posted account ID is trusted. Layout changes are excluded from recommendation fingerprints, avoiding needless cache churn. Existing profile export/delete naturally include/remove layout data. Browser storage contains no real member profiles, postal codes, findings, credentials or account identifiers.

## Verification

- Full Node suite: 95/95 passing, including nine dashboard checks.
- Build: product catalog generation, asset versioning, and site validation pass (57 products, 13 static HTML pages, 280 local links/assets). Dynamic Compass routes are covered by HTTP tests.
- Browser: hide, move, restore, show all, position selection and keyboard Save; example layout survives reload.
- Responsive: 390×844 phone, 768×1024 tablet and normal desktop, with no horizontal overflow. Temporary viewport overrides restored.
- MariaDB writes verified through transaction/query tests; no new schema was needed. Physical cross-device login and a live member-layout save have not been exercised as separate manual tests.

## Phase 2 priorities

1. Review the default modules with real members and simplify before adding more tools. Keep the comprehensive registry available behind customization.
2. Add saved packing lists and basic trip plans with ownership, revision protection, and export/delete coverage. Establish the boundary between ordinary planning preferences and sensitive field records before storing notes or locations.
3. Enrich verified article/video metadata and timestamp evidence. Expand reviewed destination/access records before promising nearby permitted prospecting or distance calculations.
4. Add equipment comparison from verified specifications and source freshness; improve saved-content filtering if the lists grow.
5. Add a sourced creator-update feed, then evaluate community reporting and moderation requirements.
6. Weather/rivers need provider coverage and freshness/error rules. The encrypted vault requires its own specification and security review; no custom cryptography belongs in this prototype.

## Technical limits

Personal map layers, trips, weather, community feeds, books and secure field records remain previews. The existing AI guide is optional; this phase does not create an AI recommendation service. Recommendation breadth depends on real published records. Unsupported video/destination records remain empty rather than fabricated. Changes to the module registry in a future release should include a layout-version migration policy; this prototype safely falls back to defaults for malformed or outdated layouts. Authenticated layout saving uses ordinary server forms and retains a no-JavaScript fallback; public-demo saving needs JavaScript and reports browser-storage failures.
