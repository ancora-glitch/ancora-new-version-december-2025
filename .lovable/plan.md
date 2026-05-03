## Goal

Add a source selector to the "Trigger test run" modal in the Intake (test) tab and route the call to the correct edge function. The "Run all" button uses the same alternating logic but without a UI selector.

Single file edited: `src/components/admin/IntakeTab.tsx`. No edge functions, tables, or other components touched.

## Helpers (added at top of file, before the component)

```ts
type SourceChoice = "auto" | "ebay" | "redesignedby";

async function getNextAlternatingSource(): Promise<"ebay" | "redesignedby"> {
  const { data } = await supabase
    .from("intake_run_logs" as any)
    .select("source")
    .eq("run_type", "fetch")
    .in("source", ["ebay", "redesignedby"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data as any)?.source;
  if (last === "ebay") return "redesignedby";
  if (last === "redesignedby") return "ebay";
  return "ebay";
}

const fnForSource = (s: "ebay" | "redesignedby") =>
  s === "redesignedby" ? "intake-fetch-redesignedby" : "intake-fetch-test";

const bodyForSource = (s: "ebay" | "redesignedby", dryRun: boolean) =>
  s === "redesignedby" ? { dry_run: dryRun } : { source: "ebay", dry_run: dryRun };
```

## State additions

```ts
const [sourceChoice, setSourceChoice] = useState<SourceChoice>("auto");
const [nextAutoSource, setNextAutoSource] = useState<"ebay" | "redesignedby">("ebay");
```

## Resolve next source when the dialog opens

`handleTrigger` becomes async-ish: after resetting state, fetch `getNextAlternatingSource()` and set `nextAutoSource`. The label `Next source: eBay` / `Next source: ReDesignedBy` is rendered from this state.

```ts
const handleTrigger = async () => {
  setRunResult(null);
  setRunError(null);
  setConfirmMode(null);
  setSourceChoice("auto");
  setDialogOpen(true);
  const next = await getNextAlternatingSource();
  setNextAutoSource(next);
};
```

`handleCloseDialog` also resets `sourceChoice` back to `"auto"`.

## Modal UI changes (inside the existing `dialogOpen` Dialog)

Inserted directly above the existing "Dry run / Live run" selector (i.e., inside the `confirmMode === null` branch around lines 685-712), before the two mode buttons:

```tsx
<div className="space-y-2 pb-2">
  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
    Source
  </label>
  <div className="grid grid-cols-3 gap-2">
    {(["auto", "ebay", "redesignedby"] as SourceChoice[]).map((opt) => (
      <Button
        key={opt}
        type="button"
        variant={sourceChoice === opt ? "default" : "outline"}
        size="sm"
        onClick={() => setSourceChoice(opt)}
      >
        {opt === "auto" ? "Auto (alternating)" : opt === "ebay" ? "eBay only" : "ReDesignedBy only"}
      </Button>
    ))}
  </div>
  {sourceChoice === "auto" && (
    <p className="text-xs text-muted-foreground">
      Next source: {nextAutoSource === "redesignedby" ? "ReDesignedBy" : "eBay"}
    </p>
  )}
</div>
```

The existing two-button "Dry run / Live run" block stays exactly as is below this selector. The confirm screen (`confirmMode !== null`) also gets a one-liner showing the resolved source so the user can see what will run:

```tsx
<p className="text-sm text-muted-foreground">
  Source: <span className="font-medium text-foreground">
    {sourceChoice === "auto"
      ? `Auto (next: ${nextAutoSource === "redesignedby" ? "ReDesignedBy" : "eBay"})`
      : sourceChoice === "redesignedby" ? "ReDesignedBy only" : "eBay only"}
  </span>
</p>
```

The existing amber "fetch up to N items" notice stays; no copy changes there.

## handleConfirmRun rewiring

```ts
const handleConfirmRun = async () => {
  if (!confirmMode) return;
  setIsRunning(true);
  setRunError(null);
  setRunResult(null);
  try {
    const resolvedSource: "ebay" | "redesignedby" =
      sourceChoice === "auto" ? nextAutoSource : sourceChoice;
    const fnName = fnForSource(resolvedSource);
    const body = bodyForSource(resolvedSource, confirmMode === "dry");
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    // ...existing error/result handling, unchanged shape
  } finally {
    setIsRunning(false);
  }
};
```

The result-summary mapping stays identical (both edge functions return the same shape: `items_fetched`, `items_processed`, `rules_rejected`, `review`, `draft_approved`, `errors`, `dry_run`).

## Run all — alternating, no selector

`handleConfirmRunAll` is updated so step 1 calls the alternating function:

```ts
const next = await getNextAlternatingSource();
const fnName = fnForSource(next);
const body = bodyForSource(next, false);
const r1 = await supabase.functions.invoke(fnName, { body });
```

Steps 2 (`intake-enrich-test`) and 3 (`intake-score-test`) are unchanged. Result-summary aggregation is unchanged. No UI selector is added to the Run-all dialog. The alternating decision is resolved fresh at the moment the user confirms, so back-to-back Run-all clicks naturally toggle.

## Out of scope (untouched)

- No edge function changes.
- No `Run enrichment` or `Run scoring` dialog changes.
- No DB migration.
- No changes to the result-summary cards, recent-runs table, queue summary, or review queue.
- `handleSelectMode`, `handleCloseDialog` (apart from also resetting `sourceChoice`), and the existing "Back" / "Confirm & run" footer remain.

## Validation

1. Open Trigger test run → see three-button source selector, "Auto" pre-selected, "Next source: …" hint reflects the most recent fetch row in `intake_run_logs`.
2. Pick "eBay only" + Live → invokes `intake-fetch-test` with `{ source: "ebay", dry_run: false }`.
3. Pick "ReDesignedBy only" + Dry → invokes `intake-fetch-redesignedby` with `{ dry_run: true }`.
4. Pick "Auto" after the latest fetch was eBay → confirm screen shows "next: ReDesignedBy", and the call goes to `intake-fetch-redesignedby`.
5. "Run all" two times in a row → alternates eBay → ReDesignedBy → eBay automatically.
