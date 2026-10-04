# Gold Trails

A static visual foundation for a gold-prospecting knowledge and research website.

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

This version includes 47 static pages. Content and fictional sample profiles are placeholders. Login, subscriptions, social destinations, searches, and database integration are not implemented yet.

## Hostinger GitHub deployment

The site is plain HTML and CSS. The package configuration adds a small dependency-free Node server for Hostinger's app deployment workflow; it does not implement membership or database features.

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
- No secrets or database settings are needed for this visual version.

For local preview, run `npm start` and visit http://localhost:3000.

Commit and push this entire project, including package.json, package-lock.json, server.js, scripts/, and dist/. In Hostinger, choose the repository and confirm these settings before deploying. If Hostinger offers a static-only mode, it can serve dist/ directly without starting the Node server.
