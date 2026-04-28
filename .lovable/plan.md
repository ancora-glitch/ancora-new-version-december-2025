# Enhetlig översättning för alla importflöden

## Mål
Alla import-drawers ska köra samma översättningssteg som Tradera: heuristic först, sedan AI-anrop till `translate-swedish`, aldrig blockerande. Tradera-flödet rörs inte — det är referensen.

## Filer

### Nya filer

**`src/lib/languageDetect.ts`** — flytta `isLikelyEnglish` ur `TraderaSearchDrawer.tsx` (rad 112–121) ordagrant. Named export. Inga beteendeändringar.

**`src/lib/translateImport.ts`** — delad async helper enligt spec:
```ts
translateImport(opts: {
  title: string;
  description?: string;
  condition?: string;
  material?: string;
  size?: string;
  brand?: string;
  sourceRef: string;
}): Promise<{
  title_en: string | null;
  description_en: string | null;
  language: "sv" | "en";
  translated_at: string | null;
}>
```
Logik kopierad 1:1 från `TraderaSearchDrawer.tsx` rad 446–486:
1. `textToCheck = title + " " + (description ?? "")`
2. `isLikelyEnglish(textToCheck)` → returnera `{ title_en: title, description_en, language: "en", translated_at: now() }` utan AI-anrop.
3. Annars `supabase.functions.invoke("translate-swedish", { body: { name, description, condition, material, size, brand } })`.
   - Vid framgång (`data.name` finns): `language: "sv"`, `translated_at: now()`.
   - Vid fel/exception: console.warn + returnera `{ title_en: null, description_en: null, language: "sv", translated_at: null }`. Aldrig kasta vidare.

Helpern skickar **bara** `name/description/condition/material/size/brand` till translatorn — `brand` används som hint men muteras inte i resultatet (translatorn returnerar brand i sin response, vi ignorerar den och behåller källans `brand` på produkten). `price`, `currency`, `affiliate_url`, `slug`, `images`, `tags` och numeriska storlekar passerar aldrig genom helpern.

### Uppdaterade filer

**`src/components/admin/TraderaSearchDrawer.tsx`**
- Ta bort lokal `isLikelyEnglish`-funktion (rad 112–121).
- Lägg till `import { isLikelyEnglish } from "@/lib/languageDetect";`.
- Inget annat ändras. Tradera-importen använder fortsatt sin egna inline-logik (rad 446–486) — den rörs inte.

**`src/components/admin/ReDesignedBySearchDrawer.tsx`** (rad 161–238 `handleImportOne`)
- Före `importMutation.mutateAsync()`, anropa:
  ```ts
  const tx = await translateImport({
    title: detail.title,
    description,
    condition: detail.condition ?? undefined,
    material: detail.material ?? undefined,
    size: detail.size ?? undefined,
    brand: detail.vendor || undefined,
    sourceRef: detail.handle,
  });
  ```
- Ersätt nuvarande:
  ```ts
  title_en: detail.title,
  title_original: detail.title,
  description_en: description,
  description_original: description,
  language: "sv",
  ```
  med:
  ```ts
  title: detail.title,
  title_original: detail.title,
  title_en: tx.title_en,
  description,
  description_original: description,
  description_en: tx.description_en,
  language: tx.language,
  translated_at: tx.translated_at,
  ```

**`src/components/admin/VintageSphereSearchDrawer.tsx`** (rad 299–329 `importInput`)
- Anropa `translateImport()` före `importMutation.mutateAsync()` med `sourceRef: handle`, `brand: detail.vendor`.
- Ändra `title_en: detail.title` → `title_en: tx.title_en`.
- Ändra `description_en: description` → `description_en: tx.description_en`.
- Ändra `language: "en"` → `language: tx.language`.
- Lägg till `title_original: detail.title`, `description_original: description`, `translated_at: tx.translated_at`.

**`src/components/admin/EbaySearchDrawer.tsx`** (rad 259–285 `importInput`)
- Samma förändring. eBay-titlar är engelska by default → heuristic fångar det och `tx.language === "en"` utan AI-anrop. Ingen extra logik behövs, beteendet blir korrekt automatiskt.
- Behåll fallback-beskrivnings-flaggan (`_usedFallbackDescription`).

**`supabase/functions/translate-backfill/index.ts`** (rad 137–143)
- Ta bort `.eq('marketplace', 'tradera')` på rad 140 så jobbet plockar upp alla marketplaces (tradera + ebay + vintagesphere + redesignedby).
- Inga andra ändringar i filen — heuristic, budget, retry-logik och cron-registreringen rör jag inte.

## Invarianter som upprätthålls
- Tradera-flödet är oförändrat (importerar bara heuristic-helpern från ny fil).
- Alla tre kolumnerna (`title`, `title_original`, `title_en`) skrivs samtidigt i samma `mutateAsync()`-anrop. Memory Core: "Both base and `_en` fields updated simultaneously" — uppfyllt.
- Översättningsfel blockerar aldrig importen. Backfill städar.
- Inget anrop till `translate-swedish` om heuristic säger engelska → daglig budget skyddas.
- `brand`, `price`, `currency`, `affiliate_url`, `slug`, `images`, `tags` skickas aldrig till translatorn.
- `translate-swedish` Edge Function rörs inte.

## Filer som INTE ändras
- `supabase/functions/translate-swedish/index.ts`
- Tradera-importflödet i `TraderaSearchDrawer.tsx` (förutom 1 rad: ersätt lokal funktion med import).
- `supabase/functions/tradera-retry-import/index.ts` (server-side, har redan egen översättningslogik).
- `src/hooks/useImportToProduct.ts` (accepterar redan alla fält vi skickar).

## Risker / saker att flagga
- `translate-backfill` plockar nu även eBay-rader. eBay är på engelska — heuristic inne i backfill-jobbet (`isLikelyEnglish` på rad 170) hanterar detta och skriver `language='en'` utan att anropa AI:n. Ingen budgeteffekt förväntas.
- Importer blir marginellt långsammare (~200–800 ms per item när AI-anrop sker). För batch-importer (eBay/VintageSphere som importerar flera samtidigt) sker anropen sekventiellt — inom befintligt mönster.
