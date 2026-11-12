/** Editorial display values only; never change source originals or enum fields. */
const conditions: Record<string, string> = {
  "nytt skick": "New", "nytt": "New", "ny": "New", "nyskick": "Like new",
  "ny med etikett": "New with tags", "ny utan etikett": "New without tags",
  "mycket gott skick": "Excellent", "mycket bra skick": "Excellent",
  "gott skick": "Very good", "bra skick": "Very good",
  "använt skick": "Used", "begagnat skick": "Used",
  "acceptabelt skick": "Good", "sämre skick": "Poor",
};

const materials: Record<string, string> = {
  merinoull: "merino wool", lammull: "lambswool", "virgin ull": "virgin wool",
  "återvunnen ull": "recycled wool", ull: "wool", siden: "silk", silke: "silk",
  bomull: "cotton", viskos: "viscose", elastan: "elastane", polyamid: "polyamide",
  mocka: "suede", skinn: "leather", läder: "leather", kashmir: "cashmere",
  linne: "linen", lin: "linen", akryl: "acrylic", päls: "fur", sammet: "velvet",
  fickfoder: "pocket lining", foder: "lining", "kemtvätt": "dry clean",
};

const colors: Record<string, string> = {
  olivgrön: "olive green", mörkblå: "dark blue", ljusblå: "light blue",
  marinblå: "navy", mörkgrön: "dark green", ljusgrön: "light green",
  mörkgrå: "dark gray", ljusgrå: "light gray", vinröd: "burgundy",
  svart: "black", vit: "white", blå: "blue", grå: "gray", brun: "brown",
  grön: "green", röd: "red", gul: "yellow", rosa: "pink", lila: "purple",
  orange: "orange", beige: "beige", guld: "gold", silver: "silver",
  flerfärgad: "multicolor", flerfärgat: "multicolor", naturvit: "off-white",
  benvit: "off-white", cremevit: "cream", turkos: "turquoise",
};

function translateTerms(value: string, terms: Record<string, string>): string {
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  const pattern = keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return value.replace(new RegExp(`(?<![\\p{L}])(${pattern})(?![\\p{L}])`, "giu"),
    (match) => terms[match.toLowerCase()] ?? match);
}

function initialCapital(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

export function englishCondition(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return conditions[trimmed.toLowerCase()] ?? trimmed;
}

export function englishMaterial(value: string | null | undefined): string {
  return initialCapital(translateTerms(value?.trim() ?? "", materials));
}

export function englishColor(value: string | null | undefined): string {
  return initialCapital(translateTerms(value?.trim() ?? "", colors)
    .replace(/\boch\b/gi, "and"));
}

export function cleanProductSize(value: string | null | undefined): string {
  return (value ?? "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

export function cleanProductName(value: string, brand: string): string {
  const escapedBrand = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutBrand = escapedBrand
    ? value.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapedBrand}(?![\\p{L}\\p{N}])`, "giu"), "")
    : value;
  return withoutBrand
    .replace(/\s*[-–—|,]?\s*(?:size|storlek)\s*:?\s*(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|[2-6]?X[SL]|XS|S|M|L|XL|XXL)(?![\p{L}\p{N}])(?:\s*\([^)]*\))?/giu, "")
    .replace(/\s+/g, " ")
    .replace(/^\s*[-–—|,:]+\s*|\s*[-–—|,:]+\s*$/g, "")
    .trim();
}