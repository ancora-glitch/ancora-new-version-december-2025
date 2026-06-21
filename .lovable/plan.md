# Add Worn Vintage Manual Import

Add Worn Vintage (wornvintage.se) as a new manual import partner, modeled exactly on the existing VintageSphere flow. Scope is limited to genuine secondhand items in `/collections/vintage` and `/collections/bags` — the "Worn Design" upcycled line is excluded.

No existing Tradera, eBay, VintageSphere, or Pure Effect code will be touched. No DB migration is needed (`marketplace` is plain text).

## Files to create

### 1. `supabase/functions/wornvintage-search/index.ts`
Shopify-style search edge function:
- Fetches `/collections/vintage/products.json` and `/collections/bags/products.json` from `https://wornvintage.se`
- Paginates up to 20 pages × 250 items, with 500ms delay between pages and one retry on HTTP 429
- Dedupes by `handle`, applies AND keyword filter across `title + vendor + product_type + tags`
- Returns normalized results: `external_id` (handle), `marketplace: "wornvintage"`, title, vendor, price, currency `"SEK"`, `available`, primary image, product URL, source collection
- Standard CORS headers + OPTIONS handler

### 2. `supabase/functions/wornvintage-item/index.ts`
Item-detail edge function:
- Fetches `https://wornvintage.se/products/<handle>.json` with a 15s abort timeout
- Maps Shopify variant `option1/2/3` to `Size`, `Color`, `Material` based on `product.options`
- Parses `Condition:` and `Era:` from `body_html`; condition mapping is conservative — unknown strings stay `null` and log a warning (never forced into a wrong enum value)
- Sorts images by `position`, strips HTML for plain-text description
- Standard CORS + OPTIONS

### 3. `src/components/WornVintageSearchDrawer.tsx`
Exact duplicate of `VintageSphereSearchDrawer.tsx` with only these changes:
- Edge function calls: `wornvintage-search` / `wornvintage-item`
- `useImportToProduct` called with `marketplace: "wornvintage"`
- Drawer title: "Search Worn Vintage"
- 10-item per-run cap preserved

## Files to edit

### 4. `src/pages/AdminPortal.tsx`
Alongside the existing VintageSphere button/drawer:
- Add `import { WornVintageSearchDrawer } from "@/components/WornVintageSearchDrawer"`
- Add `wornVintageOpen` state
- Add `<Button variant="outline">Import Worn Vintage</Button>`
- Render `<WornVintageSearchDrawer open onClose />`

### 5. `src/pages/ProductDetail.tsx`
Add `wornvintage: "Worn Vintage"` to the marketplace `sourceLabel` map.

## Invariants enforced
- `status` always `"draft"` on insert
- `marketplace` always lowercase `"wornvintage"`
- No cron, no availability sync, no editorial overwrites
- 10-item run cap enforced in drawer
- No changes to Tradera / eBay / VintageSphere / Pure Effect code paths

## Validation after build
- Confirm both edge functions deploy
- Dry-run a search from the admin portal, then a single import, and check edge-function logs for any "unmapped condition string" warnings to tune `CONDITION_MAP` if needed
