# Add duplicate detection to intake-fetch-test

Update `supabase/functions/intake-fetch-test/index.ts` only. No other files, tables, or components touched. No writes to `products` ever.

## Changes

### 1. Counters
Add two counters alongside existing `processedCount`/`rejectedCount`/`errorCount`:
- `duplicatesSkipped` — matches in `intake_raw_listings` or `intake_normalized_products`
- `alreadyInProduction` — matches in `products.affiliate_url`

### 2. Per-item duplicate check (inside the `for` loop, before any insert)
Run after normalization (so we have `externalId` and `affiliateUrl`), but before the `if (!dryRun)` write block. Executes in **both** dry_run and live mode.

Sequence using the existing service-role `svc` client:

```ts
// 1. raw listings
const { data: dupRaw } = await svc
  .from("intake_raw_listings")
  .select("id")
  .eq("external_id", externalId)
  .eq("source", "ebay")
  .limit(1)
  .maybeSingle();

// 2. normalized products
const { data: dupNorm } = !dupRaw ? await svc
  .from("intake_normalized_products")
  .select("id")
  .eq("external_id", externalId)
  .eq("source", "ebay")
  .limit(1)
  .maybeSingle() : { data: null };

// 3. production products (read-only)
const { data: dupProd } = (!dupRaw && !dupNorm && affiliateUrl) ? await svc
  .from("products")
  .select("id")
  .eq("affiliate_url", affiliateUrl)
  .limit(1)
  .maybeSingle() : { data: null };

if (dupRaw || dupNorm) {
  duplicatesSkipped++;
  results.push({ external_id: externalId, title, queue_state: "duplicate_skipped", hard_flags: [], soft_flags: [], skipped: "duplicate_intake" });
  continue;
}
if (dupProd) {
  alreadyInProduction++;
  results.push({ external_id: externalId, title, queue_state: "already_in_production", hard_flags: [], soft_flags: [], skipped: "already_in_production" });
  continue;
}
```

Skipped items do **not** count toward `processedCount` or `rejectedCount`, and do not write to `intake_raw_listings` / `intake_normalized_products` / `intake_evaluations`.

### 3. Run-log summary
Extend the `summary` jsonb passed to `intake_run_logs` update with:
```
duplicates_skipped: duplicatesSkipped,
already_in_production: alreadyInProduction,
```
Also include both fields in the JSON response body.

## Invariants preserved
- No writes to `products` (only `.select()`).
- No schema changes, no new tables, no other functions touched.
- Dry-run still performs checks and reports counts without writing.
- All three queries use the existing service-role client (`svc`).
- Existing guards (kill switch, allowed sources, rate-limit handling) untouched.
