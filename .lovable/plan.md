## Wire intake-fetch-test to intake_configs

Replace hard-coded eBay search params and gender filter in `intake-fetch-test` with a config-driven loop reading from `intake_configs`. Pass `segment` through to `intake_normalized_products`.

### Database (single migration)

- Add `segment product_segment NOT NULL DEFAULT 'womenswear'` to `intake_normalized_products`.
- Backfill is implicit via the default. No changes to `intake_raw_listings` or `intake_evaluations`.

### Edge function (`supabase/functions/intake-fetch-test/index.ts`)

1. **Load configs** (after the existing guards / before the eBay search loop):
   - Query `intake_configs` where `active = true` and `marketplace = 'ebay'`, ordered by `run_order ASC`.
   - If empty: log, mark run `completed`, return `{ items_fetched: 0, configs: 0 }`.

2. **Replace the brand-shuffle search loop** with a sequential per-config loop. For each config:
   - **Quota guard (eBay)** — explicit comment: *eBay has no per-day quota counter; the abort signal is HTTP 429. The Tradera-style `remaining < 30` rule applies to Tradera only.*
   - For each `query_term` in `config.query_terms`:
     - Build `q=<term>`, `category_ids=<config.category_ids.join(',')>`, `filter=...,price:[<min_gbp>..]` where `min_gbp = round(config.min_price_sek / SEK_RATES.GBP)` (preserves the existing GBP-floor approach; currency stays GBP/EBAY_GB).
     - Drop the hard-coded `aspect_filter` (it pinned `Gender:{Women}` to category 15724). Segmentation now comes from `category_ids` + segment-aware post-filter.
     - On 429: log `[intake-fetch] 429 on config=<name> segment=<segment> term=<term>`, set `rateLimited = true`, `break` out of the **outer config loop** (full session abort, per brief).
   - Deduplicate by `itemId` within the config's results, trim to a per-config slice of `maxItems`.
   - **Segment-aware gender filter**:
     - `womenswear` → reject titles matching `men's | mens | man's | unisex | boys | kids | children`.
     - `menswear` → reject titles matching `women's | womens | woman's | girls | kids | children`.
   - Process items through the existing normalize → hard/soft flag → dedupe → write pipeline, **unchanged**, except `intake_normalized_products` insert now includes `segment: config.segment`.
   - After the config completes, log: `Completed config: <name> | segment: <segment> | inserted: <n> drafts` (where `n` = normalized rows written for this config, i.e. not duplicates / not hard-rejected / not in dry-run).
   - Track per-config counts in a `configResults` array for the run summary.

3. **Run-level totals**: Aggregate `processedCount`, `rejectedCount`, etc. across all configs (existing variables stay, just accumulated). The `intake_run_logs.summary` gains `configs_run: [{ name, segment, fetched, inserted, rejected }]`.

4. **`maxItems` semantics**: `VITE_INTAKE_MAX_ITEMS_PER_RUN` is now a global cap across all configs in one run. Once total fetched ≥ maxItems, break out of the config loop.

### Invariants preserved

- Status enum on AIS rows unchanged (`'draft'` default on `ancora_import_items`; this function writes to `intake_normalized_products` whose `current_queue_state` stays `'normalized'` / `'rules_rejected'`).
- Affiliate URL construction unchanged (still `item.itemWebUrl`).
- No editorial fields (name/description/brand/color/material/condition logic) modified.
- Enums lowercase snake_case (`womenswear`, `menswear`).
- No products-table writes from this function.
- Tradera quota system untouched.

### Out of scope

- Admin UI for managing `intake_configs` rows.
- Shop / navigation segment filtering.
- Promotion path (intake_normalized_products → products) carrying `segment` forward — separate task.
- Adding `segment` to `intake_raw_listings` or `intake_evaluations`.

### Files

- New migration: `intake_normalized_products.segment`.
- Edited: `supabase/functions/intake-fetch-test/index.ts` (search loop, gender filter, normalized insert, run summary).
- No other files touched.
