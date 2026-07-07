## Multi-token färgfilter

### Ändringar

**1. `src/utils/normalizeColor.ts`**
- Lägg till `"off white"` / `"off-white"` → `"Off-white"` i `MANUAL_COLOR_ALIASES`.
- Exportera ny `splitColorValue(rawColor)` som splittar på `,` `/` `&` samt " och " (case-insensitive), trimmar och filtrerar tomma tokens.

**2. `src/pages/Shop.tsx` + `src/pages/CategoryPage.tsx`**
- Importera `splitColorValue`.
- `colorOptions`: iterera produkter → för varje produkt splitta color, gruppera varje token via `colorGroupKey` med `canonicalColorDisplay` som visningsvärde.
- Filtrering: produkt matchar om någon av dess splittade tokens (som group-key) finns bland `activeFilters.colors` (som group-keys). Produkter utan color exkluderas när filter är aktivt.
- Rör inte visning av color på ProductCard/grid — endast filter-sidebar och matchningslogik.

### Konkret utfall av splitten (från audit)

Rena, väntade splittar (majoriteten):
- `Black / White` → `Black`, `White`
- `Beige / Black / White / Yellow` → 4 rena tokens
- `Black & Gold` → `Black`, `Gold`
- `Beige, Camel, Black, White` → 4 rena tokens
- `Black/grey`, `Blue/Brown`, `Gold/Silver`, `Green/Blue`, `Grey/Pink` → splittar korrekt (regex kräver inte whitespace runt `/`)

Kluster som konsolideras via `colorGroupKey` (case-insensitive):
- `Black, White` + `Black, white` + `Black & White` + `Black / White` → alla producerar tokens `Black` + `White`
- `Gold` + `gold`, `Green` + `green` → en grupp vardera

Potentiellt "brusiga" tokens att vara medveten om (får egen filter-chip):
- `Dark navy / black pinstripe` → `Dark navy`, `black pinstripe` (den senare är ovanlig som fristående färg)
- `Light & Dark Blue` → `Light`, `Dark Blue` (tappar semantik — "Light" blir en fristående chip)
- `Brown, Blue & Pink` → `Brown`, `Blue`, `Pink` (OK)
- Ej berörda av split (saknar separator): `Anthracite (Dark grey)`, `Black leather with gold hardware`, `Butter yellow`, `Charcoal grey`, `Dark taupe`, `Faded Green`, `Khaki Green`, `Light military green`, `Moss Green`, `Olive Green`, `Orange Rust`, `Pale Pink`, `Caramel Brown`, `Mint green`, `Cream White`, `Dark Sand`, `Dark Khaki`, `Golden yellow`, `Mid blue`, `Mixed blue` m.fl. — dessa fortsätter fungera som en chip var.

Om `Light` som fristående chip stör kan `MANUAL_COLOR_ALIASES` senare mappa den, alternativt lägga en pre-split-normalisering — utanför denna PR.

### Verifiering
- `tsgo --noEmit` ska passera.
- Ingen DB-migration; `products.color` orört.
- Manuell rök-test: öppna Shop → färgfiltret ska visa splittrade primärfärger (t.ex. `White` som egen chip även om ingen produkt har enbart White) och filtrera korrekt.
