## Mål

Skapa två nya isolerade Edge Functions för partner-importören **ReDesignedBy** (Shopify JSON-mönster, speglar VintageSphere) och registrera dem i `supabase/config.toml`.

Ingen UI, inga DB-ändringar, inga ändringar i andra filer. Detta är endast backend-pipeline.

## Filer som skapas

### 1. `supabase/functions/redesignedby-search/index.ts`
Listing-adapter mot `https://redesignedby.se/products.json`.
- Paginering via `?limit=250&page=N`, max **5 sidor** (lägre än VS:s 20 — försiktig start)
- 429-retry en gång efter 2s, AbortController-timeout 15s
- Keyword-filter på title + vendor + productType + tags
- Normalisering: `extractSize`, `extractColor`, `extractMaterial` (tag-prefix `material:`)
- Bygger `affiliateUrl` med UTM-params (`utm_source=ancora`, `utm_medium=affiliate`, `utm_campaign=ancora_main`) — påslags-trigger
- Hård gräns: `MAX_PER_RUN = 10` (Master Spec), klamp på inkommande `limit`
- `dry_run`-stöd: returnerar normaliserade produkter utan DB-skrivning
- `external_id`-mönster: `rdb_{product_id}_{variant_id}`
- Returnerar `warnings[]` (t.ex. om ingen produkt hämtas → notis om eventuell API-token)

### 2. `supabase/functions/redesignedby-item/index.ts`
Item-adapter mot `https://redesignedby.se/products/{handle}.json`.
- Hämtar fullt item: `images[]` (sorterade på `position`), `descriptionHtml`, `descriptionText` (HTML-strippad)
- `extractCondition()` — tre strategier: stjärnor (⭑⭐★) → text-mönster ("Skick:", "Condition:") → tags. Mappar till Ancora-enum: `new | very_good | good | fair | poor | null`
- `extractEra()` — regex `Era:\s*(\d{4}'?s?)` (paritet med VS, returnerar oftast null)
- `extractSize` / `extractColor` — letar via `options[].name` (Size/Storlek, Color/Colour/Färg) och plockar rätt `optionN` från varianten
- Returnerar `marketplace: "redesignedby"` och `status: "draft"` hårdkodat
- 404 från Shopify → 404 från edge function

### 3. `supabase/config.toml` — lägg till längst ner
```toml
[functions.redesignedby-search]
verify_jwt = false

[functions.redesignedby-item]
verify_jwt = false
```

## Spec-validering (Master Spec v1.7)

| Invariant | Status |
|---|---|
| `marketplace` lowercase snake_case (`redesignedby`) | OK |
| `status` alltid `"draft"` — aldrig auto-publish | OK (hårdkodat i `transformItem`) |
| Inga editorial fields skrivs över | OK (edge functions skriver inte alls — returnerar bara JSON) |
| Max 10 per run | OK (`MAX_PER_RUN = 10`, klamp i `searchProducts`) |
| Isolerad från Tradera/eBay-flöden | OK (separata filer, ingen shared state) |
| Cron oförändrat (nattlig 03:00 UTC) | OK (manuell import, ingen cron-registrering) |
| Quota-guard | N/A (publik Shopify JSON, ingen API-nyckel, ingen delad räknare) |
| Enum-driftsskydd | OK (`AncorCondition`-typ med endast godkända värden) |

## Pending — bekräftas på mötet tisdag

Dessa är dokumenterade som kommentarer i koden så de inte glöms:
- Är `redesignedby.se/products.json` publik utan token? Annars: lägg till `X-Shopify-Access-Token`-header + Vault-secret
- Exakta UTM-param-namn för 10%-påslaget (placeholder: `utm_source=ancora`)
- `extractCondition()` — använder ReDesignedBy stjärnor i body_html, metafield, eller tags?
- `extractColor` / `extractMaterial` — variant title, metafield, eller tag?

## Vad som INTE ingår

- Ingen `ReDesignedBySearchDrawer.tsx` (din tidigare meddelande-spec — nu uttryckligen exkluderad)
- Inga ändringar i `ImportsTab.tsx`
- Inga DB-migrationer (eftersom `marketplace` är `text`, inte enum — kontrollerat: `products.marketplace` är fritext)
- Ingen koppling till `useImportToProduct` eller annan import-pipeline
- Inga tester (existerande VS-funktioner har inga heller)

## Efter godkännande

Jag deployar båda funktionerna och kör en snabb smoke-test mot `redesignedby-search` med `{ dry_run: true, limit: 3 }` för att bekräfta att Shopify-endpointen är publik. Om den returnerar 401/403 rapporterar jag det direkt så du vet att en API-token krävs innan tisdagsmötet.