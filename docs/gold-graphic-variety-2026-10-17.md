# Small gold graphic family

Prepared October 17, 2026 on `varied-gold-ornaments`, based on published release `541acdb`. Local preview only; publication approval is pending.

Paul asked for a compact gold pile for centered page endings, clarified that these are decorative graphics rather than a logo, then requested additional small varieties distributed around the site.

## Artwork

Created with the built-in Image Generation tool. These are decorative illustrations, not documentary specimen photographs. The selected PNGs have genuine alpha transparency; final project WebPs preserve it. Hidden RGB color outside the silhouettes is transparent, not a colored background. Verified by alpha metadata and a cream/charcoal contact sheet.

| Graphic | Final project asset | Selected generated PNG |
| --- | --- | --- |
| Compact pile | `dist/assets/gold-pile-v1.webp` | `exec-a7034f22-4448-4fbf-bd70-0f0c7bb6fcdf.png` |
| Nugget trio | `dist/assets/gold-trio-v1.webp` | `exec-567e2d80-95fa-46c4-b307-474a73434d7d.png` |
| Single nugget | `dist/assets/gold-single-v1.webp` | `exec-3935ac34-be3b-4277-bac4-f5042f5a4d2d.png` |
| Grains and flakes | `dist/assets/gold-grains-v1.webp` | `exec-f0bf9413-2e0a-4775-829e-38994694b992.png` |

All generated PNGs are in `/Users/paulshoemaker/.codex/generated_images/01a12da8-efea-7032-9100-7b58bbe63b00/`. Final WebPs are 600 × 400, approximately 54–67 KiB each, prepared with Sharp. Source artwork and older gold assets are preserved. No Python was used.

## Placement

- Centered article endings: compact pile, 126 × 84 px decorative slot.
- Bottom of the final creator-profile information block: compact pile.
- Sidebar support notes: single nugget in a smaller 90 × 60 px slot.
- Article and glossary introductions: trio.
- Product introduction: low grains/flakes scatter.
- Creator and community introductions: single nugget.
- Community welcome box: grains/flakes; Plus promotion footer: trio.
- Existing long trail remains in other corner placements and the classic homepage. No brand wordmark, map marker, state bird, documentary photograph, research, links or access controls changed.

Pseudo-elements ignore pointer input and do not enter the accessibility tree; decorative image elements have empty alt text. Centered ornaments remain in normal flow after the text. Stronger contrast and print hide the new decorations as before.

## Verification

- Build passed: 14 static pages, 499 local links/assets checked.
- Existing community and Plus tests: 9 passed; `git diff --check` passed.
- Browser checked article ending, product header, community graphics and creator-profile header/final block. Expected image URLs and loaded images verified.
- Desktop 1280 px and phone 390 px inspected; no horizontal overflow on checked pages. Stronger contrast hides the ending ornament; temporary viewport override reset.
- Cream/charcoal contact sheet and actual article/product screenshots inspected. Preview screenshots are in the task workspace's `outputs/gold-graphic-variety-2026-10-17/`.

## Final prompt set

Exact built-in tool prompts, including the pile's refinement and each distinct sibling variant:

```json
{
  "initial": "Use case: stylized-concept. Asset type: small decorative article-ending emblem for the Gold Trails website. Reference image role: use only its bright yellow-gold metal, natural nugget texture, and softly realistic illustration style. Create a NEW compact, centered, low mound of about five irregular natural gold nuggets, nestled together in a balanced triangular heap. One medium nugget near the center-back, two smaller nuggets in front, a couple tucked at the sides. Rich luminous YELLOW GOLD with honey-yellow crevices and restrained pale highlights, dimensional and warm, not copper or bronze. Symmetric visual weight around the canvas center, though each nugget is naturally irregular. Only a few tiny gold grains immediately around the base, no long sweeping trail, no widely scattered dust, no coins or bars. Tightly framed as one standalone ornament with a small even safety margin and no excessive empty space. Approximate aspect ratio 3:2. Genuinely transparent background; very subtle local contact shadows only, no backdrop, ground mat, parchment, lettering, border, badge, or cartoon sparkles. Keep the silhouette legible when displayed about 110 pixels wide. Decorative illustration rather than a documentary mineral photograph.",
  "refinement": "Use case: background-extraction. Edit the supplied compact gold-nugget pile. Keep the five nugget shapes, positions, bright yellow-gold surfaces, small base grains and overall centered composition unchanged. Remove ALL of the broad golden glow, amber haze and colored halo surrounding the pile. Outside the actual nugget silhouettes and tiny base grains, use fully transparent pixels, with at most a very narrow neutral soft contact shadow directly beneath the base. The large upper, side and lower margins must be completely clear alpha transparency, not tinted translucent gold. No luminous aura, no spotlight, no shadow backdrop, no ground plane, no matte rectangle. This is a crisp little website ornament to sit unobtrusively on cream parchment and dark charcoal. Preserve the rich yellow gold, photographic texture and balanced compact heap.",
  "variants": [
    {
      "key": "gold-trio",
      "prompt": "Use case: stylized-concept. Create ONE small decorative Gold Trails website ornament, as a sibling to the reference. Match the reference's luminous bright YELLOW GOLD, honey-yellow crevices, irregular natural nugget texture and softly realistic illustration. This is decoration, not a documentary specimen photograph. Genuine alpha transparency around the actual objects, minimal narrow neutral contact shadow, tightly framed with even small safety margins, approximately 3:2 composition, readable at 90–130px wide. No text, logos, emblem frame, coins, gold bars, glitter stars, colored backdrop, or broad glow. Subject: a compact horizontal trio of rounded natural gold nuggets: one slightly taller rugged nugget on the left, two smaller flatter nuggets nestled to its right, with 2 tiny chips immediately at the base. Balanced as a small group, no sweeping trail or wide empty gap. Each silhouette should be distinct."
    },
    {
      "key": "gold-single",
      "prompt": "Use case: stylized-concept. Create ONE small decorative Gold Trails website ornament, as a sibling to the reference. Match the reference's luminous bright YELLOW GOLD, honey-yellow crevices, irregular natural nugget texture and softly realistic illustration. This is decoration, not a documentary specimen photograph. Genuine alpha transparency around the actual objects, minimal narrow neutral contact shadow, tightly framed with even small safety margins, approximately 3:2 composition, readable at 90–130px wide. No text, logos, emblem frame, coins, gold bars, glitter stars, colored backdrop, or broad glow. Subject: one handsome chunky natural gold nugget, a gently rounded asymmetric teardrop of irregular yellow metal with a few rugged folds and pits; two very tiny gold chips tucked against its base. Centered, slightly angled, clean strong silhouette. A simple little gold keepsake, not a large heap."
    },
    {
      "key": "gold-grains",
      "prompt": "Use case: stylized-concept. Create ONE small decorative Gold Trails website ornament, as a sibling to the reference. Match the reference's luminous bright YELLOW GOLD, honey-yellow crevices, irregular natural nugget texture and softly realistic illustration. This is decoration, not a documentary specimen photograph. Genuine alpha transparency around the actual objects, minimal narrow neutral contact shadow, tightly framed with even small safety margins, approximately 3:2 composition, readable at 90–130px wide. No text, logos, emblem frame, coins, gold bars, glitter stars, colored backdrop, or broad glow. Subject: a small low oval scatter of coarse gold grains and thin gold flakes with two tiny pea-sized nuggets in the middle. About 15–20 distinct pieces arranged in a compact balanced little mound, gently tapering at both sides, very little space between the pieces. More delicate and flatter than the nugget pile reference. No long tail of dust and no surface mat."
    }
  ]
}
```
