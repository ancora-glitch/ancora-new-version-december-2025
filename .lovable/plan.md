# Add Pure Effect Sweden as manual import partner

Mirrors VintageSphere exactly. Purely additive — no changes to Tradera, eBay, VintageSphere, cron jobs, or editorial fields.

## ⚠️ Discrepancies in the provided spec — need confirmation before I build

I inspected the schema and existing code. Three things in your message don't match reality. I want to confirm the corrected approach before writing code.

### 1. No database migration is needed
`products.marketplace` is a plain `text` column with **no CHECK constraint and no ENUM**. Inserting `'pure_effect'` works today. Step 1 of the spec is a no-op — I'll skip it.

### 2. The drawer must insert into `ancora_import_items`, not `products`
The real VintageSphere drawer (`VintageSphereSearchDrawer.tsx` lines 310–346) does **not** insert into `products`. It inserts into `ancora_import_items` via `importMutation` (the AIS intake queue), with translation (`translateImport`) and field parsing (`parseListingFields`). Items become draft products downstream via the existing intake/promote flow.

The spec's `supabase.from("products").insert({...})` would also fail — half its columns don't exist on `products` (no `external_id`, `currency`, `image_url`, `images`, `product_url`, `available`; the real columns are `image`, `additional_images`, `affiliate_url`, etc.).

**Proposed fix:** model the Pure Effect drawer on the real VintageSphere drawer — insert into `ancora_import_items` with `marketplace: "pure_effect"`, run translation + parsing, set `status: 'draft'`, no `condition`. This keeps the invariant ("draft on insert, never published, no editorial overwrites") intact and reuses the AIS pipeline.

### 3. Wiring lives in `ImportsTab.tsx`, not `AdminPortal.tsx`
`AdminPortal.tsx` only renders `<ImportsTab />`. The VintageSphere button + drawer are wired in `src/components/admin/ImportsTab.tsx` (lines 40, 171, 651). I'll add the Pure Effect button + drawer there, next to the VintageSphere ones.

## Plan (assuming the three corrections above)

### Edge function: `supabase/functions/pureeffect-search/index.ts`
Shopify `/collections/kladvard/products.json` scraper, modelled on `vintagesphere-search`. Pagination (PAGE_SIZE=250, MAX_PAGES=20, 500ms delay, 429 retry once). Returns normalized list: external_id (handle), title, vendor, price, primaryImage, imageCount, size/color/material from options, available, productUrl, tags. Keyword AND-filter client-side. CORS + 15s timeout. Register in `supabase/config.toml` with `verify_jwt = false`.

### Edge function: `supabase/functions/pureeffect-item/index.ts`
Single-product fetch from `/products/{handle}.json`, modelled on `vintagesphere-item`. Returns full detail: title, vendor, description (stripped HTML) + descriptionHtml, price, currency=SEK, images sorted by position, size/color/material from options, available, productUrl. `condition` and `era` left null (Pure Effect has no equivalent of VintageSphere's star ratings). Register in `config.toml` with `verify_jwt = false`.

### Component: `src/components/admin/PureEffectSearchDrawer.tsx`
Clone of `VintageSphereSearchDrawer.tsx`, with these substitutions:
- Calls `pureeffect-search` / `pureeffect-item`
- `marketplace: "pure_effect"` everywhere
- `condition` always `null` on insert (Pure Effect has no condition data)
- Uses `importMutation` → inserts into `ancora_import_items` (not `products`)
- Runs `translateImport` + `parseListingFields` like VintageSphere does
- 10-item cap per session (existing pattern uses `MAX_IMPORT_PER_RUN`)
- Drawer copy in Swedish: "Sök Pure Effect" / "Importera"
- Sold-out items still imported as draft (matches VintageSphere behavior)

### Wiring: `src/components/admin/ImportsTab.tsx`
- Import `PureEffectSearchDrawer`
- Add `showPureEffectDrawer` state
- Add "Search Pure Effect" button next to the VintageSphere button (line ~171)
- Render `<PureEffectSearchDrawer />` next to the VintageSphere one (line ~651)
- Update the helper copy from "Tradera/eBay/VintageSphere" to "Tradera/eBay/VintageSphere/Pure Effect"

### Invariants preserved
- No cron, no availability sync, no editorial field overwrites
- `marketplace` is lowercase snake_case `pure_effect`
- Inserts go to `ancora_import_items` with intake `status='draft'`
- `condition` always null
- 10/session cap enforced in drawer
- No changes to Tradera/eBay/VintageSphere flows

## Question before I build

Confirm I should:
1. Skip the migration (none needed)
2. Insert into `ancora_import_items` via the existing AIS pipeline (matching real VintageSphere), **not** directly into `products`
3. Wire into `ImportsTab.tsx` instead of `AdminPortal.tsx`

If you instead want a direct-to-`products` insert path (which would be a new pattern, not "modelled exactly after VintageSphere"), say so and I'll spec the column mapping separately.
