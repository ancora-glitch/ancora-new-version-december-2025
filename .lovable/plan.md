## Sellpy manual import partner (Algolia-based)

Model on the existing Worn Vintage / VintageSphere pattern. Manual-only, no cron, no DB migration. Search backed by Sellpy's public Algolia index.

### Scope & invariants

- `marketplace: "sellpy"` (lowercase snake_case)
- `status: "draft"` on insert
- Cap 10 items/session, enforced in drawer
- No cron, no availability sync, no editorial overwrites
- Direct product links, no affiliate tracking
- No changes to Tradera, eBay, VintageSphere, Worn Vintage, or Pure Effect code

### Files to create

1. **`supabase/functions/sellpy-search/index.ts`**
   - CORS via `npm:@supabase/supabase-js@2/cors`, Zod-validated body `{ query: string, page?: number }`.
   - POST to `https://M6WNFR0LVI-dsn.algolia.net/1/indexes/prod_marketItem_se_relevance/query` with headers:
     - `X-Algolia-Application-Id: M6WNFR0LVI`
     - `X-Algolia-API-Key: 313e09c3b00b6e2da5dbe382cd1c8f4b`
     - `Content-Type: application/json`
   - Body: `{ query, hitsPerPage: 10, page }`.
   - Normalize each hit to the same shape the drawer expects: `{ external_id, marketplace: "sellpy", title, brand, price, currency, images, url, size, color, condition_raw, description, sourceCollection }`.
   - 429 retry with exponential backoff (mirroring `wornvintage-search`).
   - These Algolia credentials are public search keys (the same ones Sellpy ships to its own browser); hardcoding them in the edge function is acceptable and matches Algolia's "search-only key" model. No `add_secret` needed.

2. **`supabase/functions/sellpy-item/index.ts`**
   - Same Algolia POST, but using `filters: "objectID:<id>"` (or `getObject` endpoint) to fetch a single hit by `external_id`.
   - Normalize the full record: `title`, `brand` (from hit, not hardcoded), `price`, `size`, `color`, `material`, `condition`, `images[]`, `description`, product URL.
   - Conservative `CONDITION_MAP` for Sellpy's Swedish condition vocabulary (`"Nyskick"`, `"Mycket bra skick"`, `"Bra skick"`, `"Acceptabelt skick"`). Unknown strings → `null` + `console.warn`; never coerced.

3. **`src/components/admin/SellpySearchDrawer.tsx`**
   - Duplicate of `WornVintageSearchDrawer.tsx`, retargeted at `sellpy-search` / `sellpy-item`, with `marketplace: "sellpy"` everywhere.
   - Uses `useImportToProduct` and `parseListingFields`. Brand flows from `detail.brand` (not hardcoded).
   - 10-item cap.

### Files to edit

4. **`src/components/admin/ImportsTab.tsx`**
   - Add `const [sellpyOpen, setSellpyOpen] = useState(false)`.
   - Add "Importera från Sellpy" button next to the VintageSphere button.
   - Mount `<SellpySearchDrawer open={sellpyOpen} onOpenChange={setSellpyOpen} onImported={refetch} />`.

5. **`src/pages/ProductDetail.tsx`**
   - Extend `sourceLabels` map: `sellpy: "Sellpy"`.

6. **`ANCORA_MASTER_SPEC.md`**
   - Append a v1.9 changelog entry mirroring the Worn Vintage entry format, noting Algolia as the backing search.

### Not touched

- Cron (`setup_cron_vault`, `cron-setup`), Tradera quota, eBay, VintageSphere, Worn Vintage, Pure Effect, editorial fields, DB schema (no migration — `marketplace` is plain text).
