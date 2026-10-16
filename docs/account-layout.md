# Your camp account layout

Prepared October 16, 2026, against the published homepage release `1484d46`. Not deployed.

The signed-in `/account/` page now has a personal welcome, a membership badge, a leading My Gold Trail link, paired Calendar and Connections shortcuts, compact account details, and a quiet Plus/sign-out footer. The account content precedes the navigation shelf in reading order and on phones; the desktop shelf stays at the left. Styles are scoped to this page and loaded with a content-based asset version.

Authentication, effective membership checks, private response caching, and POST/CSRF sign-out remain in the existing member handler. No payments, real accounts, or production configuration were changed.

Validation: 29 focused member/reading tests passed, including free/Plus links, escaped account identity, anonymous redirects and CSRF-protected sign-out. Build passed (14 HTML pages; 404 local links/assets). Browser checked at 1280px and 390px, including 200% text and stronger contrast; no horizontal overflow or console warnings/errors.

Local preview: `node scripts/preview-account.mjs`, then `http://127.0.0.1:4333/account/`. Uses only fictional Alex / TrailReader, no database or outbound email; mutations are disabled. `--plus` selects a fictional Plus view at startup.

Awaiting production publication approval, consistent with the prior project brief's instruction to stop before production deployments.
