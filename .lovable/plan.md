# Add month-by-month dropdown filter to Statistics tab

Scope: `src/components/AnalyticsDashboard.tsx` only. No backend, schema, or other tab changes.

## Changes

### 1. Extend filter state

Replace the current `DateRange` type with a discriminated union:

```ts
type DateRange =
  | { kind: "rolling"; value: "7days" | "30days" | "all" }
  | { kind: "month"; year: number; month: number }; // month: 0-11
```

`useState<DateRange>({ kind: "rolling", value: "7days" })`.

### 2. Range computation

Update `getDateRangeStart` to return `{ start: Date | null; end: Date | null }`:
- rolling `7days`/`30days` → `start = now - N days`, `end = null`
- rolling `all` → both `null`
- month → `start = new Date(year, month, 1)`, `end = new Date(year, month + 1, 1)`

Update every `.gte("created_at", rangeStart.toISOString())` site (views, clicks, buyNow, pages, productClicks, purchaseClicks, chart query) to also apply `.lt("created_at", rangeEnd.toISOString())` when `end` is set.

For the chart (`chartDays` / `chartStart`): when month mode, use the selected month's day count and `chartStart = start of month`; the daily aggregation keys (`toLocaleDateString`) keep working unchanged.

Query key changes to include serialized range so React Query re-fetches per month.

### 3. Month options

Generate options once per render from March 2026 → current month, newest first:

```ts
const monthOptions = []; // { year, month, label, value: `${year}-${month}` }
// iterate from now back to 2026-03 (inclusive)
// label = new Date(year, month, 1).toLocaleDateString("sv-SE", { month: "long", year: "numeric" })
```

### 4. UI

In the filter row (currently the three buttons around line 427), add a native `<select>` after the buttons, styled to match the button height/border so it visually aligns:

```tsx
<select
  value={dateRange.kind === "month" ? `${dateRange.year}-${dateRange.month}` : ""}
  onChange={(e) => {
    const [y, m] = e.target.value.split("-").map(Number);
    setDateRange({ kind: "month", year: y, month: m });
  }}
  className={cn(
    "h-9 rounded-md border px-3 text-sm",
    dateRange.kind === "month"
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-background border-input"
  )}
>
  <option value="" disabled>Välj månad</option>
  {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
</select>
```

Rolling-button handlers set `{ kind: "rolling", value }`, which naturally resets the `<select>` value to `""` → placeholder "Välj månad" shown. Active-state highlight on buttons must check `dateRange.kind === "rolling" && dateRange.value === range`.

### 5. Labels

`getDateRangeLabel` extended: month mode → return the Swedish label from `toLocaleDateString("sv-SE", { month: "long", year: "numeric" })`. Used by the existing card subtitles and the "Trends (...)" heading without further edits.

`chartDays` interval rule (`interval={dateRange === "30days" ? 4 : 0}`) updated to use `0` for short ranges and `4` when computed day count ≥ 28.

## Out of scope
Product/editorial/import code, other tabs, query schema, Supabase migrations. Spec invariants (cron, quota, enums) untouched — UI-only change.
