# Products catalog

The Products page uses the 57-product research package supplied on October 9, 2026. Its cumulative tables are retained in `app/product-catalog.json`; these supplied findings have not been independently re-researched during this import.

`npm run build` renders every product to `dist/products/index.html`. The page works without a database. Browser-side search combines words across names, brands, categories, descriptions, specifications, techniques, settings, and documented creator connections. Category filtering and alphabetical sorting work together. All entries and expandable details remain available without JavaScript.

Creator recommendations, usage, business relationships, and source caveats stay distinct. Unknown prices and currencies are not inferred. Recorded prices retain their check dates and source context. The supplied leads and usage summaries stay in the source file; the page does not turn them into unsupported popularity claims.

To add an approved photo later, place it under `dist/images/products/` and add `image_url`, such as `/images/products/GT-P0001.jpg`, to the product record, then rebuild. A photo appears beside the list entry only when a record supplies it. No image placeholders or generated product photos were added.

Product IDs also provide stable links, such as `/products/#GT-P0002`. A matching fragment reveals and opens that product's details. External sources and purchase links open a new tab/window. This is a reference catalog, with no checkout or affiliate integration.


## Administrator dashboard and on-site corrections

The equipment catalog now has “Report a change” links for all 57 records. They open `/products/report/?product=GT-P0002`, for example. Reports are stored privately for the owner to review at `/admin/reports/`; no email client or public email address is required. Anonymous visitors and signed-in members can submit. Optional contact information stays private. A reported business name is self-reported and does not establish ownership or grant permissions.

`/admin/` is the owner dashboard, with creator management, searchable product and member lists, and the correction queue. Member profiles are read-only and exclude credentials and session data. All private routes reuse the existing administrator session, exact Origin checks, CSRF controls and no-store responses. Product forms and review status changes use revision checks and transactional audit records.

Apply migration `007_admin_products_reports.sql` once after a full database backup. It adds `product_overrides`, `product_change_log`, `product_reports` and `product_report_events`. No existing records or permissions are changed by applying it. No new secrets or environment settings are required. Existing `MEMBER_ORIGIN` / `ADMIN_ORIGIN` supplies the exact public submission origin.

The JSON catalog remains the research baseline. Approved owner edits to name, brand, model, description, product URLs and availability are stored as database overrides. The server merges these into the live catalog; saving an edit needs no redeploy. Existing specifications, prices and creator evidence remain intact. Optional supporting source URLs are added to the public record; editor notes and reporter details are private. Compass reads the merged catalog on its next five-minute content refresh and excludes discontinued/out-of-stock products from new recommendations. Database outages show an explicit fallback notice with the original research catalog.

Reports have New, Reviewing, Resolved and Dismissed states. Marking a report resolved does not automatically change a product; review the suggestion and save a separate approved product edit first. Review history is retained. Replaying the same report form is idempotent. Global and per-form rate limits plus a honeypot provide initial spam controls; add gateway abuse controls before a large public launch. There are no deletions or email notifications in this phase.

Product photos, full specification/price editing, new-product creation, creator/member reports, complimentary membership review and manufacturer ownership linking remain separate future work.
