# Connecting the prospector directory

Implemented locally on 5 October 2026. Production activation still requires the private Hostinger settings and a deployment of this version.

## What works

- `/prospectors/`: server-rendered directory with keyword, topic and region search, 20 profiles per page.
- `/prospectors/<slug>/`: public profiles with roles, regions, topics, formats, language, instruction, channels, public contact, selected resources and source links.
- Shared Gold Trails header, category navigation, sidebars and return-home link.
- Blank values display TBD; false displays No and zero remains zero. Missing or unsafe destinations are non-clickable.
- Only published, non-archived, non-sample profiles appear in normal search. Draft profiles return 404; published archived profiles return a 410 archive notice containing only their name. Archived relationships and unpublished resources/channels are excluded.
- Existing static pages work without a database. An unavailable connection produces a friendly 503 page rather than invented search results.
- SQL uses bound parameters and literal wildcard escaping. Public output is explicitly selected and escaped; evidence/reviewer notes are excluded.

## Hostinger settings

In this website's Environment variables, set the following server-only values. Do not put secrets into GitHub, website HTML, JavaScript, screenshots or chat.

| Variable | Value |
| --- | --- |
| DB_HOST | localhost (Hostinger's documented default; verify on the account) |
| DB_PORT | 3306 |
| DB_USER | u474324596_goldtrails |
| DB_NAME | u474324596_goldtrails |
| DB_PASSWORD | Enter the current database password privately in Hostinger |

No remote MySQL permission is needed for this same-host setup. If a remote database is used later, DB_SSL=true is required and TLS certificate verification stays enabled. DB_SSL_CA can hold a trusted CA certificate if needed.

The earlier password shared in chat should be replaced privately before production use. The agent has not used or saved it. Password changes remain a user action.

After setting the variables, deploy/restart the application. A successful empty directory displays “The campfire is taking shape” with search fields; a 503 indicates the connection still needs attention. Use `npm run db:check` in a runtime with these variables to verify the migration and all directory queries without inserting records. Never expose this command through a public web endpoint.

[Hostinger connection instructions](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/).

## Validation completed

Nine Node 22 tests pass: search→profile routing and pagination, hostile search values, output escaping, non-clickable unsafe links, TBD/false/zero, archival handling, missing records, database outage redaction, and retained static pages. All 48 static pages and 1,787 local links/assets pass the build check. Read-only directory/profile query checks ran successfully against the empty Hostinger tables through phpMyAdmin. A live Node-to-database connection and a database-populated profile remain unverified until secrets are configured and a development fixture is exercised.

No researched profiles or fictional production records were inserted. Use a separate development database for sample records and editing tests. Reserve `jack-riverbend-morgan` for the existing static fictional preview until that preview is retired. The first editing interface and write validation are a later step; do not expose write endpoints yet.

## Local development

Install with `npm ci`, then `npm test` and `npm run build` using Node 22. For static and connection-not-ready previews, use `npm start`. For a separate development database, copy `.env.example` to the ignored `.env`, fill it privately, and run `node --env-file=.env server.js`. Load migration 001 once into that empty development database. Use `node --env-file=.env scripts/check-database.mjs` to check it.

A simple static file server cannot execute the directory queries. Serve with the Node application for dynamic pages.
