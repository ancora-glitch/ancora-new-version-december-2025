## Goal

Create a new isolated edge function `intake-fetch-redesignedby` that fetches up to 10 ReDesignedBy products into the intake v1 test pipeline. Fully decoupled from Tradera/eBay flows: no shared quota counters, no shared retry queues, no shared cron jobs.

## Files

1. **New**: `supabase/functions/intake-fetch-redesignedby/index.ts`
2. **Edit**: `supabase/config.toml` — append `[functions.intake-fetch-redesignedby]` block with `verify_jwt = false` (matches sibling intake test functions; auth is enforced in code via admin-or-service-role check).

No other files touched. No DB migration. No changes to existing edge functions, tables, components, or cron jobs.

## Function structure

Mirrors the patterns already used in `intake-fetch-test/index.ts` (CORS, `verifyAdmin`, env guards, run-log lifecycle, dedupe, normalized write), but specialized for the ReDesignedBy public catalog API.

### 1. CORS + auth
- Reuse the same allowed-origin list and `ALLOWED_HEADERS` constant.
- `verifyAdmin` accepts service-role token OR an admin JWT (same as sibling).

### 2. Body
```ts
{ dry_run?: boolean }
```
No `source` parameter (the function is dedicated to redesignedby).

### 3. Guard rules (abort + log row, return 200)
Checked in this order, before any catalog calls:
- `VITE_INTAKE_V1_ENABLED !== "true"` → status `aborted_flag_disabled`
- `VITE_INTAKE_FETCH_ENABLED !== "true"` → status `aborted_flag_disabled`
- `VITE_INTAKE_KILL_SWITCH === "true"` → status `aborted_kill_switch`

Each abort writes one row to `intake_run_logs` with `source = "redesignedby"`, `run_type = "fetch"`, the matching status, zero counters, and a small `summary.reason` string. No further work.

### 4. Run log row
On success path: insert `intake_run_logs` row with `status="started"`, `run_type="fetch"`, `source="redesignedby"`. Capture `runId`.

### 5. Fetch from ReDesignedBy
Base URL: `https://wiuiatrnvqyclntzwirz.supabase.co/functions/v1`

- `POST /redesignedby-search` with `{ limit: 10 }` — returns up to 10 listing summaries.
- Iterate items; between each `POST /redesignedby-item` call, `await delay(300)`.
- On any non-OK response from search, mark run failed and return.
- On any non-OK response from a single item fetch, **abort the remaining batch immediately** (per spec), record `error_count++`, mark run as `failed`, write summary, return.
- No `Authorization` header. No `RDBY_API_TOKEN`. No quota counter increment. No retry job enqueue.

### 6. Duplicate check (per item, before any writes — runs in dry_run too)
For each item with `handle` and `affiliateUrl`:
- `intake_raw_listings` where `external_id = handle AND source = 'redesignedby'`
- `intake_normalized_products` where `external_id = handle AND source = 'redesignedby'`
- `products` where `affiliate_url = item.affiliateUrl` (read-only — never written)

If any match: `duplicates_skipped++` (or `already_in_production++` for the products match), push a skip result, `continue`. The detail fetch can be skipped if the search summary already has `affiliateUrl` and we hit a dedupe on the search row — do the dedupe **after the search summary is in hand and before the per-item detail call**, to avoid extra network work.

### 7. Field mapping (from the detail payload)
```
source              = "redesignedby"
marketplace         = "redesignedby"
external_id         = handle
affiliate_url       = affiliateUrl                 // never productUrl
title_raw           = title
description_raw     = descriptionText (fallback descriptionHtml stripped)
brand               = vendor                       // never modified
price               = price                        // as returned, no extra markup
currency            = currency
image_urls          = images.map(i => i.src)
availability_status = available ? "available" : "unavailable"
size                = size ?? null
color               = color ?? null
```
`tags` and `slug` are stored unchanged inside `raw_payload` (the `intake_normalized_products` table has no `tags`/`slug` columns, so they live in the raw row only — which preserves them verbatim and satisfies "never modify").

