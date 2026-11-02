# Gold Trails

A frontier-themed gold-prospecting field library with static topic pages and a server-rendered prospector directory.

## Project status

The public site is [goldtrails.org](https://goldtrails.org/). Start with the [launch roadmap](docs/launch-roadmap.md) for current priorities, creator invitations, complimentary creator access and the remaining USD $5/month Stripe integration. The [creator outreach draft](docs/creator-outreach.md) and [river clothing research brief](docs/river-clothing-research-2026-11-01.md) support the next content and outreach work.

As reviewed November 1, 2026, member accounts, creator administration, calendars, Plus access checks and [complimentary creator invitations](docs/creator-invitations.md) are implemented. Checkout and billing remain disabled. Creator invitations require migration 014 and one owner setup step. Existing daily private research maintenance continues separately from website publication.

## Preview

Serve `dist/` with a local HTTP server, then open the server URL in a browser. For example, with Python installed:

```sh
python3 -m http.server 4173 --directory dist
```

Open http://localhost:4173.

## Structure

- `dist/index.html`: homepage
- `dist/style.css`: shared visual styling
- `dist/assets/`: artwork
- Category, collection, guide, prospector, location, resource, and tool pages use directory-based URLs with their own `index.html`.

The site combines static articles and resources with server-rendered creator, account, calendar, Almanac and Connections routes. The November 1 build checks 21 static HTML pages; generated route counts differ from that static count. The live directory needs server-only database settings; see [directory setup](docs/directory-connection.md).

## Hostinger GitHub deployment

The site uses HTML, CSS, browser JavaScript, a Node server and MariaDB through Hostinger's app deployment workflow. Membership accounts and entitlement checks are implemented; payment processing remains a launch milestone.

- Repository root: `/`
- Branch: `main`
- Framework: Other (Node.js/custom application)
- Node version: 22
- Install: `npm ci`
- Build: `npm run build` (checks the existing static pages)
- Output directory: `dist`
- Entry file: `server.js`
- Start: `npm start`
- Port: 3000 by default; the server respects `PORT` if provided.
- Database settings: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME. Enter privately in Hostinger Environment variables; never commit a filled .env file. Static pages remain available if these are absent.

For local preview, run `npm start` and visit http://localhost:3000.

Commit and push this entire project, including package.json, package-lock.json, server.js, app/, scripts/, database/, and dist/. In Hostinger, choose the repository and confirm these settings before deploying. If Hostinger offers a static-only mode, it can serve dist/ directly without starting the Node server.

## Creator administration

The owner-only workspace is implemented at `/admin/login/` and `/admin/creators/`. It stays disabled until private ADMIN_* settings are configured. Setup, migration status, security controls and limits: [Creator management](docs/creator-management.md).

## Gold Almanac

The state map and source-backed guides are available at `/gold-almanac/`. See [Gold Almanac implementation and editorial guide](docs/gold-almanac.md) for data structure, existing database connections, source requirements, and verification notes. No new migration or API credentials are needed.

## Private member calendar

Phase 1 integrates native personal calendars at `/calendar/` with the existing member sign-in and MariaDB database. Setup, phased implementation plan, migration and verification: [Calendar](docs/calendar.md).
