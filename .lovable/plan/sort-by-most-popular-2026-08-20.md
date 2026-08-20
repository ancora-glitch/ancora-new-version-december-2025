# Sort by "Most popular"

Add a popularity sort option on Shop and Category pages, driven by aggregated product click counts from the last 30 days.

## Database (shown for approval before running)

- Partial index on `site_analytics` for `product_click` events, keyed on the product id inside metadata plus timestamp.
- New read-only function `get_product_popularity(rolling_days)` returning only `product_id` and `click_count` — no visitor ids, no metadata, no raw rows. Same security pattern as the existing unique-visitor functions.
- Execute permission granted to anonymous and signed-in visitors.

## Frontend

1. New hook `src/hooks/useProductPopularity.ts` — calls the function, returns a `Map<productId, clickCount>`, cached 5 minutes.
2. `src/components/ProductToolbar.tsx` — extend `SortOption` with `"popularity"` and add a "Most popular" item between "Newest arrivals" and the price options.
3. `src/pages/Shop.tsx` and `src/pages/CategoryPage.tsx` — call the hook, add a `popularity` branch in the existing sort block (most clicks first, unclicked products last via `?? 0`), and add the map to the memo dependencies.

## Verification

- Migration approved before it runs.
- Manually inspect the function response to confirm only `product_id` and `click_count` come back.
- Time the function against current volume (~10,375 click rows); expect well under 100ms with the index.
- Check "Most popular" on both pages: no crash, no NaN, unclicked items last.
- `tsgo --noEmit` clean.
- No changes to product data or analytics rows.
