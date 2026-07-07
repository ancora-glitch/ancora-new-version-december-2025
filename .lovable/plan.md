# Plan: Update Master Spec with RLS Policy Change

## What
Append a new changelog entry to the existing 2026-07-07 section in `ANCORA_MASTER_SPEC.md` documenting the products SELECT RLS policy change.

## Entry to insert (verbatim)

```text
### 2026-07-07 — RLS-fix på products: publik SELECT begränsad

Vad: Ersatte helt öppen SELECT-policy (qual: true) med två policies:

"Public can view active and sold products" (status IN active/sold,
allowlist — framtida statusar som archived/pending_import/review_required
exponeras INTE publikt by default) och "Admins can view all products"
(has_role-check). Åtgärdar security finding #6 (unpublished/internal
produktdata publikt läsbar sedan 2026-06-23).

Verifierat: anon-totalräkning 1358 (1022 sold + 336 active), draft-id
och status=eq.draft returnerar tomt för anon, sold-arkiv och sold-PDP
fungerar oförändrat för anon, admin ser alla 1370 rader inkl. 12 drafts.

tsgt --noEmit OK.

KRITISK KORRIGERING under processen: ursprungligt förslag (active+published)
hade brutit sold-arkivet/PDP/story-embeds — fångat av Lovables diagnos
INNAN produktion. Grundorsak: Claude kände inte till invarianten "sold-
produkter visas publikt som historisk proveniens" och gissade fel status-
lista utifrån bara useProducts.ts. Lärdom: fråga om alla publika
konsumtionsvägar innan RLS-policy ändras på en delad tabell.

DB: RLS-policy-ändring på products (SELECT only). Inga enum-ändringar,
inga INSERT/UPDATE/DELETE-policies rörda.

Öppen fråga, ej beslutad: ska archived/pending_import/review_required
någonsin vara publikt synliga? Just nu dolda by default.
```

## Where
Group it with the other 2026-07-07 changelog entries in `ANCORA_MASTER_SPEC.md`, immediately after the prior entry (around the top of the changelog section).

## Steps
1. Read current lines around the 2026-07-07 entries in `ANCORA_MASTER_SPEC.md`.
2. Insert the new entry immediately after the existing 2026-07-07 entries.
3. Save and verify the file still reads correctly.

## No code/DB/schema changes
This is a documentation-only edit to the project specification.