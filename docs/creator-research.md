# Evidence-backed creators and waterways

Two existing stores remain separate: the private SQLite research library contains the 68-record research roster; the website MariaDB contains published/editor-managed people. No production records were changed by this work.

005 is an additive, repeatable migration using new tables and INSERT IGNORE for its marker. Existing 001–004 are unchanged. Take a full backup before applying DDL; MariaDB DDL commits implicitly. A partial failure can be retried only after inspecting table definitions. Never drop populated tables as recovery.

New tables: creator_profile_claims, creator_channel_identities, waterways, creator_waterway_evidence, creator_research_conflicts. Reuse existing people IDs, channels and their unique platform/external_channel_id when checking identity. The import never creates creators automatically. Missing slugs are reported for mapping, avoiding duplicate public people. Profile claims hold source URLs, locators, concise private evidence notes, assessment, checked/statement dates and review state. All imported website rows default to draft; no startup/build migration or automatic publication occurs.

Supported fields: public name, bio, channel ID/canonical URL, Joined YouTube, earliest/latest publicly available prospecting video dates, explicitly stated prospecting start year, experience wording and statement date, video count and exact/approximate/historical basis, website/social links, prospecting-content regions, specialty tags. Dates and counts remain null/absent unless supported. Channel age never implies experience. Historical snapshots are retained; conflicting new scalar claims go to review instead of replacing accepted claims. Additional source evidence for an identical fact is preserved.

Waterways use permanent geographically resolved identity keys, not names alone. Same-name features in different states or contexts remain separate; unresolved identities can be retained. Parent/watershed evidence is supported; no unverified tributary link has been seeded. Videos/articles are separate supporting rows with date, optional inspected-footage timestamp, techniques, naming certainty, inspection basis and checked date. Multiple sources need distinct supported visit keys before the UI says visits were reported; several edits from a single visit should share one key. This does not imply regular visits or permission/access. Coordinates and private addresses are not collected.

The public directory adds specialty and evidence-backed region filters only when 005 exists and accepted claims are published. Profiles display approved fields and original source links with checked dates, plus Waterways featured. Private evidence notes, conflicts and draft rows remain excluded. Existing profile/editor data is preserved. The normal editor does not publish these research tables; review them in a development database before creating a controlled publication workflow. No waterway page was added because none currently exists.

## Development setup still required

Use a separate local MariaDB development database with the existing foundation migrations applied. Configure normal DB_* settings privately. Then set RESEARCH_DATABASE_MODE=development and run, using your configured Node 22:

    node scripts/migrate-creator-research.mjs
    node scripts/import-creator-research.mjs database/research-imports/creator-enrichment-2026-10-09-a.json

Both helpers refuse a non-local database and never log credentials. Review the reported missingCreators and resolve slug mapping before importing more records. The batch contains five creators, four waterways and five source connections; website import may include fewer because its roster differs from the research roster. Do not create duplicates to fix a missing mapping.

The schema has not yet been executed against MariaDB: local database setup is absent. Validation covers SQLite equivalents, Node validation/import transaction behavior through a query mock, public query allowlists, filters, HTML escaping and existing website HTTP tests. A real MariaDB migration/replay/import check remains required before production use.

## Corrections and remaining research

The private library supports a correction queue through profiles.py correction; use it for unsupported or disputed data. The existing site has no feedback endpoint or configured site contact destination. No account/messaging feature was introduced. Public correction submission therefore remains a later configuration step; creator business-contact links are not used for site corrections.

Only five creators are partially enriched in the first evidence batch; the other 63 stay pending. There is no configured YOUTUBE_API_KEY in this session, and no API calls, subscriber-based rankings or automated scraping were added. Channel IDs and dates/counts in the first batch came from original YouTube UI. Oldest/latest prospecting-video census and experience remain unknown. Full transcripts and protected text were not imported.
