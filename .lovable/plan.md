## Add Pure Effect as Statistics Source Filter

### Context
The `AnalyticsDashboard` component (`src/components/AnalyticsDashboard.tsx`) renders the Statistics tab in AdminPortal. It already has source filter buttons: **All Sources | Tradera | eBay | VintageSphere**.

### Changes

1. **Extend `SourceFilter` type** (line 17):
   ```ts
   type SourceFilter = "all" | "tradera" | "ebay" | "vintagesphere" | "pure_effect";
   ```

2. **Add Pure Effect filter button** (lines 405–420):
   - Append `"pure_effect"` to the source filter array: `(["all", "tradera", "ebay", "vintagesphere", "pure_effect"] as SourceFilter[])`
   - Add label mapping in the ternary on line 417: `source === "pure_effect" ? "Pure Effect" : "VintageSphere"` (insert before the VintageSphere branch)

### Why nothing else needs to change

The existing `matchesSource` helper (lines 107–110) already works dynamically:
```ts
const matchesSource = (productId: string | undefined): boolean => {
  if (sourceFilter === "all" || !productId) return true;
  return mpMap[productId] === sourceFilter;
};
```
It compares the selected `sourceFilter` against the `product.marketplace` value (normalized to lowercase in the `productMarketplaceMap` fetch). Since Pure Effect products are stored with `marketplace = 'pure_effect'`, selecting the new filter will correctly filter Product Clicks and Purchase Intent (Buy Now clicks) — exactly as Tradera, eBay, and VintageSphere do today.

Unique Visitors and Page Views are global metrics and are not filtered per partner in the current implementation either, so behavior remains consistent across all four filters.

---

## Session 2026-05-20 — Ändringar

### 1. Pure Effect Sweden — ny manuell import-partner

Ny partner tillagd modellerad efter VintageSphere

- **Endpoint:** `https://www.pureeffectsweden.com/collections/kladvard/products.json`
- **Teknisk metod:** Shopify publikt JSON-API, ingen auth
- **Två nya edge functions:** `pureeffect-search` + `pureeffect-item`
- **Ny drawer:** `src/components/PureEffectSearchDrawer.tsx`
- **Knapp tillagd i AdminPortal → Imports-tab**

**Invarianter:**
- `condition` alltid `null`
- `status` alltid `draft`
- `marketplace = 'pure_effect'`
- cap 10/session
- inga cron-jobb
- ingen sold-detection
- ingen editorial overwrite

`marketplace`-kolumnen är plain text (ej ENUM) — ingen DB-migration krävdes

---

### 2. Care — ny top-level shop-kategori

Ny kategori tillagd på samma nivå som Clothing, Shoes, Bags, Accessories

- **DB:** rad insertad i `categories` (name: Care, slug: care, status: published, id: 1ff0f814-be77-4b3c-97de-46ab66b1e4f3)
- **Header.tsx:** `{ label: "Care", href: "/category/care" }` tillagd i `shopCategories`
- **Shop.tsx och CategoryPage.tsx** opåverkade (dynamiska)
- **Inga subkategorier**

---

### 3. ProductDetail.tsx — Care-specifik rendering

Fälten `condition`, `material` och `color` döljs på publika produktsidan när produkten tillhör Care-kategorin

**Fix:** Supabase returnerar `categories`-relationen som array — löstes med:

```ts
const categoryRel = (product as any).categories;
const categorySlug = Array.isArray(categoryRel)
  ? categoryRel[0]?.slug
  : categoryRel?.slug;
const isCare = categorySlug === "care";
```

Samma dolda fält applicerat i AdminPortal produktredigering

---

### 4. Marketplace display labels — komplett mappning

ProductDetail.tsx visade inte korrekt källetikett för alla partners

Komplett mappning tillagd:

```ts
const sourceLabel: Record<string, string> = {
    tradera: "Tradera",
    ebay: "eBay",
    vintagesphere: "VintageSphere",
    pure_effect: "Pure Effect",
    manual: "Manual",
  };
```

---

### 5. AnalyticsDashboard — Pure Effect som statistikfilter

- `SourceFilter`-typen utökad med `"pure_effect"`
- Pure Effect-knapp tillagd i filterraden bredvid VintageSphere
- `matchesSource`-helpern fungerar dynamiskt — inga ytterligare ändringar krävdes
- Unique Visitors och Page Views förblir globala mätvärden (ej partner-filtrerade), konsistent med övriga partners

---

## Aktiv logg — klistra in i ANCORA Context

### 2026-05-22 — Swimwear subkategori under Clothing
**Vad:** Swimwear tillagd som ny subkategori under Clothing. Följer samma mönster som övriga Clothing-subkategorier.

**Filer:**
- `src/components/Header.tsx`
- `src/pages/Shop.tsx`
- `src/pages/CategoryPage.tsx`
- `src/pages/AdminPortal.tsx`

**DB:** Migration — `validate_product_subcategory()` trigger uppdaterad med `'swimwear'`.

**Notering:** Subkategorier är hardcoded i fyra filer + DB-trigger. Alla platser uppdaterade.

### 2026-05-20 — Pure Effect, Care-kategori, UI-fixes
**Vad:** Pure Effect Sweden tillagd som manuell partner. Care tillagd som top-level kategori. condition/material/color döljs för Care i både admin och publika sajten. Marketplace-labels komplettterade för alla partners. Pure Effect tillagd som statistikfilter i AnalyticsDashboard.

**Filer:**
- `supabase/functions/pureeffect-search/index.ts` (ny)
- `supabase/functions/pureeffect-item/index.ts` (ny)
- `src/components/PureEffectSearchDrawer.tsx` (ny)
- `src/components/AnalyticsDashboard.tsx`
- `src/pages/ProductDetail.tsx`
- `src/pages/AdminPortal.tsx`
- `src/components/Header.tsx`

**DB:** INSERT categories (Care, care, published). Ingen enum-migration (marketplace är plain text).

**Notering:** categories-relation från Supabase returneras som array — slug-check måste hantera båda formaten.
