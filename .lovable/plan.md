## Goal

Switch ReDesignedBy integration from our own Edge Functions to ReDesignedBy's hosted endpoints, called directly from the browser via a thin client wrapper.

## Changes

### 1. Delete our Edge Functions
- Remove `supabase/functions/redesignedby-search/` (entire folder)
- Remove `supabase/functions/redesignedby-item/` (entire folder)
- Remove the two `[functions.redesignedby-*]` blocks from `supabase/config.toml`
- Call `supabase--delete_edge_functions` for `redesignedby-search` and `redesignedby-item` to remove the deployed copies

### 2. Create `src/lib/rdby.ts`
Thin client exactly as specified:
- `BASE_URL = "https://wiuiatrnvqyclntzwirz.supabase.co/functions/v1"`
- `searchRDBY({ keywords?, cursor?, limit? })` → POST `/redesignedby-search`
- `fetchRDBYItem(handle)` → POST `/redesignedby-item`
- Error handling: throws on non-OK; `fetchRDBYItem` throws `"Product not found"` on 404
- No auth header, no UTM mutation, no price math — pure pass-through

### 3. Update `src/components/admin/ReDesignedBySearchDrawer.tsx`
- Replace `supabase.functions.invoke("redesignedby-search", ...)` with `searchRDBY({ keywords, limit: MAX_RESULTS })`
- Replace `supabase.functions.invoke("redesignedby-item", ...)` with `fetchRDBYItem(handle)`
- Drop the `dry_run` flag (not part of the new contract)
- `data.products` and `data.warnings` shape assumed unchanged — keep existing rendering
- Keep `affiliateUrl` flowing untouched into `affiliate_url` on the imported product (already correct on line 206)
- Keep `price` displayed and stored exactly as returned (already correct — no markup logic exists)
- All other UI behavior (dedupe, importedHandles, existingRefs, warnings, retry, empty state, per-card loading) unchanged

## Invariants preserved
- `marketplace: "redesignedby"` — unchanged
- `status: "draft"` — unchanged (set server-side by ReDesignedBy)
- `affiliateUrl` never modified, never shown in UI — only stored in `affiliate_url`
- Max 10 results — `MAX_RESULTS = 10` unchanged
- No price markup added in client

## Files touched
- delete: `supabase/functions/redesignedby-search/index.ts`
- delete: `supabase/functions/redesignedby-item/index.ts`
- edit:   `supabase/config.toml` (remove 2 blocks)
- create: `src/lib/rdby.ts`
- edit:   `src/components/admin/ReDesignedBySearchDrawer.tsx` (swap two call sites + drop unused `supabase.functions` import path if applicable; `supabase` import still needed for the existing-products query)

## Open assumptions (will proceed unless you flag)
- Response shape from ReDesignedBy's `/redesignedby-search` matches our existing `{ products: [...], warnings: [...] }` shape. If it differs, the drawer will need a small adapter — flag if you have the actual response schema.
- Their `/redesignedby-item` returns the same flat object we built (root-level fields, not wrapped). Same caveat.
- No auth header required (per the snippet you provided — fetch has no Authorization header). The previously discussed `rdby_pk_…` token is not used anywhere in this plan.