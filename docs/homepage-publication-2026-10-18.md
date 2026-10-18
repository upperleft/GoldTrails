# Homepage and Old-Timer illustrations published October 18, 2026

Paul explicitly requested publication of the saved work. Published release **cc70358900606fb20204330c3aae390ab3e496e8** to the existing main branch through signed-in GitHub Desktop, using a clean fast-forward of `/Users/paulshoemaker/Desktop/GoldTrails`. Desktop HEAD and origin/main both resolve to that release. Hostinger is serving it at https://goldtrails.org/.

## Included

- Original illustrated hero typography, with both buttons beneath it removed from the artwork and interactive controls.
- Removed four duplicate feature links from the top utility row.
- Same public/member homepage composition, with existing-access labels, direct Almanac/Connections links and a small Welcome back greeting for entitled visitors; public offer remains intact.
- Decorative Old-Timer illustrations on Glossary, Products and Clubs & Groups, within existing header space.

## Verification

- Complete pre-publication Node 22 suite: **405 passed, 0 failed**. Log: `/private/tmp/gold-trails-publish-tests-2026-10-18.txt`.
- Normal build passed: 16 pages, 579 local links/assets checked.
- Independent release review found no blockers. No DB/schema, dependencies, environment, billing or entitlement changes.
- **16 live HTTP checks passed**: public homepage uses v3 artwork, removed hero targets absent, all three illustration pages updated, four image asset hashes match local files, existing friends invitation redirects to clean homepage, guest homepage has direct feature access and no upgrade pitch, guest state research/Connections respond successfully, anonymous state research stays protected and personal calendar access remains denied.
- Live browser inspected the familiar guest homepage and the new community illustration. No horizontal overflow at the actual checked 1280px width. Guest banner is present, and the invitation URL is absent from the clean page and evidence.

Evidence outside the repo: task workspace `outputs/homepage-publish-2026-10-18/live-verification.json`, `live-homepage.png`, and `live-community.png`. The HTTP verification helper reads the existing invitation from the task's private file; its output deliberately omits the token, URL and cookies.

## Friends link

The existing invitation `friends-2026-10-17` is still valid; no replacement was created. It opens the live homepage with read-only Almanac/Connections access and no registration. It expires **October 31, 2026 at 9:19 p.m. Eastern** (November 1 at 01:19 UTC). Retrieve the raw URL only from task workspace `.private/gold-trails-guest-pass-2026-10-17.json` when Paul asks to share it. Keep it out of Git, public content, screenshots and reports.

This documentation records the deployed source commit; no further application changes were made after live verification.
