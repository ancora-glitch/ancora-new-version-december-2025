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