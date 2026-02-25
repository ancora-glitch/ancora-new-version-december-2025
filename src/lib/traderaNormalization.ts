/**
 * Tradera field normalization: SV → EN standardization
 * Used both on import and backfill for marketplace='tradera' products only.
 */

// ── Condition mapping ──

const CONDITION_MAP: Array<{ match: (s: string) => boolean; en: string }> = [
  { match: (s) => /defekt|trasig/.test(s), en: "Poor" },
  { match: (s) => /acceptabelt skick|slitet|välanvänt/.test(s), en: "Fair" },
  { match: (s) => /mycket gott skick|mycket bra skick/.test(s), en: "Excellent" },
  { match: (s) => /nyskick|som ny/.test(s), en: "Like new" },
  { match: (s) => /gott skick|bra skick/.test(s), en: "Good" },
  { match: (s) => /oanvänd|ny med etikett/.test(s), en: "New" },
  { match: (s) => s === "ny" || s === "ny utan etikett", en: "New" },
  // English pass-through
  { match: (s) => /\bnew\b/.test(s), en: "New" },
  { match: (s) => /\bexcellent\b/.test(s), en: "Excellent" },
  { match: (s) => /\bgood\b/.test(s), en: "Good" },
  { match: (s) => /\bfair\b/.test(s), en: "Fair" },
  { match: (s) => /\blike new\b/.test(s), en: "Like new" },
  { match: (s) => /\bpoor\b/.test(s), en: "Poor" },
];

export function normalizeTraderaCondition(sv?: string | null): { en: string | null; original: string | null } {
  if (!sv || !sv.trim()) return { en: null, original: null };
  const original = sv.trim();
  const lower = original.toLowerCase();

  for (const rule of CONDITION_MAP) {
    if (rule.match(lower)) {
      return { en: rule.en, original };
    }
  }

  // Non-empty but unrecognized → default "Good", keep original
  return { en: "Good", original };
}

// ── Material mapping ──

const MATERIAL_MAP: Record<string, string> = {
  ull: "Wool",
  kashmir: "Cashmere",
  cashmere: "Cashmere",
  bomull: "Cotton",
  linne: "Linen",
  silke: "Silk",
  skinn: "Leather",
  läder: "Leather",
  mocka: "Suede",
  polyester: "Polyester",
  viskos: "Viscose",
  nylon: "Nylon",
  akryl: "Acrylic",
  elastan: "Elastane",
  dun: "Down",
  fleece: "Fleece",
  syntet: "Synthetic",
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function splitTokens(text: string): string[] {
  return text
    .split(/[,/\&+]|\boch\b/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function normalizeTraderaMaterial(sv?: string | null): { en: string | null; original: string | null } {
  if (!sv || !sv.trim()) return { en: null, original: null };
  const original = sv.trim();
  const tokens = splitTokens(original);

  const mapped = tokens.map((token) => {
    const lower = token.toLowerCase();
    return MATERIAL_MAP[lower] || titleCase(token);
  });

  // Dedupe
  const unique = [...new Set(mapped)];
  return { en: unique.join(", "), original };
}

// ── Color mapping ──

const COLOR_MAP: Record<string, string> = {
  svart: "Black",
  vit: "White",
  grå: "Grey",
  beige: "Beige",
  brun: "Brown",
  blå: "Blue",
  marin: "Navy",
  marinblå: "Navy",
  röd: "Red",
  rosa: "Pink",
  grön: "Green",
  gul: "Yellow",
  lila: "Purple",
  orange: "Orange",
  silver: "Silver",
  guld: "Gold",
  flerfärgad: "Multicolor",
  mönstrad: "Multicolor",
};

export function normalizeTraderaColor(sv?: string | null): { en: string | null; original: string | null } {
  if (!sv || !sv.trim()) return { en: null, original: null };
  const original = sv.trim();
  const tokens = splitTokens(original);

  const mapped = tokens.map((token) => {
    const lower = token.toLowerCase();
    return COLOR_MAP[lower] || titleCase(token);
  });

  const unique = [...new Set(mapped)];
  return { en: unique.join(" / "), original };
}

// ── Brand normalization ──

export function normalizeTraderaBrand(brand?: string | null): { cleaned: string | null; original: string | null } {
  if (!brand || !brand.trim()) return { cleaned: null, original: null };
  const original = brand.trim();
  // Collapse whitespace
  const collapsed = original.replace(/\s+/g, " ");

  // Only title-case if all-lowercase or all-uppercase (don't ruin stylized brands)
  if (collapsed === collapsed.toLowerCase() || collapsed === collapsed.toUpperCase()) {
    const titled = collapsed
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return { cleaned: titled, original };
  }

  return { cleaned: collapsed, original };
}

// ── Swedish detection ──

const SV_INDICATORS = new Set([
  "skick", "ull", "bomull", "läder", "svart", "vit", "grå", "blå", "röd",
  "rosa", "grön", "gul", "brun", "silke", "linne", "mocka", "begagnad",
  "oanvänd", "nyskick", "mönstrad", "flerfärgad", "marinblå", "viskos",
  "akryl", "elastan", "syntet", "kashmir", "mycket", "gott",
]);

export function isLikelySwedish(text?: string | null): boolean {
  if (!text) return false;
  if (/[åäöÅÄÖ]/.test(text)) return true;
  const lower = text.toLowerCase();
  for (const word of SV_INDICATORS) {
    if (lower.includes(word)) return true;
  }
  return false;
}
