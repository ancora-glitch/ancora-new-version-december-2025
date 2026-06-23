## Plan: Temporary raw-hit log for Sellpy Algolia search

### Goal
Add a short-lived `console.log` of the first raw Algolia hit in `supabase/functions/sellpy-search/index.ts`, deploy it, then verify the log appears after a Sellpy drawer search.

### Changes
1. **Edit `supabase/functions/sellpy-search/index.ts`**
   - Insert the following line immediately after `data` is parsed and `hits` is extracted, before `hits.map(normalizeHit)`:
     ```typescript
     console.log("SELLPY_RAW_HIT", JSON.stringify(data.hits[0]));
     ```
   - Leave all existing logging, normalization, and drawer wiring untouched.

### Deploy & Verify
2. **Deploy edge function**
   - Deploy `sellpy-search` via `supabase--deploy_edge_functions`.

3. **Trigger a search**
   - User performs one search in the Sellpy drawer manually (confirmed above).

4. **Inspect logs**
   - Fetch `sellpy-search` edge function logs filtered for `SELLPY_RAW_HIT`.

### Cleanup note
This log is temporary diagnostics. After reviewing the raw payload, the user will likely want the line removed again.