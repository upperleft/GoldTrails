# Gold Trails database foundation

Applied 5 October 2026 through Hostinger phpMyAdmin to the previously empty Gold Trails database. Server reported MariaDB 11.8.9-MariaDB-log.

Migration: `migrations/001_directory_foundation.sql`. Apply once only. It creates 27 InnoDB tables with utf8mb4 text, 46 foreign keys and 13 CHECK constraints. No creator, region, topic, resource, or contact records were inserted. Vocabulary seeds: six public roles, three audience levels and five formats. Public creator roles do not grant site access.

## Verified on Hostinger

| Check | Result |
| --- | --- |
| Base tables | 27 |
| Foreign keys | 46 |
| CHECK constraints | 13 |
| People | 1 |
| Resources | 1 |
| Public roles | 6 |
| Audience levels | 3 |
| Formats | 5 |
| Recorded migration | 001_directory_foundation |

## Table groups

- Profiles: people, person_aliases, public_contacts, channels.
- Vocabularies: public_roles, languages, audience_levels, formats, regions, topics.
- Profile associations: person_public_roles, person_languages, person_audience_levels, person_formats, person_regions, person_topics.
- Resources: resources, resource_people, resource_topics, resource_regions, resource_collections, collection_resources, person_featured_resources.
- Evidence: source_references, person_fact_sources, channel_fact_sources.
- Maintenance: schema_migrations.

## Usage and next phase

Generate UUIDs in the application. Relationships use permanent IDs; slugs identify public routes. Store unknown facts as NULL, and render optional missing values as TBD. Preserve false and zero. Archive through archived_at instead of routine deletion. Relationship rows can also be archived and restored by updating the same composite key.

Set every application database session to UTC and strict SQL mode. Application validation must reject invalid URLs, blank required names, malformed UUIDs, future factual years, invalid language/country codes, and indirect cycles in topic/region hierarchies. The schema blocks direct self-parenting, but longer cycles require application validation. Only published, non-archived, non-sample profiles belong in normal public searches. Filter archived vocabulary and relationship rows too. Evidence/reviewer notes require a separate public allowlist.

Channels are person-owned in this phase. Organization ownership, companies, products, storefronts, account permissions, subscriber numbers and billing will arrive through later migrations. Channels have a typed fact-source table now so publishing-since claims can be attributed.

The server-side connector and directory/profile routes are implemented locally. The directory is live and connected; Pioneer Pauly is the first published profile. See ../docs/directory-connection.md. Establish a separate development database before adding fictional records. Credentials must never appear in source files, Git, browser JavaScript, logs, or these notes.

## Applying migrations safely

Do not rerun 001 against this database. For a new empty development database, select that database in phpMyAdmin and execute the complete SQL file. Keep foreign-key checks enabled. MariaDB DDL commits implicitly; a failed multi-statement migration can leave partial tables. Inspect any partial result before retrying and do not drop tables to recover automatically. Back up populated databases before subsequent migrations. Add a new numbered migration for every later schema change; do not edit an already applied migration.

DDL reference: [MariaDB CREATE TABLE](https://github.com/mariadb-corporation/mariadb-docs/blob/main/server/reference/sql-statements/data-definition/create/create-table.md), [MariaDB constraints](https://github.com/mariadb-corporation/mariadb-docs/blob/main/server/reference/sql-statements/data-definition/constraint.md).

## Creator management extension

002_creator_management applied 5 October 2026 after a whole-database backup. Adds three private workspace tables and people.edit_version; migration marker and preserved Pioneer Pauly profile verified. Total base tables: 30. Owner credential configuration and live editor verification remain pending. See ../docs/creator-management.md.
