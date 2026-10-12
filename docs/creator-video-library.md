# Creator video libraries

Each supported creator has a Video library link on the directory card, profile, map popup and relevant Almanac cards. It opens one native dialog with lazy thumbnails, title search, editorial topic filters, title/topic sorting and a visible result count. Watch links open canonical YouTube URLs in a separate tab with `noopener noreferrer`. Escape and the close button return focus to the library link. The close button stays visible while scrolling.

An ordinary link to `/prospectors/:slug/videos/` provides a server-rendered fallback and a shareable library page. The modal requests `/api/prospectors/:slug/videos/`. Both routes enforce the same published-profile and catalog visibility rules as the directory; a roster match does not bypass drafts, exclusions or archives. The API projects public metadata explicitly and never returns database profile fields or held research.

## Editorial data

`app/creator-video-library.json` contains 97 selected videos mapped to 17 existing creator slugs. Stable YouTube channel IDs establish uploader attribution; titles mentioning another creator or a product do not establish authorship. The New 49’ers association video is credited to `new49ersvideo` under its combined association profile.

The source is `Gold_Trails_Video_Library_228.json`, SHA-256 `2aab77137dd87f08fb7d3a4808b8ef120c4e4d77b4c599bb988f80e9f2206803`. Metadata was checked on 2026-10-12. The inspection manifest in `database/map-data/creator-video-library-inspection-2026-10-12.json` records accepted mappings and per-video primary-source evidence.

This is a selected discovery library, not a complete channel catalog. Subjects are browsing categories from the input; tags are empty. Descriptions, regional claims, relative dates, view counts and estimated durations are held. Uploader checks do not verify transcripts or claims in the video. Another 131 original videos are preserved in the research holding artifact outside the deployed application: 130 need verified roster links, and one Mike Pung personal-channel relationship to the Gold Cube brand needs review.

## Validation

`tests/creator-videos.test.js` covers canonical ownership, duplicate IDs, unsafe URLs, metadata types, escaping, public field projection, independent lookups, new-tab links, full-page fallback, method/HEAD handling and profile visibility. Browser verification covers combined filters, empty results, separate-tab navigation, Escape/focus return, the phone layout, map popups and Almanac state switching.

Assets use content hashes. The library loads only when the page has a supported link, a fallback library or the Almanac host marker needed for later state changes. No database migration or YouTube API key is required.