### 8. Translation
For each non-rejected item:
- Run `isLikelyEnglish` style heuristic inline (function copied locally — edge functions cannot import from `src/`). Heuristic: skip translation if neither title nor description contain `[åäöÅÄÖ]` and contain fewer than 2 Swedish stopwords (`och, för, med, som, det, den, ett, att, har, kan, inte, från, ska, till`).
- If English-like: set `title_en = title`, `description_en = description`, `translated_at = now()`, `language = "en"`.
- Otherwise: `supabase.functions.invoke("translate-swedish", { body: { name: title, description } })` using the service-role client. On success store translated values + `translated_at = now()` + `language = "sv"`. On error: leave `title_en`/`description_en` null, `translated_at = null`, log a warning, continue.

Fields explicitly never sent to the translator: `brand, price, currency, affiliate_url, slug, images, tags, numeric sizes`.

Note: `intake_normalized_products` does not currently store `title_en`/`description_en` columns; translated text is stored inside `raw_payload.translation = { title_en, description_en, language, translated_at }`. This avoids touching the schema while preserving the data. (Same pattern keeps the function fully isolated.)

### 9. Deterministic rules engine
Hard reject if any of:
- `affiliateUrl` missing/empty
- `price` null or 0
- `image_urls.length === 0`
- `title` missing or `< 3` chars
- item marked unavailable (`available === false`)

Soft flags (added to `soft_flags`, not rejected):
- `image_urls.length < 2`
- brand undetected (`!vendor`)
- size missing
- price below 500 SEK

`current_queue_state = "rules_rejected"` if any hard flag, else `"normalized"`.

### 10. Writes (skipped entirely in dry_run)
Per item that survived dedupe:
- Insert `intake_raw_listings` with full raw search+detail payload + `tags`, `slug`, `productUrl`, `affiliateUrl`, `import_run_id = runId`.
- Insert `intake_normalized_products` with mapped fields and `raw_listing_id`.
- Insert `intake_evaluations` with `rules_version="v1.0"`, `hard_flags`, `soft_flags`, `decision = reject | review | draft_approve`, `score_total = 0` for rejects else `100 - softFlags.length*10`.

Forbidden writes (explicitly never executed):
- `products` table (only read for dedupe)
- `ancora_import_items`
- `tradera_api_usage`, `tradera_retry_jobs`, `tradera_cache`

### 11. Final run-log update
```
status = "completed" | "failed"
completed_at = now()
items_fetched, items_processed,
rules_rejected_count, error_count,
summary = {
  dry_run,
  total_results,
  duplicates_skipped,
  already_in_production,
  rejected_reasons: [{ external_id, reasons }],
  soft_flags_summary: { flag: count },
  selected_source: "redesignedby"
}
```

Response body mirrors the summary plus `run_id`.

## Isolation guarantees (cross-checked against spec)

- No reference to `tradera_*`, `ebay_*`, `RDBY_API_TOKEN`, retry queues, cron schedules, or shared quota functions.
- No edits to `supabase/cron-setup` or any cron migration.
- No edits to `intake-fetch-test`, `intake-enrich-test`, `intake-score-test`, or any other function.
- Only `verify_jwt = false` flag added to `config.toml`; project-level settings untouched.
- `products` table accessed via `select` only — confirmed by code-level guard (no `.insert`/`.update`/`.delete` against `products`).

## Validation

Type-check happens automatically. Manual smoke after deploy:
1. Call with `{ dry_run: true }` — expect run-log row, no writes to `intake_raw_listings`/`intake_normalized_products`.
2. Toggle `VITE_INTAKE_FETCH_ENABLED=false` and re-call — expect `aborted_flag_disabled` row, no catalog calls.
3. Re-enable and call with `{ dry_run: false }` — expect new rows scoped to `source='redesignedby'` only, dedupe counters populated on a second run.
