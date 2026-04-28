# Enhetlig översättning för alla importflöden

Plan godkänd — implementation enligt `.lovable/plan.md`. Tradera-flödet rörs inte i sak (bara import-byte).

## Nya filer

**`src/lib/languageDetect.ts`**
- Named export `isLikelyEnglish(text: string): boolean`.
- Logik kopierad ordagrant från `TraderaSearchDrawer.tsx` rad 113–121.

**`src/lib/translateImport.ts`**
- Named export `translateImport(opts)` med signatur enligt spec.
- Logik kopierad 1:1 från Tradera (rad 446–486):
  1. `textToCheck = title + " " + (description ?? "")`
  2. `isLikelyEnglish(textToCheck)` → returnera `{ title_en: title, description_en: description ?? null, language: "en", translated_at: now() }`.
  3. Annars `supabase.functions.invoke("translate-swedish", { body: { name, description, condition, material, size, brand } })`.
  4. På success med `data.name`: `language: "sv"`, `translated_at: now()`.
  5. På fel/exception: `console.warn` + returnera `{ title_en: null, description_en: null, language: "sv", translated_at: null }`. Aldrig kasta.

## Uppdaterade filer

**`src/components/admin/TraderaSearchDrawer.tsx`**
- Ta bort lokal `isLikelyEnglish` (rad 112–121).
- Lägg till `import { isLikelyEnglish } from "@/lib/languageDetect";`.
- Inget annat ändras.

**`src/components/admin/ReDesignedBySearchDrawer.tsx`** (`handleImportOne`)
- Före `importMutation.mutateAsync`, kalla `translateImport({ title: detail.title, description, condition, material, size, brand: detail.vendor || undefined, sourceRef: detail.handle })`.
- Ersätt hårdkodade `title_en/description_en/language` med `tx.title_en`, `tx.description_en`, `tx.language` och lägg till `translated_at: tx.translated_at`. `title_original`/`description_original` behålls.

**`src/components/admin/VintageSphereSearchDrawer.tsx`** (`importInput`)
- Anropa `translateImport({ ..., brand: detail.vendor, sourceRef: handle })`.
- `title_en` → `tx.title_en`, `description_en` → `tx.description_en`, `language` → `tx.language`.
- Lägg till `title_original: detail.title`, `description_original: description`, `translated_at: tx.translated_at`.

**`src/components/admin/EbaySearchDrawer.tsx`** (`importInput`)
- Samma uppdatering. eBay-titlar är engelska → heuristic skippar AI utan extra logik.
- Behåll `_usedFallbackDescription`.

**`supabase/functions/translate-backfill/index.ts`** (rad 140)
- Ta bort `.eq('marketplace', 'tradera')`. Inga andra ändringar.

## Invarianter
- Tradera-importflödet oförändrat i beteende.
- `title`, `title_original`, `title_en` skrivs samtidigt i samma `mutateAsync`.
- Översättningsfel blockerar aldrig import.
- Heuristic skyddar daglig översättningsbudget.
- `translate-swedish` Edge Function rörs inte.

## Risk
- `translate-backfill` plockar nu även eBay/VS/RDBY. Heuristic i backfill (rad 170) hanterar engelska utan AI-anrop → ingen förväntad budgeteffekt.
