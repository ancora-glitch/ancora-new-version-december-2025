/**
 * supabase/functions/redesignedby-item/index.ts
 *
 * Layer:      Import Layer
 * Pattern:    Mirrors vintagesphere-item exactly
 * Marketplace: redesignedby (enum, lowercase snake_case)
 *
 * Hämtar enskild produkt via /products/{handle}.json.
 * Returnerar fullt item med images[], condition, era, descriptionHtml.
 *
 * PENDING (bekräftas på mötet tisdag):
 *   - extractCondition(): stjärnor i body_html (som VS)? Metafield? Tag?
 *   - extractEra(): finns "Era:" i description?
 *   - color/material: metafield namespace + key?
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://redesignedby.se";

const UTM = {
  utm_source: "ancora",
  utm_medium: "affiliate",
  utm_campaign: "ancora_main",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string;
  available: boolean;
  inventory_quantity: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
  position: number;
  width: number;
  height: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  body_html: string;
  tags: string;
  status: string;
  options: { name: string; values: string[] }[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

// Ancora condition enum (Master Spec v1.7)
type AncorCondition = "new" | "very_good" | "good" | "fair" | "poor" | null;

interface FullItem {
  external_id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  price: number;
  currency: "SEK";
  condition: AncorCondition;
  era: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  available: boolean;
  descriptionHtml: string;
  descriptionText: string;
  images: { src: string; alt: string | null; position: number }[];
  productUrl: string;
  affiliateUrl: string;
  tags: string[];
  sku: string;
  marketplace: "redesignedby";
  status: "draft";
}

// ─── HTML-parsers (speglar vintagesphere-item) ────────────────────────────────

/**
 * Sanerar HTML till ren text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extraherar skick ur body_html.
 *
 * Strategi 1 (samma som VintageSphere): räkna stjärnor ⭑⭐★
 *   4-5 stjärnor → very_good
 *   3   stjärnor → good
 *   2   stjärnor → fair
 *   1   stjärna  → poor
 *
 * Strategi 2: leta efter explicit text ("Skick:", "Condition:")
 *
 * OBS: ReDesignedBy kanske inte använder stjärnor alls.
 * Bekräfta på mötet — justera om nödvändigt.
 */
function extractCondition(bodyHtml: string, tags: string[]): AncorCondition {
  // Strategi 1: stjärnor (som VintageSphere)
  const starMatches = bodyHtml.match(/[⭑⭐★]/g);
  if (starMatches) {
    const count = starMatches.length;
    if (count >= 4) return "very_good";
    if (count === 3) return "good";
    if (count === 2) return "fair";
    if (count === 1) return "poor";
  }

  // Strategi 2: explicit text i description
  const textLower = stripHtml(bodyHtml).toLowerCase();
  const conditionPatterns: [RegExp, AncorCondition][] = [
    [/\b(nytt|new|oanv[äa]nd)\b/, "new"],
    [/\b(mycket bra|very good|utmärkt|excellent)\b/, "very_good"],
    [/\b(bra skick|good condition|good)\b/, "good"],
    [/\b(okej|fair|acceptabelt)\b/, "fair"],
    [/\b(slitet|poor|worn)\b/, "poor"],
  ];
  for (const [pattern, condition] of conditionPatterns) {
    if (pattern.test(textLower)) return condition;
  }

  // Strategi 3: tags
  const tagString = tags.join(" ").toLowerCase();
  if (tagString.includes("new") || tagString.includes("nytt")) return "new";
  if (tagString.includes("very good") || tagString.includes("mycket bra")) return "very_good";
  if (tagString.includes("good")) return "good";
  if (tagString.includes("fair")) return "fair";
  if (tagString.includes("poor")) return "poor";

  return null; // Okänt → redaktören fyller i
}

/**
 * Extraherar era ur body_html.
 * Mönster: "Era: 1990s", "Era: 90s", "1980's"
 * OBS: Troligen inte relevant för ReDesignedBy (moderna second hand).
 * Behålls för paritet med VintageSphere — returnerar null om ej hittat.
 */
