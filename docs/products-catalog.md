# Products catalog

The Products page uses the 57-product research package supplied on October 9, 2026. Its cumulative tables are retained in `app/product-catalog.json`; these supplied findings have not been independently re-researched during this import.

`npm run build` renders every product to `dist/products/index.html`. The page works without a database. Browser-side search combines words across names, brands, categories, descriptions, specifications, techniques, settings, and documented creator connections. Category filtering and alphabetical sorting work together. All entries and expandable details remain available without JavaScript.

Creator recommendations, usage, business relationships, and source caveats stay distinct. Unknown prices and currencies are not inferred. Recorded prices retain their check dates and source context. The supplied leads and usage summaries stay in the source file; the page does not turn them into unsupported popularity claims.

To add an approved photo later, place it under `dist/images/products/` and add `image_url`, such as `/images/products/GT-P0001.jpg`, to the product record, then rebuild. A photo appears beside the list entry only when a record supplies it. No image placeholders or generated product photos were added.

Product IDs also provide stable links, such as `/products/#GT-P0002`. A matching fragment reveals and opens that product's details. External sources and purchase links open a new tab/window. This is a reference catalog, with no checkout or affiliate integration.
