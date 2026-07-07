// Normaliserar ENDAST för gruppering/jämförelse i filter-UI.
// Rör aldrig products.brand i databasen.

/**
 * Skapar en normaliserad nyckel för att gruppera ihop brand-varianter
 * som bara skiljer sig i case eller diakritiska tecken.
 * Exempel: "PRADA", "Prada", "prada" → samma nyckel
 *          "Toteme", "Totéme" → samma nyckel
 */
export const brandGroupKey = (brand: string): string => {
  return brand
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // ta bort diakritiska tecken (é→e, ö→o, etc.)
    .trim()
    .toLowerCase();
};

/**
 * Manuell alias-karta för kluster som INTE kan lösas algoritmiskt,
 * t.ex. skillnader i ordföljd/kapitalisering av enskilda ord ("by" vs "By").
 * Nyckel = brandGroupKey-resultat, värde = kanonisk visningsform.
 * Fylls på manuellt när audit-queryn (steg 1) visar fler kluster.
 */
const MANUAL_BRAND_ALIASES: Record<string, string> = {
  "see by chloe": "See by Chloé",
  "see by chloé": "See by Chloé",
};

/**
 * Returnerar kanonisk visningsform för ett brand-värde.
 * 1. Om manuell alias finns → använd den.
 * 2. Annars: generisk Title Case (versal första bokstav i varje ord,
 *    resten gemener) — täcker Prada, Toteme, Totéme etc.
 */
export const canonicalBrandDisplay = (brand: string): string => {
  const key = brandGroupKey(brand);
  if (MANUAL_BRAND_ALIASES[key]) return MANUAL_BRAND_ALIASES[key];

  return brand
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
