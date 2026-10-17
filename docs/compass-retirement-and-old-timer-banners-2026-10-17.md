# Compass retirement and Old-Timer banners

Status: completed locally, awaiting approval to publish. Based on live release 10bee4a.

Paul confirmed Compass was not wanted and requested removal. Production no longer initializes its handler or store. Old GET/HEAD bookmarks redirect to /account/; old mutation requests return 410 before member handlers. Account, calendar and signed-in homepage links now use /account/. Free-member descriptions offer actual calendar capabilities instead of recommendations, saved resources or learning progress. Existing Compass data, migrations and legacy implementation remain preserved; no member data is deleted. Legacy handlers remain available only to explicitly constructed test fixtures, not production startup.

Paul requested more readable spacing and larger headings across scenes with Old-Timer artwork. A shared old-timer-copy class covers the classic responsive homepage, Plus page and public Almanac description. Desktop headings are 34px with 1.45 line-height; phone headings are 28px. Copy is 16px with 1.75 line-height. Rem units respect Reading options. The illustrated desktop homepage's raster lettering is unchanged.

The Almanac badge reads “All 50 states!” using the site's existing Rye face, larger lettering, double border and warm paper colors. It occupies layout space so enlarged text cannot overlap it. Its accessible name specifies U.S. states.

Validation: all 293 tests pass, including retirement regression tests and updated member/homepage routing assertions. Build checks 14 HTML pages and 492 local links/assets. Browser checked desktop 1280, phone 390, phone with 200% text, classic homepage at 1000, and fictional account overview. No horizontal overflow on checked banner views. Accounts, personal calendar and premium restrictions remain available. Payments remain disabled.

Preview: http://127.0.0.1:4335/plus/ . This process uses fictional account details for /account/ and rejects writes. Screenshots: workspace outputs/membership-and-calendar-2026-10-17/old-timer-banner-desktop.png and old-timer-banner-mobile.png.

## Subsequent scope clarification
Paul clarified: “The dashboard can stay with the field desk, I guess. I need to clean up the field desk because there are some things that don't belong there, but I suppose it is a good place to put things about privacy and whatnot.” Retain a simple Field Desk utility dashboard. Compass naming, questionnaire, learning sequence, progress bars, goals and achievements remain retired. The account overview already retains calendar and account information. Review remaining utility modules with Paul before restoring anything else. Existing dashboard privacy/export controls cover only Compass records; they must not be represented as full-account privacy/export controls. General account closure and account-wide export are not implemented. This clarification is recorded without restoring the legacy dashboard or modifying data.
