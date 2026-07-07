Mål: Justera vertikal spacing så att avståndet mellan filter/sortera-raden och kategoriraden är lika stort som avståndet mellan kategoriraden och sidrubriken (t.ex. "Clothing").

Förändringar:

1. src/pages/CategoryPage.tsx
   - Ändra subkategori-wrapperns nederkantsmarginal från `mb-10 md:mb-14` till `mb-8 md:mb-12` — samma marginal som page header har nedåt.

2. src/pages/Shop.tsx
   - Ta bort den separata spacer-diven (`mb-6 md:mb-10`) mellan subkategori-raden och toolbar.
   - Lägg `mb-8 md:mb-12` på subkategori-wrappern istället.
   - Ta bort `pb-4` från den inre subkategori-containern; behåll `pt-1` så att hover-övergången behålls.

3. Verifiering
   - Kör `tsgo --noEmit` för att säkerställa att ändringarna typecheckar.

Vad som inte ändras:
- Ingen logik, state, queries eller backend/DB.
- ProductToolbar, ProductFilters, CategoryScrollMenu rörs inte.
- Hover-beteendet på Shop och sortering/filter-funktionalitet förblir oförändrad.

Filer som ändras: src/pages/CategoryPage.tsx, src/pages/Shop.tsx.