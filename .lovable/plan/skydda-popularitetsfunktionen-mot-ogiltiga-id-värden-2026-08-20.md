# Skydda popularitetsfunktionen mot ogiltiga id-värden

## Bakgrund (verifierat)

- Anropet fungerar helt utan inloggning: HTTP 200, 939 rader, endast fälten `product_id` och `click_count`.
- Ingen skräpdata finns idag: 0 klick-events har ett `product_id` som inte är ett giltigt UUID.

## Ändring

En migration som skriver om `get_product_popularity` med ett extra villkor: rader vars `product_id` inte har giltigt UUID-format hoppas över innan värdet konverteras. Allt annat i funktionen är oförändrat — samma resultatfält, samma tidsfönster, samma behörigheter.

Effekten är enbart förebyggande: skulle en felaktig rad någonsin hamna i analysdatan ignoreras just den raden istället för att hela anropet fallerar.

## Verifiering

- Kör funktionen igen och bekräfta samma radantal som idag (939) och oförändrade fält.
- Bekräfta att oautentiserat anrop fortfarande ger 200.
- Ingen frontend-ändring, ingen ändring av data eller index.
