Uppdatera `supabase/functions/sellpy-item/index.ts` så att den läser samma Algolia-fältvägar som `supabase/functions/sellpy-search/index.ts`, men behåll den nuvarande svarsstrukturen så att frontend/integrationer fortsätter fungera utan ändringar.

## Förändringar

### 1. Ersätt träff-extraheringen i `sellpy-item/index.ts`

Efter att `hit` har hämtats från Algolia (rad 127) och innan `item`-objektet sätts samman, ersätts nuvarande `extractImages`-anrop och alla `firstString`-extraktioner med exakt denna logik från `sellpy-search`:

```typescript
const metadata = (hit.metadata ?? {}) as Record<string, unknown>;
const pricing = (hit.pricing ?? {}) as Record<string, unknown>;

const brand = (metadata.brand as string) ?? null;
const type = (metadata.type as string) ?? "";
const size = (metadata.size as string) ?? null;
const title = [brand, type, size].filter(Boolean).join(" ") || "Untitled";
const price = typeof pricing.amount === "number" ? pricing.amount : null;

const colorArr = Array.isArray(metadata.color) ? metadata.color : [];
const materialArr = Array.isArray(metadata.material) ? metadata.material : [];

const available = hit.isForSale === true;
const condition_raw = (metadata.condition as string) ?? null;
const images = Array.isArray(hit.images) ? (hit.images as string[]) : [];
const objectID = String(hit.objectID ?? "");
```

Därefter sätts `item` ihop med den befintliga svarsstrukturen:

```typescript
const item = {
  external_id: objectID,
  title,
  handle: objectID,
  description: null,
  price,
  currency: "SEK",
  brand,
  size,
  color: colorArr.join(", ") || null,
  material: materialArr.join(", ") || null,
  condition: mapCondition(condition_raw),
  condition_raw,
  available,
  images,
  productUrl: `${PRODUCT_BASE}/${objectID}`,
  tags: [],
  era: null,
  vendor: brand ?? "Sellpy",
  productType: type,
};
```

### 2. Ta bort eller behåll hjälpfunktioner

- `extractImages` och `extractPrice` blir oanvända och kan tas bort.
- `firstString` blir oanvänd och kan tas bort.
- `mapCondition` och `CONDITION_MAP` behålls oförändrade eftersom de ger korrekt condition-mappning.
- `corsHeaders`, konstanter för Algolia, URL-byggare och felhantering behålls oförändrade.

### 3. Validering innan deploy

- Kör en snabb syntaxkontroll av filen.
- Verifiera att `condition_raw` fortfarande mappas via `mapCondition` till `new`, `very_good`, `good`, `fair` eller `null`.

### 4. Deploy

Deploya endast `sellpy-item` edge function.

### 5. Test

- Gör en ny sökning i Sellpy-drawern (admin > imports).
- Välj ett resultat och importera det.
- Verifiera att produkten skapas korrekt med fälten: titel, pris, brand, storlek, färg, material, skick, bilder och tillgänglighet.
- Om något fält saknas eller är fel, inspektera edge-function-loggarna och justera.