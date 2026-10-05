# Gold Trails

A frontier-themed gold-prospecting field library with static topic pages and a server-rendered prospector directory.

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

This version includes 48 static pages and server-rendered prospector search/profile routes. Content and the fictional sample profile remain placeholders. Login, subscriptions and social destinations are not implemented. The live directory needs server-only database settings; see [directory setup](docs/directory-connection.md).

## Hostinger GitHub deployment

The site is plain HTML and CSS. The package configuration adds a Node server and MariaDB connector for Hostinger's app deployment workflow. Membership and payments remain a later phase.

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
