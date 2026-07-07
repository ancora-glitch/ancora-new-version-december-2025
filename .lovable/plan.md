## Plan: Filter & Sort UI för Shop och CategoryPage

Implementera exakt enligt specifikationen — inga andra ändringar.

### Nya filer
1. `src/constants/subcategories.ts` — delad `CLOTHING_SUBCATEGORIES` + `SubcategoryOption`-typ.
2. `src/components/CategoryScrollMenu.tsx` — horisontell scrollbar-meny för subkategorier (delas av Shop + CategoryPage).
3. `src/components/ProductFilters.tsx` — sidebar med collapsible grupper för Färg/Storlek/Varumärke + `ActiveProductFilters`-typ och `EMPTY_FILTERS`.
4. `src/components/ProductToolbar.tsx` — "Visa/Dölj filter"-knapp + sort `<Select>` (Pris ↑/↓, Senast inkommet).

### Ändrade filer
5. `src/hooks/useProducts.ts` — lägg endast till `parsePriceValue`-export längst ner. Inga andra ändringar.
6. `src/pages/Shop.tsx`
   - Ta bort lokal `CLOTHING_SUBCATEGORIES`, importera delad + nya komponenter + `useMemo` + `parsePriceValue`.
   - Ny state: `filtersOpen`, `sortValue`, `activeFilters`.
   - Ersätt subcategory-knappsblocket (både desktop overlay och mobile) med `<CategoryScrollMenu>`, wrap i befintlig `showSubcategories`-logik (hover-state orörd). När sub väljs och clothing inte är vald → auto-välj clothing-kategorin.
   - Bygg om filtrering: `categoryFilteredProducts` (bas) → dynamiska color/size/brand-optioner → `filteredProducts` (applicerar activeFilters + sortering). `sortValue === null` behåller ursprunglig `created_at desc`-ordning.
   - Lägg `<ProductToolbar>` ovanför griden och wrap grid i flex-layout med `<ProductFilters>` som sidebar (endast när `filtersOpen`).
7. `src/pages/CategoryPage.tsx`
   - Samma mönster: delad import, ny state, ersätt subcategory-block med `<CategoryScrollMenu>` (endast när `isClothing`).
   - Bygg om `filteredProducts` via `subcategoryFilteredProducts` + dynamiska optioner. `sortValue === null` → INGET extra sort-anrop, behåller `sort_order asc` från queryn.
   - Lägg `<ProductToolbar>` + wrap grid i flex+sidebar-layout.

### Invarianter som bevaras
- Ingen ändring i DB-schema, enums, categories/products-tabeller, eller queries.
- Default-ordning oförändrad när ingen sortering vald (Shop = `created_at desc`, CategoryPage = `sort_order asc`).
- Hover/show-logik för subcategories oförändrad i Shop.
- Grid-JSX (kort-rendering, "All gone"-empty state, loading skeleton) orörd — bara wrappad i flex-container.
- `CLOTHING_SUBCATEGORIES` finns nu på exakt ett ställe.

### Verifiering
`tsgo --noEmit` efter ändringarna.
