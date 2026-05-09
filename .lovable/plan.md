## Menswear expansion — schema + intake config

Add a `segment` dimension (womenswear/menswear) to products and introduce a configurable intake source registry so eBay (and later partners) can run targeted queries per segment.

### Database changes (single migration)

1. **Enum** `product_segment` with values `womenswear`, `menswear` (lowercase snake_case, per enum invariant).
2. `**products.segment**` — `product_segment NOT NULL DEFAULT 'womenswear'`. Backfills existing rows to `womenswear` via the default; explicit `UPDATE` included for clarity.
3. `**intake_configs**` table:
  - `marketplace text`, `segment product_segment`, `category_ids text[]`, `query_terms text[]`, `min_price_sek int default 500`, `active bool default true`, `run_order int default 1`, timestamps.
  - **RLS enabled** with admin-only select/insert/update/delete via `has_role(auth.uid(),'admin')` (matches existing intake_* tables).
4. **Seed rows** for eBay womenswear (cat 15724) and menswear (cats 1059, 57988, 3002, 2517, 57991, 57989, 10158) with the listed query terms and 500 SEK floor.

### Invariant validation

- Editorial fields untouched — only adds `segment` column.
- Enum is lowercase snake_case.
- No cron schedule changes, no quota logic touched.
- New table follows admin-only RLS pattern from other `intake_*` tables.
- Backwards compatible: default ensures existing inserts/imports keep working without code changes.

### What this plan does NOT change (yet)

This plan only lands the **schema + seed**. It deliberately leaves out:

- `intake-fetch-test` reading from `intake_configs` instead of hard-coded `q`/`category_ids`/min price.
- Admin UI to filter/toggle products by segment.
- Shop / category page filtering by segment.
- Navigation entries for menswear.

Confirm before I extend the plan to wire `intake-fetch-test` (and which loop semantics: one run = one config, or iterate all `active` configs in `run_order`?).

### Files / artifacts

- New migration (enum + column + table + RLS + seed). Submitted via the migration tool for your approval.
- No code, edge function, or component changes in this step.  
  
No unique constraint on (marketplace, segment) — allow multiple rows per segment. Add a `name text NOT NULL` column for readability in admin.
- Yes, min_price_sek per row.
- Seed with ON CONFLICT DO NOTHING keyed on (marketplace, segment, name).

After migration lands: wire intake-fetch-test to read from intake_configs. Loop semantics: one run = iterate all active configs in run_order order, quota-check before each iteration.