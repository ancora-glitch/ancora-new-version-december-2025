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
    .replace(/[\s\u00A0\u200B]+/g, " ") // kollapsa alla whitespace-typer (inkl. NBSP, ZWSP) till ett vanligt mellanslag
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
  // See by Chloé
  "see by chloe": "See by Chloé",
  "see by chloé": "See by Chloé",

  // Mads Nørgaard (ø är inte en diakritisk kombination — NFD-strippning löser den inte)
  "mads norgaard": "Mads Nørgaard",
  "mads nørgaard": "Mads Nørgaard",
  "mads norgaard copenhagen": "Mads Nørgaard",

  // Dr. Martens (punkt-variant)
  "dr martens": "Dr. Martens",
  "dr. martens": "Dr. Martens",

  // Ganni x Levi's (apostrof-teckenkodning)
  "ganni x levi's": "Ganni x Levi's",

  // Stockholm Surfboard Club (parentes-variant)
  "stockholm (surfboard) club": "Stockholm Surfboard Club",
  "stockholm surfboard club": "Stockholm Surfboard Club",

  // Barbour-collabs (case-varianter, redan täckta av Title Case men explicit
  // för tydlighet kring x-separator)
  "barbour x alexa chung": "Barbour x Alexa Chung",
  "barbour x ganni": "Barbour x Ganni",

  // Rotate — alltid fullt namn
  "rotate": "Rotate Birger Christensen",
  "rotate birger christensen": "Rotate Birger Christensen",
  "rotate briger christensen": "Rotate Birger Christensen", // känt stavfel i källdata

  // By Malina — samma varumärke
  "by malina": "By Malina",
  "malina": "By Malina",

  // Acne — slås ihop till en grupp (redaktionellt beslut, 2026-07-07)
  "acne": "Acne Studios",
  "acne jeans": "Acne Studios",
  "acne studios": "Acne Studios",

  // House of Dagmar — kort form aliasas till fullt namn
  "dagmar": "House of Dagmar",
  "house of dagmar": "House of Dagmar",
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
