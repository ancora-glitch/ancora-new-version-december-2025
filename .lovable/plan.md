## Två fixar för intake → product promotion

### 1. Capitalize text fields i `intake-promote-product`
Lägg till en `capFirst()` helper i `supabase/functions/intake-promote-product/index.ts` och applicera på alla textfält innan insert i `products`:
- `brand`, `name`, `name_en`, `name_original`
- `description`, `description_en`
- `color`, `material`, `condition`, `size`

Helper:
```ts
const capFirst = (s: string | null | undefined) =>
  s ? s.trim().charAt(0).toUpperCase() + s.trim().slice(1) : s ?? null;
```

### 2. Hämta full description från eBay i `intake-fetch-test`
I `supabase/functions/intake-fetch-test/index.ts`, för varje eBay-item, gör ett extra `getItem`-anrop till Browse API (`/buy/browse/v1/item/{itemId}`) för att hämta fält `description` (full HTML), eftersom search-resultat ofta saknar eller har tom `shortDescription`.

- Strippa HTML-taggar och decode entities
- Fallback till `shortDescription` om full fetch failar
- Skriv till `description_raw` i `intake_normalized_products`

```ts
const itemRes = await fetch(`${ebayBase}/buy/browse/v1/item/${encodeURIComponent(externalId)}`, {
  headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB' }
});
// strip HTML + decode entities, fallback to shortDescription
```

### Constraints
- Inga andra edge functions modifieras
- Inga nya tabeller eller migrations
- Quota/cron-invarianter oförändrade
- Endast minimal yta i de två filerna
