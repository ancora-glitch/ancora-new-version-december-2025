// Samma mönster som normalizeBrand.ts — ren display/filter-normalisering,
// rör aldrig products.color i databasen.

export const colorGroupKey = (color: string): string => {
  return color
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\u00A0\u200B]+/g, " ")
    .trim()
    .toLowerCase();
};

const NO_SPLIT_OVERRIDES: Record<string, string> = {
  "light & dark blue": "Light & Dark Blue", // semantiskt en färg, inte två
};

// Fylls på manuellt om audit-queryn visar kluster som inte löses
// algoritmiskt (t.ex. "Off white" vs "Off-white" — bindestreck-variant).
const MANUAL_COLOR_ALIASES: Record<string, string> = {
  "off white": "Off-white",
  "off-white": "Off-white",
};

/**
 * Splittar ett rått color-värde på vanliga separatorer (komma, slash, "&",
 * " och ") till individuella färg-tokens. Trimmar och filtrerar tomma.
 * Vissa värden behandlas som en enda semantisk färg och splittas inte.
 */
export const splitColorValue = (rawColor: string): string[] => {
  const key = rawColor.trim().toLowerCase();
  if (NO_SPLIT_OVERRIDES[key]) {
    return [NO_SPLIT_OVERRIDES[key]];
  }
  return rawColor
    .split(/\s*[,/&]\s*|\s+och\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

export const canonicalColorDisplay = (color: string): string => {
  const key = colorGroupKey(color);
  if (MANUAL_COLOR_ALIASES[key]) return MANUAL_COLOR_ALIASES[key];
  return color
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
