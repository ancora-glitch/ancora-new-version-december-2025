/**
 * Shared helpers for parsing structured product fields from listing text.
 * Used by both Tradera and eBay import adapters.
 */

import { extractBrandFromTitle, determineBrand } from "./brandExtractor";

// ── Size parsing ──

const SIZE_PATTERNS = [
  // EU clothing sizes
  /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL)\b/i,
  // Numeric clothing sizes (32-54)
  /\bstorlek\s*(\d{2})\b/i,
  /\bsize\s*(\d{2})\b/i,
  /\bsz\.?\s*(\d{2})\b/i,
  // EU shoe sizes (35-48)
  /\b(?:EU|EUR)\s*(\d{2}(?:[.,]\d)?)\b/i,
  /\bstorlek\s*(3[5-9]|4[0-8])\b/i,
  // "One size"
  /\b(one\s*size|OS|one\s*size\s*fits\s*all)\b/i,
  /\b(en\s*storlek)\b/i,
];

export function parseSize(title: string, description: string): string | null {
  const combined = `${title} ${description}`;
  for (const pattern of SIZE_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return null;
}

// ── Color parsing ──

const COLOR_VOCABULARY: Record<string, string> = {
  // English
  black: "Black",
  white: "White",
  red: "Red",
  blue: "Blue",
  navy: "Navy",
  green: "Green",
  brown: "Brown",
  beige: "Beige",
  grey: "Grey",
  gray: "Grey",
  pink: "Pink",
  purple: "Purple",
  orange: "Orange",
  yellow: "Yellow",
  cream: "Cream",
  ivory: "Ivory",
  burgundy: "Burgundy",
  maroon: "Burgundy",
  olive: "Olive",
  teal: "Teal",
  coral: "Coral",
  tan: "Tan",
  camel: "Camel",
  charcoal: "Charcoal",
  silver: "Silver",
  gold: "Gold",
  multicolor: "Multicolor",
  // Swedish
  svart: "Black",
  vit: "White",
  röd: "Red",
  blå: "Blue",
  grön: "Green",
  brun: "Brown",
  grå: "Grey",
  rosa: "Pink",
  lila: "Purple",
  gul: "Yellow",
  mörkblå: "Navy",
  marinblå: "Navy",
  vinröd: "Burgundy",
  flerfärgad: "Multicolor",
};

export function parseColor(title: string, description: string): string | null {
  const combined = `${title} ${description}`.toLowerCase();
  const found: string[] = [];
  const seen = new Set<string>();

  for (const [word, canonical] of Object.entries(COLOR_VOCABULARY)) {
    // Word boundary check
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(combined) && !seen.has(canonical)) {
      found.push(canonical);
      seen.add(canonical);
    }
  }

  return found.length > 0 ? found.join(", ") : null;
}

// ── Material parsing ──

const MATERIAL_TERMS: Record<string, string> = {
  // English
  wool: "Wool",
  leather: "Leather",
  cotton: "Cotton",
  silk: "Silk",
  denim: "Denim",
  cashmere: "Cashmere",
  linen: "Linen",
  polyester: "Polyester",
  nylon: "Nylon",
  suede: "Suede",
  velvet: "Velvet",
  satin: "Satin",
  tweed: "Tweed",
  corduroy: "Corduroy",
  jersey: "Jersey",
  chiffon: "Chiffon",
  viscose: "Viscose",
  rayon: "Rayon",
  mohair: "Mohair",
  alpaca: "Alpaca",
  canvas: "Canvas",
  // Swedish
  ull: "Wool",
  läder: "Leather",
  skinn: "Leather",
  bomull: "Cotton",
  siden: "Silk",
  linne: "Linen",
  sammet: "Velvet",
  mocka: "Suede",
  kashmir: "Cashmere",
};

export function parseMaterial(title: string, description: string): string | null {
  const combined = `${title} ${description}`.toLowerCase();
  const found: string[] = [];
  const seen = new Set<string>();

  for (const [word, canonical] of Object.entries(MATERIAL_TERMS)) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(combined) && !seen.has(canonical)) {
      found.push(canonical);
      seen.add(canonical);
    }
  }

  return found.length > 0 ? found.join(", ") : null;
}

// ── Condition parsing ──

const CONDITION_MAP: Record<string, string> = {
  // Enum values → human readable
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  unknown: "Unknown",
};

const CONDITION_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(new with tags|NWT|oanvänd|ny med etikett)\b/i, label: "New with tags" },
  { pattern: /\b(new without tags|NWOT|ny utan etikett)\b/i, label: "New without tags" },
  { pattern: /\b(brand new|helt ny|nyskick)\b/i, label: "New" },
  { pattern: /\b(like new|som ny)\b/i, label: "Like new" },
  { pattern: /\b(excellent|utmärkt|mycket gott skick)\b/i, label: "Excellent" },
  { pattern: /\b(very good|mycket bra)\b/i, label: "Very good" },
  { pattern: /\b(good|gott skick|bra skick)\b/i, label: "Good" },
  { pattern: /\b(fair|hyfsad|ok skick)\b/i, label: "Fair" },
];

export function parseConditionText(
  enumValue: string | null | undefined,
  description: string
): string | null {
  // If we have an enum value, map it
  if (enumValue && enumValue !== "unknown") {
    return CONDITION_MAP[enumValue] || enumValue;
  }

  // Try parsing from description
  for (const { pattern, label } of CONDITION_KEYWORDS) {
    if (pattern.test(description)) {
      return label;
    }
  }

  return enumValue ? CONDITION_MAP[enumValue] || null : null;
}

// ── Combined mapper ──

export interface ParsedListingFields {
  brand_text: string | null;
  cleaned_name: string;
  size_text: string | null;
  color_text: string | null;
  material_text: string | null;
  condition_text: string | null;
  primary_image: string | null;
}

/**
 * Parse structured fields from a listing's title, description, and metadata.
 * Used by both Tradera and eBay adapters.
 */
export function parseListingFields(opts: {
  title: string;
  description: string;
  apiBrand?: string;
  apiSize?: string;
  apiColor?: string;
  apiMaterial?: string;
  conditionEnum?: string | null;
  images: string[];
}): ParsedListingFields {
  const { title, description, apiBrand, apiSize, apiColor, apiMaterial, conditionEnum, images } = opts;

  // Brand
  const brandResult = determineBrand(apiBrand, title);

  // Size: prefer API, then parse
  const size_text = apiSize || parseSize(title, description);

  // Color: prefer API, then parse
  const color_text = apiColor || parseColor(title, description);

  // Material: prefer API, then parse
  const material_text = apiMaterial || parseMaterial(title, description);

  // Condition text
  const condition_text = parseConditionText(conditionEnum, description);

  // Primary image: first image (hero selection already reorders)
  const primary_image = images.length > 0 ? images[0] : null;

  // Debug log
  console.log("[ListingParser] Parsed fields:", {
    brand_text: brandResult.brand || null,
    cleaned_name: brandResult.cleanedName,
    size_text,
    color_text,
    material_text,
    condition_text,
    primary_image: primary_image?.substring(0, 60),
  });

  return {
    brand_text: brandResult.brand || null,
    cleaned_name: brandResult.cleanedName,
    size_text,
    color_text,
    material_text,
    condition_text,
    primary_image,
  };
}
