## Switch eBay intake from UK to Italy

Two surgical edits to two edge function files. No other logic touched.

### File 1: `supabase/functions/intake-fetch-test/index.ts`

1. **Line 123** — `fetchEbayItemDetails` headers: `EBAY_GB` → `EBAY_IT`
2. **Line 394** — `const SEK_RATES_GBP = 13;` → `const SEK_RATES_EUR = 11.5;`
3. **Line 421** — `minGbp` → `minEur` (rename + use new constant)
4. **Line 422** — filter string: `price:[${minGbp}..],priceCurrency:GBP,itemLocationCountry:GB` → `price:[${minEur}..],priceCurrency:EUR,itemLocationCountry:IT`
5. **Line 444** — search loop headers: `EBAY_GB` → `EBAY_IT`

### File 2: `supabase/functions/ebay-search/index.ts`

6. **Line ~352** — search headers: `EBAY_GB` → `EBAY_IT`
7. **Lines ~338–339** — remove `euroCountries` variable; replace `locationFilter` with `itemLocationCountry:IT`

### Out of scope (explicitly untouched)

- campid / affiliate URL values
- enum values (`draft`, `ebay`, `very_good`, etc.)
- quota guards, kill switch, INTAKE_* flags
- editorial fields (name, description, brand, color, material, condition)
- CORS, auth, rate limiting
- `SEK_RATES` map inside item processing loop (line 542) — separate currency conversion table, not the search-filter constant

### Verification after implementation

- Deploy both functions
- One test invocation of `intake-fetch-test` with `max_items: 5` to confirm Italian results return and no 4xx from eBay
