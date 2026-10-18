# Consolidated graphical homepage critique — October 18, 2026

Status: **implemented and saved locally; not deployed**. This follows live application release `cc70358900606fb20204330c3aae390ab3e496e8`.

## Same-site verification before editing

Verified live HTTP behavior before changing the source: `https://www.goldtrails.org/` returns 308 to `https://goldtrails.org/`; the canonical root returns 200 with the current v3 homepage artwork. The existing friends invitation uses that same origin, exchanges its pass at `/plus/guest/` for a dedicated guest cookie, and returns 303 to `/`. This is the **same production site with different read permissions**, not another deployment or prototype. One Hostinger deployment updates the main homepage and friends experience together. The invitation itself, expiry, account permissions and premium feature handlers are unchanged.

## Implemented

- No top toolbar or Help toggle on the homepage. Reading Options and Text View occupy the existing left sidebar below About, with a divider.
- Nine graphical navigation entries: Sign In, Articles, Almanac, Creators, Glossary, Gold Connections, Products, Search, About. Home is removed; the existing logo and Old-Timer home links remain. Signed-in visitors retain My account in the Sign In position.
- Public/free Almanac and Gold Connections links lead to the existing Plus description; subscribers and validated guests link directly to the features. Public creator profiles/videos remain accessible. The latest explicit navigation order supersedes the former public Clubs & Groups substitution.
- The home-only text/mobile navigation follows the same order. Search uses a native disclosure pointing to the existing library filters, without creating a search route. Reading Options appears below About in the appropriate text/sidebar or mobile Menu. Other pages keep their established navigation.
- The Old-Timer, scene, headline and four-card layout remain. The raster intro now reads exactly: “Gold prospecting knowledge, real-world experience, and a supportive community of gold prospecting enthusiasts.” The upper-right Same Rivers/New Discoveries note is removed. Equivalent accessible hero text matches the new sentence.
- Creators & Videos has no Free to explore subtitle and describes only linked videos from gold prospecting creators. Help copy also avoids implying personal meetings.
- Articles uses Practical guides and stories / Practical how-tos, geology, and mineral science. Glossary uses Words from the gold trail / Clear definitions, tool names, and regional words.
- The Almanac card stands alone: 50 state guides; gold geology & history; access research & source links; creator map. No Connections copy or target remains in this card. Public CTA opens the existing description; member CTA opens the Almanac. Existing public price / member greeting remains.
- Artwork source and exact built-in ImageGen prompts: `app/homepage/home-critique-v4.png` and `critique-v4-generation.json`. Optimized `dist/assets/homepage/full-home-critique-v4.webp`: 1672 × 941, 412,062 bytes. Prior artwork is retained. Live labels and card copy are HTML over prepared blank artwork regions.

## Almanac facts checked

The state registry/content covers all 50 states. Existing `app/almanac/views.js` renders geology research, history/discovery records, access/rules and dated sources, and the creator map. Detail varies: 21 states have dedicated geology notes, 47 have history/discovery records, and 29 have state-specific access sources/notes. The card does not claim complete geology or current regulations for every state. Map regions are approximate public creator locations, not private addresses or permission to prospect. The card help explains varying coverage and checking current access.

## Verification and limits

- Full Node 22 suite: **405 passed, 0 failed**, after home navigation/card/access changes. Log: `/private/tmp/gold-trails-home-critique-full-2026-10-18.txt`.
- Build passed: 16 HTML pages and 579 local links/assets checked.
- Browser inspected public and fictional subscriber artwork at an actual 1280 × 720. All artwork, navigation and controls fit within the checked viewport, without horizontal overflow. Top artwork starts at y=0. Card text clears the help icons.
- Reading Options opens beside the sidebar, inside the viewport. Larger text switches to flowing text, retains an operable settings panel, and Reset/Done/Return restores artwork. Direct Text View and return also work.
- Graphical Search opens its existing library chooser and closes. At actual 928px width the text fallback has the requested navigation order, no horizontal overflow, Reading Options below About, and an operable native Search disclosure.
- Paid/member preview keeps direct Almanac/Connections URLs and no upsell badges; tests cover free/expired/raw-plan/guest states and unchanged premium access checks. Browser console reported no warnings/errors in the checked desktop interaction flow.
- A client-script smoke test exercised movement into the mobile Menu slot. **An exact phone-size rendered check remains incomplete:** the browser viewport override returned 1280 × 720 instead of the requested 390 × 844. The screenshot evidence supports desktop and narrower text layouts, not a claimed phone capture. No unrelated browser/OS controls were changed to force it.

Screenshots outside this repo: task workspace `outputs/homepage-critique-2026-10-18/public-desktop.png`, `member-desktop.png`, and `narrow-text-view.png`.

## URLs / remaining decision

Local public preview: http://127.0.0.1:4352/ . Local fictional Plus preview: http://127.0.0.1:4353/ . These run the same source application on this Mac with read-only fixtures; they are not new shareable deployments. A wide desktop window (at least 1280px, fine pointer/hover) displays the graphical version; narrower/touch views retain flowing text.

Neither https://goldtrails.org/ nor the existing friends invitation shows this consolidated draft yet. Both will update together in one deployment after publication. Keep the current access permissions and existing invitation.

The Almanac card remains as requested. Whether it earns its space alongside the sidebar is intentionally still an open design question.
