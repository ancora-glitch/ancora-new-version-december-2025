

## Plan: Add "Run scoring" button to Intake (test) tab

Mirror the existing "Run enrichment" pattern in `src/components/admin/IntakeTab.tsx`. No other files touched. Edge function `intake-score-test` already exists and returns the needed counts (`items_processed`, `draft_approved_count`, `review_count`, `rules_rejected_count`, `error_count`).

### Changes (single file: `src/components/admin/IntakeTab.tsx`)

1. **New state** alongside enrich state:
   - `scoreDialogOpen`, `isScoring`, `scoreResult`, `scoreError`
   - `ScoreResult` type: `{ scored, draft_approved, review, rejected, errors }`

2. **New handlers** mirroring enrichment handlers:
   - `handleScoreOpen()` — reset state, open dialog
   - `handleConfirmScore()` — call `supabase.functions.invoke("intake-score-test")`, map response:
     - `scored = data.items_processed`
     - `draft_approved = data.draft_approved_count`
     - `review = data.review_count`
     - `rejected = data.rules_rejected_count`
     - `errors = data.error_count`
     - On success call `handleRefresh()` (refreshes Review queue via `refreshKey` and Queue summary via React Query key)
   - `handleCloseScoreDialog()`

3. **New button** in the "Intake pipeline v1" heading row, placed right after "Run enrichment":
   ```tsx
   <Button variant="outline" size="sm" onClick={handleScoreOpen} className="gap-1.5">
     {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
     Run scoring
   </Button>
   ```
   (`Zap` is already imported.)

4. **New confirmation dialog** appended near the enrichment dialog:
   - Title: "Run scoring"
   - Description: "This will score all enriched products in the queue using Claude. Results are stored in intake_* tables only. No live data will be affected."
   - Loading state: spinner + "Scoring enriched products…"
   - Result state (inline summary):
     - Scored: X
     - Draft approved: X
     - Review: X
     - Rejected: X
     - Errors: X
   - Error state: red bordered box with `scoreError` text
   - Footer buttons:
     - Initial: "Cancel" + "Run scoring"
     - Result/error: "Close"

### Guarantees
- Only invokes `intake-score-test` edge function
- Uses existing admin auth wrapper (`RequireAdmin` on `/admin-portal`) — no new auth code
- No changes to enrichment flow, fetch flow, queue, brand tiers, or any other tab
- No DB schema, cron, or enum changes
- Errors surfaced inline; never swallowed