function extractEra(bodyHtml: string): string | null {
  const eraMatch = bodyHtml.match(/Era:\s*(\d{4}'?s?)/i);
  return eraMatch ? eraMatch[1] : null;
}

// ─── Variant-parsers ──────────────────────────────────────────────────────────

function extractSize(variant: ShopifyVariant, options: ShopifyProduct["options"]): string | null {
  // Hitta vilken option som är "Size"
  const sizeOptionIndex = options.findIndex(
    (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "storlek"
  );
  if (sizeOptionIndex >= 0) {
    const key = `option${sizeOptionIndex + 1}` as "option1" | "option2" | "option3";
    return variant[key] ?? null;
  }

  // Fallback: första option om den ser ut som en storlek
  const first = variant.option1;
  if (!first || first === "Default Title") return null;
  const sizePattern = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3}|One Size|OS|Onesize)$/i;
  return sizePattern.test(first) ? first : null;
}

function extractColor(variant: ShopifyVariant, options: ShopifyProduct["options"]): string | null {
  const colorOptionIndex = options.findIndex(
    (o) =>
      o.name.toLowerCase() === "color" ||
      o.name.toLowerCase() === "colour" ||
      o.name.toLowerCase() === "färg"
  );
  if (colorOptionIndex >= 0) {
    const key = `option${colorOptionIndex + 1}` as "option1" | "option2" | "option3";
    return variant[key] ?? null;
  }
  return null;
}

function extractMaterial(tags: string[]): string | null {
  const materialTag = tags.find((t) => t.toLowerCase().startsWith("material:"));
  if (materialTag) return materialTag.split(":")[1]?.trim() ?? null;
  return null;
}

// ─── URL builder ──────────────────────────────────────────────────────────────

function buildAffiliateUrl(handle: string): string {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(UTM).filter(([, v]) => v))
  );
  return `${BASE_URL}/products/${handle}?${params.toString()}`;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchItem(handle: string): Promise<ShopifyProduct> {
  const url = `${BASE_URL}/products/${handle}.json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status === 404) {
      throw new Error(`Product not found: ${handle}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for handle: ${handle}`);
    }

    const data = await response.json();
    if (!data.product) throw new Error("Unexpected response shape — missing .product");
    return data.product;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Transform ────────────────────────────────────────────────────────────────

function transformItem(raw: ShopifyProduct): FullItem {
  const tags = raw.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Välj bästa variant
  const variant =
    raw.variants.find((v) => v.available) ?? raw.variants[0];

  const price = variant ? Math.round(parseFloat(variant.price)) : 0;

  // Sortera bilder på position (som VintageSphere)
  const images = [...raw.images]
    .sort((a, b) => a.position - b.position)
    .map(({ src, alt, position }) => ({ src, alt, position }));

  return {
    external_id: `rdb_${raw.id}_${variant?.id ?? 0}`,
    handle: raw.handle,
    title: raw.title,
    vendor: raw.vendor,
    productType: raw.product_type,
    price,
    currency: "SEK",
    condition: extractCondition(raw.body_html, tags),
    era: extractEra(raw.body_html),
    size: variant ? extractSize(variant, raw.options) : null,
    color: variant ? extractColor(variant, raw.options) : null,
    material: extractMaterial(tags),
    available: variant?.available ?? false,
    descriptionHtml: raw.body_html,
    descriptionText: stripHtml(raw.body_html),
    images,
    productUrl: `${BASE_URL}/products/${raw.handle}`,
    affiliateUrl: buildAffiliateUrl(raw.handle),
    tags,
    sku: variant?.sku ?? "",
    marketplace: "redesignedby",
    status: "draft",
  };
}

// ─── Edge Function handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { handle } = await req.json();
    if (!handle || typeof handle !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: handle" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const raw = await fetchItem(handle);
    const item = transformItem(raw);

    return new Response(JSON.stringify(item, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
});
