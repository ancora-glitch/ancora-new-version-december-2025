# Add "Run all" button to Intake (test) tab

Single-file change to `src/components/admin/IntakeTab.tsx`. No other components, edge functions, tables, or data flows are touched.

## Placement

Add a new `Button` in the "Intake pipeline v1" heading row (around line 339), positioned **to the left of** the existing "Trigger test run" button. Same `variant="outline"` `size="sm"` styling for visual consistency, with a `Play`/`Sparkles`-style icon (use `PlayCircle` from lucide-react to differentiate).

## State (added to component)

- `runAllDialogOpen: boolean`
- `isRunningAll: boolean`
- `runAllStep: null | "fetch" | "enrich" | "score"` — drives progress label
- `runAllResult: { fetched, enriched, draft_approved, review, rejected, duplicates_skipped, errors } | null`
- `runAllError: { step: "fetch"|"enrich"|"score", message: string } | null`

## Confirmation modal

Reuse `Dialog` primitives already imported.

- Title: `Run full pipeline`
- Description: `This will run fetch, enrichment, and scoring in sequence. Results are stored in intake_* tables only. No live data will be affected.`
- Footer buttons: `Cancel` (closes dialog if not running) and `Run all` (primary; triggers `handleConfirmRunAll`).
- While running, footer shows the current step label and a `Loader2` spinner; both buttons are disabled.
- On completion, footer becomes a single `Close` button.

## Sequential execution (`handleConfirmRunAll`)

```ts
setIsRunningAll(true); setRunAllError(null); setRunAllResult(null);
const summary = { fetched:0, enriched:0, draft_approved:0, review:0, rejected:0, duplicates_skipped:0, errors:0 };

// Step 1
setRunAllStep("fetch");
const r1 = await supabase.functions.invoke("intake-fetch-test", { body: { source: "ebay", dry_run: false } });
if (r1.error || r1.data?.error) { setRunAllError({ step:"fetch", message: r1.error?.message ?? r1.data.error }); return; }
summary.fetched = r1.data.items_fetched ?? 0;
summary.duplicates_skipped = (r1.data.duplicates_skipped ?? 0) + (r1.data.already_in_production ?? 0);
summary.errors += r1.data.errors ?? r1.data.error_count ?? 0;

// Step 2
setRunAllStep("enrich");
const r2 = await supabase.functions.invoke("intake-enrich-test");
if (r2.error || r2.data?.error) { setRunAllError({ step:"enrich", message: ... }); return; }
summary.enriched = r2.data.items_processed ?? 0;
summary.errors += r2.data.error_count ?? 0;

// Step 3
setRunAllStep("score");
const r3 = await supabase.functions.invoke("intake-score-test");
if (r3.error || r3.data?.error) { setRunAllError({ step:"score", message: ... }); return; }
summary.draft_approved = r3.data.draft_approved_count ?? 0;
summary.review = r3.data.review_count ?? 0;
summary.rejected = r3.data.rules_rejected_count ?? 0;
summary.errors += r3.data.error_count ?? 0;

setRunAllResult(summary);
setRunAllStep(null);
handleRefresh(); // refreshes run-logs, queue counts, and IntakeReviewQueue (via refreshKey)
setIsRunningAll(false);
```

Wrapped in `try/catch/finally` to guarantee `setIsRunningAll(false)` and to capture unexpected errors against the current `runAllStep`.

Progress label inside the dialog body (replaces normal description while running):
- `Step 1/3 — Fetching from eBay...`
- `Step 2/3 — Enriching with Claude...`
- `Step 3/3 — Scoring with Claude...`

## Result summary (rendered inline in dialog when `runAllResult` is set)

Simple two-column list:

```
Fetched:              X
Enriched:             X
Draft approved:       X
Review:               X
Rejected:             X
Duplicates skipped:   X
Errors:               X
```

## Error display

When `runAllError` is set, replace progress/summary with a red bordered block:
- `Step failed: {step}`
- `{message}`
- A `Close` button. No automatic continuation, no crash, no hidden state.

## Auto-refresh

`handleRefresh()` already bumps `refreshKey`, which is consumed by the `intake-run-logs` query, the `intake-queue-counts` query, and `<IntakeReviewQueue refreshKey={refreshKey} />`. Calling it after success refreshes all three, satisfying the "Refresh Review queue and Queue summary" requirement.

## Auth / guards

- The tab already lives behind the existing admin auth in `AdminPortal`/`RequireAdmin`; no additional checks needed.
- Only the three named edge functions are invoked, in the specified order.
- No call to `products`, no other functions touched.

## Invariants preserved

- No edge function code is changed.
- No table, schema, RLS, cron, or quota logic is touched.
- Existing "Trigger test run", "Run enrichment", "Run scoring" buttons and dialogs remain unchanged.
- All other tabs and components are untouched.
