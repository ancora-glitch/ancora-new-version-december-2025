## Goal

Wire the Approve button in the Intake (test) Review queue to a new edge function `intake-promote-product` that creates a draft row in the live `products` table and flips the intake item to `test_approved`. No existing edge function, table, or unrelated component is touched.

## Schema note (needs your call)

The spec asks the new function to also write `external_listing_id` and `external_listing_source` into `products`. **These columns do not exist on the current `products` table** (per the provided schema). Three options:

1. **Skip those two fields** (recommended for "do not modify any other table"). The marketplace + affiliate_url already identify the listing; `tradera_item_id` exists for Tradera but no equivalent for eBay/RDBY.
2. Add a migration that introduces both columns. This violates "do not modify any other component, tab, or data flow" only loosely — schema is not in that list, but the user said "do not modify… table".
3. Stash them inside an existing JSON column. There is no suitable JSON column on `products`.

**Plan assumes option 1** unless you say otherwise. Marketplace will still be set (`ebay` / `redesignedby`) and `tradera_item_id` is left null.

## New edge function: `supabase/functions/intake-promote-product/index.ts`

Same scaffolding as `intake-fetch-redesignedby` (CORS allow-list, `verifyAdmin` accepting either an admin JWT or service-role key, `jsonRes`).

Behaviour, in order:

1. Read `INTAKE_V1_ENABLED` and `INTAKE_KILL_SWITCH` from env. Abort with 403 `{ success:false, error:"Intake disabled" }` if `INTAKE_V1_ENABLED !== "true"` or `INTAKE_KILL_SWITCH === "true"`.
2. Parse `{ normalized_product_id: string }` with zod; 400 on invalid.
3. Service-role client (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
4. `select * from intake_normalized_products where id = :id` → 404 if missing.
5. `select * from intake_evaluations where normalized_product_id = :id limit 1` (context only, not blocking).
6. Duplicate guard: `select id from products where affiliate_url = :affiliate_url limit 1`. If hit → return `{ success:false, error:"Product already exists in production" }` with 409. Skip guard if intake row has no `affiliate_url` (no false-positive match on null).
7. Build the draft row:
   - `brand` = intake.brand ?? "Unknown"
   - `name` = intake.title_clean || intake.title_raw
   - `name_en` = intake.title_clean ?? null
   - `name_original` = intake.title_raw ?? null
   - `description` / `description_en` = intake.description_raw
   - `price` = `${intake.price} ${intake.currency ?? "SEK"}` (text), only if price present; if null, fall back to empty string (price column is NOT NULL text)
   - `size`, `color`, `material`, `condition` = direct copy
   - `affiliate_url` = intake.affiliate_url
   - `marketplace` = intake.source (`"ebay"` | `"redesignedby"`)
   - `image` = first url from `intake.image_urls`, fallback to placeholder string `"/placeholder.svg"` only if completely missing (column is NOT NULL)
   - `additional_images` = remaining urls (jsonb array)
   - `status` = `"draft"` always
   - `subcategory` = intake.subcategory (validated by existing trigger; if value not in allowed set the insert fails — surface that error verbatim)
   - `category_id` = lookup: `select id from categories where lower(name) = lower(:intake.category) limit 1`; null on miss
   - All other fields left to defaults
8. `insert into products (...) returning id`. On error return `{ success:false, error:<message> }` 500.
9. `update intake_normalized_products set current_queue_state='test_approved', updated_at=now() where id=:id`. If this fails after the insert succeeded, still return success but include `warning` in payload.
10. Return `{ success:true, product_id, message:"Draft created" }`.

`supabase/config.toml`: append

```
[functions.intake-promote-product]
verify_jwt = false
```

(Function does its own auth check; matches sibling intake functions.)

Forbidden behaviours encoded explicitly: status hard-coded to `"draft"`, no update path on existing products, never touches editorial fields elsewhere, no Tradera quota counter use, no shared retry queue.

## Frontend: `src/components/admin/IntakeReviewQueue.tsx`

Only the Approve flow changes. Reject and Feature stay byte-for-byte identical.

State additions:

```ts
const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null);
```

Approve button `onClick` becomes `() => setConfirmPromoteId(p.id)` instead of calling `handleAction(p.id, "approve")`. Loading state still keyed off `actionLoading[p.id] === "approve"`.

New handler `handleConfirmPromote(productId)`:

```ts
setActionLoading(prev => ({ ...prev, [productId]: "approve" }));
try {
  const { data, error } = await supabase.functions.invoke("intake-promote-product", {
    body: { normalized_product_id: productId },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Promotion failed");
  toast.success("Draft created in Products");
  queryClient.invalidateQueries({ queryKey: ["intake-review-queue"] });
  queryClient.invalidateQueries({ queryKey: ["intake-evaluations"] });
  queryClient.invalidateQueries({ queryKey: ["intake-queue-counts"] });
} catch (e: any) {
  toast.error(e.message || "Promotion failed");
} finally {
  setActionLoading(prev => { const n = {...prev}; delete n[productId]; return n; });
  setConfirmPromoteId(null);
}
```

Confirmation UI: a single shared `<AlertDialog>` (shadcn) at the bottom of the component, controlled by `confirmPromoteId`:

- Title: "Promote to draft product?"
- Body: "This will create a draft product in the live products table. You can review and publish it from the Products tab."
- Cancel button: closes dialog, no side effect.
- "Approve & promote" button: calls `handleConfirmPromote(confirmPromoteId)`. Disabled while loading.

Error rendering: `toast.error(e.message)` is sufficient and matches the rest of the file. The card's badge will flip to `test_approved` on the next `invalidateQueries` refetch (the function already updated the row).

Admin auth: the existing `RequireAdmin` wrapper around the admin portal already gates this page; the edge function additionally verifies the JWT server-side via `verifyAdmin`.

## Out of scope (untouched)

- `intake-fetch-test`, `intake-fetch-redesignedby`, `intake-enrich-test`, `intake-score-test`.
- `IntakeTab.tsx`, all other admin tabs, all other queue actions (Reject, Feature).
- Tradera quota table, retry jobs, cron schedule.
- Products table schema (assuming option 1 above).
- `intake_editorial_actions` audit table — spec did not require writing to it from the new function. Easy to add later if you want a paper trail.

## Validation steps

1. With `INTAKE_KILL_SWITCH=true`, calling the function returns 403.
2. Approve a card with an `affiliate_url` not in `products` → toast "Draft created in Products", new row visible in Products tab with `status='draft'`, intake card flips to `test_approved`.
3. Approve a second card with the same `affiliate_url` → 409 toast "Product already exists in production", no duplicate row, intake state unchanged.
4. Approve a card with subcategory outside the trigger's allow-list → toast surfaces the trigger error, no product created, intake state unchanged.
5. Cancel button on the dialog → no network call, no state change.
