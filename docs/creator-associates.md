# Creator associates

A creator portfolio may describe an individual or a shared channel. Optional associates have their own stable IDs and remain attached to the portfolio; shared channels are not duplicated. An optional linked_person_id foreign key allows a separate profile to be connected later. This first editor accepts public names, relationship, description, individual link, source link and visibility. Draft is the default. Archive preserves records; edits use the parent profile revision and audit log.

Apply database/migrations/003_creator_associates.sql once in phpMyAdmin after a database backup. Do not rerun after success. The migration marker enables the section; until then the deployed editor and public profiles continue working without it. No existing profile is changed by the migration. Existing forms without the associates marker preserve associate records.

Live records added 5 October 2026:
- Dan Hurd: /prospectors/dan-hurd/; official YouTube and FAQ evidence. Website source: https://danhurdprospecting.com/blog/.
- Hip Bee Explorer: /prospectors/hip-bee-explorer/; supplied official YouTube and public creator page https://www.patreon.com/user/about?u=37215000. Individual names and regions unconfirmed; no associate names guessed.

Profiles remain sources-pending. No manufacturer role or personal relationships inferred. No authentication rights are created by associates.

003_creator_associates applied 5 October 2026. Full backup downloaded beforehand (u474324596_goldtrails.sql-2, 55,053 bytes). CREATE TABLE and migration marker succeeded in phpMyAdmin. Live Hip Bee Explorer editor verified with the People & associates section enabled; no speculative member names inserted. Database now has 31 base tables.
