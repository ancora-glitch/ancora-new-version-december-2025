
User reports: cannot delete a brand (e.g. CDLP) from the "Brand tiers" list in Admin Portal → Intake (test).

Looking at `BrandTiersSection.tsx` `handleDelete`:
```ts
const { error } = await supabase.from("intake_brand_tiers").delete().eq("id", b.id);
if (error) { toast.error(error.message); return; }
toast.success("Brand deleted");
```

And RLS on `intake_brand_tiers`:
- DELETE policy: `Admins can delete intake_brand_tiers` → `has_role(auth.uid(), 'admin'::app_role)` for `{authenticated}` role.

That looks fine on paper. So why would CDLP fail silently?

Most likely cause: **`window.confirm()` is being blocked or dismissed silently**, OR the delete request returns no error but matches 0 rows because of RLS misalignment (e.g. the row was inserted by another path), OR the toast is showing but the list isn't refreshing because the query cache key matches but `invalidateQueries` race.

Actually — re-reading carefully: the most common real-world cause for "delete doesn't work, no error" with Supabase RLS is that **`.delete()` succeeds (returns no error) but affects 0 rows because RLS silently filters them**. With `{authenticated}` role + `has_role` check, this works only if the user session is fully authenticated. If session is fine for SELECT (we see the brands) and UPDATE works (edit works), DELETE should too — same predicate.

Let me verify by querying the actual row and checking if there's something specific about CDLP.

## Plan: Fix brand deletion in Brand tiers

### Investigation needed first
Check the actual DB state for CDLP and similar entries to confirm whether:
1. The row exists and is unique
2. There are duplicates causing confusion
3. The RLS DELETE policy is actually firing

### Likely fix in `src/components/admin/BrandTiersSection.tsx`

The current `handleDelete` swallows the "0 rows affected" case. Improvements:

1. **Use `.select()` chained to `.delete()`** so we can verify how many rows were actually deleted:
   ```ts
   const { data, error } = await supabase
     .from("intake_brand_tiers")
     .delete()
     .eq("id", b.id)
     .select();
   ```
   If `data.length === 0` → show explicit error: "Could not delete (no permission or row not found)".

2. **Replace `window.confirm()`** with the existing `AlertDialog` component for a reliable, non-blocked confirmation that works across all browsers/embedded previews (Lovable preview iframe sometimes suppresses native `confirm`).

3. **Await `invalidateQueries`** so the UI reflects the deletion immediately:
   ```ts
   await queryClient.invalidateQueries({ queryKey: ["intake-brand-tiers"] });
   ```

4. **Surface the real error** with full detail (`error.message + error.details + error.hint`) for debugging.

### Single file changed
`src/components/admin/BrandTiersSection.tsx` — replace `handleDelete` + add `AlertDialog` for delete confirmation. No other component, table, edge function, or data flow touched.

### Guarantees
- No schema changes, no RLS changes, no enum changes
- No changes to enrichment, scoring, fetch, or any other tab
- Spec-aligned: read-only governance impact
