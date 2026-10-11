# Sidebar gold-price reference

`dist/gold-price.js` adds a compact box at the bottom of each visible left navigation. It shows USD per troy ounce and per gram, the provider snapshot time, and an external source link. Compact creator editors omit the box to preserve their form space.

Prices come from GoldPriceZone's documented public widget JSON endpoint. Its widget documentation permits a custom display with visible attribution: https://goldpricezone.com/widget. Their methodology describes USD per troy ounce and the conversion factor: https://goldpricezone.com/methodology. The feed timestamp is labelled “Feed updated”; it is not asserted to be an individual trade timestamp.

The browser contacts only `/api/gold-price/`, without account cookies. The server requests only a fixed public endpoint; no member information, precise locations, or credentials are sent. No signup, API key, environment variable, database table, or dependency is required.

`app/gold-price.js` validates currency, finite positive prices, weight units, and snapshot age. It converts using 31.1034768 grams per troy ounce. One process-wide feed instance shares a 60-second cache, deduplicates concurrent requests, and times out upstream requests after four seconds. Failures back off for one minute. A previous real quote is labelled delayed; snapshots over 72 hours old are withheld. Nothing is filled with a fictional price.

The frontend refreshes every minute while the page is visible. It resumes when the tab becomes visible and shows an unavailable state if there is no usable quote. Snapshot dates older than 15 minutes are labelled delayed, including possible market closures. The spot reference is for pure gold, not the resale value of a natural nugget. The source link's optional Old Timer explanation makes that distinction.

Assets are versioned during the existing build. Tests cover conversion, validation, cache sharing, concurrent calls, failure/backoff/recovery, stale data, JSON endpoint methods, and no access to private member handlers.
