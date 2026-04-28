# Add new presentation penalties to intake-score-test

Update the `aiEvaluate` prompt in `supabase/functions/intake-score-test/index.ts` to expand the presentation rubric with the new penalties. No other code, function, table, or component is touched.

## File: `supabase/functions/intake-score-test/index.ts`

### Change 1 — Strict background instruction (line 145)

Replace the single paragraph with a stricter version that explicitly calls out mirror selfies, visible phones/hands, and plastic packaging as 0–1 regardless of brand or garment quality:

> Be strict about background quality. A home environment with furniture, walls, or personal items visible should score 1–2 regardless of garment quality. Mirror selfies, visible phones or hands, and items still in plastic packaging should score 0–1 regardless of brand or garment quality. Only professional or clean neutral backgrounds score above 6.

### Change 2 — Rubric scale (lines 147–152)

Update the score 1 and score 0 bullets to include the new penalty cases:

- **Score 1** — adds: mirror selfie; person's arm, hand, or phone visible in image; item still in plastic bag or packaging. (Keeps existing home environment language.)
- **Score 0** — adds: multiple items piled together. (Keeps existing on-floor / cluttered / very dark / blurry language.)

Score 10, 6, and 3 are unchanged.

### Out of scope (explicitly not touched)

- Numeric scoring functions (`imageCountScore`, `metadataScore`, `materialAdjustment`, `commercialScore`, `conditionAdjustment`, `categoryScore`)
- Decision thresholds (75 / 40)
- Hard/soft flags
- Guards (kill switch, feature flags, quota)
- `intake_evaluations` / `intake_normalized_products` / `intake_run_logs` writes
- `PROMPT_VERSION` / `RULES_VERSION` / `MODEL` constants — left as `v2` per instruction "do not modify any other logic"

## Invariants preserved

- No enum drift, no schema changes, no cron changes
- No quota or guard changes
- Only the AI prompt text within `aiEvaluate` is modified
