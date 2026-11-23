// Keep these alias rules in sync with src/lib/stadsmissionenShopUrl.ts.
const PATHAUTO_STOP_WORDS = new Set([
  "a", "an", "as", "at", "before", "but", "by", "for", "from", "is", "in",
  "into", "like", "of", "off", "on", "onto", "per", "since", "than", "the",
  "this", "that", "to", "up", "via", "with",
]);

export function ssmShopUrl(title: string, duplicateSuffix?: number): string {
  const normalized = title
    .toLowerCase()
    .replace(/(\d)\.(?=\d)/g, "$1")
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = normalized
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !PATHAUTO_STOP_WORDS.has(word))
    .join("-");
  const suffix = duplicateSuffix === undefined ? "" : `-${Math.max(0, Math.floor(duplicateSuffix))}`;
  return `https://www.stadsmissionen.se/shop/produkt/${slug}${suffix}`;
}

export function ssmShopUrlCandidates(title: string): string[] {
  return [ssmShopUrl(title), ...[0, 1, 2].map((suffix) => ssmShopUrl(title, suffix))];
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesConfiguredValue(value: string | null | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const normalized = normalizeText(value);
  return allowed.some((entry) => {
    const needle = normalizeText(entry);
    return needle.length > 0 && normalized.includes(needle);
  });
}

const COLOR_ALIASES = [
  ["svart", "black"], ["beige"], ["brun", "brown"], ["burgundy", "vinröd", "bordeaux"],
  ["naturvit", "benvit", "off-white", "off white"],
  ["gräddvit", "cremevit", "krämvit", "cream", "ivory"],
  ["vit", "white"], ["grå", "gray", "grey"], ["marinblå", "navy", "navy blue"],
];

const MATERIAL_ALIASES = [
  ["ull", "wool", "merinoull", "merino wool", "lammull", "lambswool", "lamb wool", "virgin ull", "virgin wool", "ny ull", "new wool", "återvunnen ull", "recycled wool"],
  ["kashmir", "cashmere"], ["silke", "siden", "silk"], ["bomull", "cotton"],
];

function aliasesFor(entry: string, groups: string[][]): string[] {
  const normalized = normalizeText(entry);
  return groups.find((group) => group.some((alias) => normalizeText(alias) === normalized)) ?? [entry];
}

function matchesWholeTerm(value: string, alias: string): boolean {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;
  const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "u").test(value);
}

export function matchesColor(value: string | null | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const normalized = normalizeText(value);
  return allowed.some((entry) => {
    return aliasesFor(entry, COLOR_ALIASES).some((alias) => {
      // Preserve Swedish shade matching (e.g. mörkbrun), but do not match English substrings.
      const isSwedish = ["svart", "brun", "vit", "grå"].includes(alias);
      return isSwedish ? matchesConfiguredValue(value, [alias]) : matchesWholeTerm(normalized, alias);
    });
  });
}

export function matchesMaterial(value: string | null | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const normalized = normalizeText(value);
  return allowed.some((entry) => aliasesFor(entry, MATERIAL_ALIASES).some((alias) => matchesWholeTerm(normalized, alias)));
}

export function materialFromAttributes(attributes: Record<string, unknown>): string | null {
  const text = typeof attributes.material_text === "string" ? attributes.material_text.trim() : "";
  const tags = Array.isArray(attributes.material)
    ? attributes.material.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
    : [];
  return [...new Set([text, ...tags].filter(Boolean))].join(", ") || null;
}

export function matchedBrand(title: string, apiBrand: string | null, brands: string[]): string | null {
  const normalizedApiBrand = normalizeText(apiBrand);
  const normalizedTitle = normalizeText(title);
  for (const brand of brands) {
    const normalizedBrand = normalizeText(brand);
    if (!normalizedBrand) continue;
    if (normalizedApiBrand === normalizedBrand || normalizedTitle.startsWith(normalizedBrand)) return brand;
  }
  return null;
}

export function isStockholmMondayEight(date: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return value("weekday") === "Mon" && value("hour") === "08" && value("minute") === "00";
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

const CONDITIONS: Record<string, string> = {
  "nytt skick": "New", nytt: "New", ny: "New", nyskick: "Like new",
  "ny med etikett": "New with tags", "ny utan etikett": "New without tags",
  "mycket gott skick": "Excellent", "mycket bra skick": "Excellent",
  "gott skick": "Very good", "bra skick": "Very good",
  "använt skick": "Used", "begagnat skick": "Used",
  "acceptabelt skick": "Good", "sämre skick": "Poor",
};

const MATERIALS: Record<string, string> = {
  merinoull: "merino wool", lammull: "lambswool", "virgin ull": "virgin wool",
  "återvunnen ull": "recycled wool", ull: "wool", siden: "silk", silke: "silk",
  bomull: "cotton", viskos: "viscose", elastan: "elastane", polyamid: "polyamide",
  mocka: "suede", skinn: "leather", läder: "leather", kashmir: "cashmere",
  linne: "linen", lin: "linen", akryl: "acrylic", päls: "fur", sammet: "velvet",
  fickfoder: "pocket lining", foder: "lining", kemtvätt: "dry clean",
};

const COLORS: Record<string, string> = {
  olivgrön: "olive green", mörkblå: "dark blue", ljusblå: "light blue",
  marinblå: "navy", mörkgrön: "dark green", ljusgrön: "light green",
  mörkgrå: "dark gray", ljusgrå: "light gray", vinröd: "burgundy",
  svart: "black", vit: "white", blå: "blue", grå: "gray", brun: "brown",
  grön: "green", röd: "red", gul: "yellow", rosa: "pink", lila: "purple",
  orange: "orange", beige: "beige", guld: "gold", silver: "silver",
  flerfärgad: "multicolor", flerfärgat: "multicolor", naturvit: "off-white",
  benvit: "off-white", cremevit: "cream", gräddvit: "cream", krämvit: "cream", turkos: "turquoise",
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
  return CONDITIONS[trimmed.toLowerCase()] ?? trimmed;
}

export function englishMaterial(value: string | null | undefined): string {
  return initialCapital(translateTerms(value?.trim() ?? "", MATERIALS));
}

export function englishColor(value: string | null | undefined): string {
  return initialCapital(translateTerms(value?.trim() ?? "", COLORS).replace(/\boch\b/gi, "and"));
}
