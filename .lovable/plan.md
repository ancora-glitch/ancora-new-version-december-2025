## Plan: English translation in intake-enrich-test

### 1. DB migration (required first)
Add `description_clean text` column to `intake_normalized_products`. Without it the new `.update({ description_clean: ... })` call will fail with "column does not exist". Mirrors the existing `title_clean` pattern.

```sql
ALTER TABLE public.intake_normalized_products
  ADD COLUMN description_clean text;
```

### 2. Code changes — `supabase/functions/intake-enrich-test/index.ts`

**Change A — `userPrompt()`**
Replace the function with the new version that:
- Adds an instruction line telling Claude the listing may be Italian/other language and that all output fields must be translated to English
- Adds `description_clean` (2-3 sentence editorial English description) to the JSON schema
- Tags `title_clean`, `style_tags`, `editorial_notes` as English

**Change B — `.update({...})` call inside the product loop**
Add `description_clean: (enriched.description_clean as string) || null,` between the existing `title_clean` and `style_tags` lines.

### 3. Out of scope (explicitly untouched)
- No changes to guards, kill-switch, flags, auth, model, prompt_version
- No changes to logging, brand-tier lookup, confidence handling
- No changes to `current_queue_state` transitions
- No edits to other functions or frontend

### 4. Verification
After migration + edit, invoke `intake-enrich-test` and confirm an enriched row has English `title_clean` and `description_clean` populated.