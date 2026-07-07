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

// Fylls på manuellt om audit-queryn visar kluster som inte löses
// algoritmiskt (t.ex. "Off white" vs "Off-white" — bindestreck-variant).
const MANUAL_COLOR_ALIASES: Record<string, string> = {};

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
