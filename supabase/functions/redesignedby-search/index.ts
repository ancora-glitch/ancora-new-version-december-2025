/**
 * supabase/functions/redesignedby-search/index.ts
 *
 * Layer:      Import Layer
 * Pattern:    Mirrors vintagesphere-search exactly
 * Marketplace: redesignedby (enum, lowercase snake_case)
 *
 * Hämtar /products.json?limit=250&page=N i loop.
 * Retry en gång på 429 med 2s delay. AbortController timeout 15s.
 * dry_run=true → returnerar normaliserade produkter utan DB-skrivning.
 *
 * INVARIANTER (Master Spec v1.7):
 *   - Skriver aldrig editorial fields (name, description, brand, color, material, condition)
 *   - Skapar alltid draft, aldrig auto-publish
 *   - Ingen quota-guard behövs — publik Shopify JSON, ingen API-nyckel
 *   - Isolerad från Tradera/eBay-flöden
 *   - Max 10 per run (manuell import, ej cron)
 *
 * PENDING (bekräftas på mötet tisdag):
 *   - Är /products.json publik? (troligen ja, samma som VintageSphere)
 *   - Kräver token? → lägg till X-Shopify-Access-Token header om ja
 *   - UTM-params för 10%-påslag → CONFIG.utm* nedan
 *   - Condition: stjärnor i body_html? Metafield? Tag? → justera extractCondition()
 *   - Color/material: variant title? Metafield?
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://redesignedby.se";
const MAX_PAGES = 5;        // Lägre än VS (20) — börja försiktigt, höj vid behov
const PAGE_SIZE = 250;
const DELAY_MS = 500;
const MAX_PER_RUN = 10;     // Master Spec: max 10 per run (manuell import)

// UTM — exakta params bekräftas på mötet (10%-påslag triggas härifrån)
const UTM = {
  utm_source: "ancora",
  utm_medium: "affiliate",
  utm_campaign: "ancora_main",
  // utm_content: används för variant-level tracking om de vill det
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string;
  available: boolean;
  inventory_quantity: number;
}

interface ShopifyImage {
  src: string;
  alt: string | null;
  position: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  body_html: string;
  tags: string;          // Kommaseparerad sträng
  status: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface NormalizedProduct {
  external_id: string;       // "rdb_{product_id}_{variant_id}"
  handle: string;
  title: string;
  price: number;
  currency: "SEK";
  primaryImage: string | null;
  imageCount: number;
  vendor: string;
  productType: string;
  size: string | null;
  color: string | null;
  material: string | null;
  available: boolean;
  productUrl: string;        // Källans URL
  affiliateUrl: string;      // Med UTM-params
  tags: string[];
}

interface SearchRequest {
  keywords?: string;
  includeUnavailable?: boolean;
  dry_run?: boolean;
  limit?: number;
}

interface SearchResponse {
  dry_run: boolean;
  fetched_at: string;
  total_fetched: number;
  returned: number;
  products: NormalizedProduct[];
  skipped: number;
  warnings: string[];
}

// ─── URL builder ──────────────────────────────────────────────────────────────

function buildAffiliateUrl(handle: string): string {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(UTM).filter(([, v]) => v !== "")
    )
  );
  return `${BASE_URL}/products/${handle}?${params.toString()}`;
}

// ─── Normalisering ────────────────────────────────────────────────────────────

/**
 * Extraherar storlek ur variant title.
 * Shopify-mönster: "S / Svart", "M", "Default Title"
 */
function extractSize(variant: ShopifyVariant): string | null {
  const parts = variant.title.split(" / ");
  const size = parts[0]?.trim();
  if (!size || size === "Default Title") return null;
  // Validera att det ser ut som en storlek (inte bara en färg)
  const sizePattern = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3}|One Size|OS|Onesize)$/i;
  return sizePattern.test(size) ? size : null;
}

/**
 * Extraherar färg ur variant title.
 * Shopify-mönster: "S / Svart" → "Svart"
 * OBS: ReDesignedBy kan lagra färg i metafield istället — bekräfta på mötet.
 */
function extractColor(variant: ShopifyVariant): string | null {
  const parts = variant.title.split(" / ");
  return parts.length >= 2 ? parts[1]?.trim() ?? null : null;
}

/**
 * Extraherar material ur tags eller body_html.
 * Exempel: tag "material:wool" eller "Wool / Ull"
 * OBS: Beror helt på deras datamönster — placeholder tills vi ser riktig data.
 */
function extractMaterial(tags: string[]): string | null {
  const materialTag = tags.find((t) => t.toLowerCase().startsWith("material:"));
  if (materialTag) {
    return materialTag.split(":")[1]?.trim() ?? null;
  }
  return null;
}

function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeProduct(raw: ShopifyProduct): NormalizedProduct | null {
  // Välj bästa variant (första tillgängliga, annars första)
  const variant =
    raw.variants.find((v) => v.available) ?? raw.variants[0];
  if (!variant) return null;

  const price = parseFloat(variant.price);
  if (isNaN(price) || price <= 0) return null;

  const tags = normalizeTags(raw.tags);

  return {
    external_id: `rdb_${raw.id}_${variant.id}`,
    handle: raw.handle,
    title: raw.title,
    price: Math.round(price),
    currency: "SEK",
    primaryImage: raw.images[0]?.src ?? null,
    imageCount: raw.images.length,
    vendor: raw.vendor,
    productType: raw.product_type,
    size: extractSize(variant),
    color: extractColor(variant),
    material: extractMaterial(tags),
    available: variant.available,
    productUrl: `${BASE_URL}/products/${raw.handle}`,
    affiliateUrl: buildAffiliateUrl(raw.handle),
    tags,
  };
}

// ─── Keyword filter (samma logik som VintageSphere) ──────────────────────────

function matchesKeywords(product: NormalizedProduct, keywords: string): boolean {
  const words = keywords.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    product.title,
    product.vendor,
    product.productType,
    ...product.tags,
  ]
    .join(" ")
    .toLowerCase();

  return words.every((word) => haystack.includes(word));
}

// ─── Fetch med retry (samma mönster som VintageSphere) ───────────────────────

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${BASE_URL}/products.json?limit=${PAGE_SIZE}&page=${page}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    let response = await fetch(url, { signal: controller.signal });

    // Retry en gång på 429
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 2_000));
      response = await fetch(url, { signal: controller.signal });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} on page ${page}`);
    }

    const data = await response.json();
    return data.products ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Huvudlogik ───────────────────────────────────────────────────────────────

async function searchProducts(req: SearchRequest): Promise<SearchResponse> {
  const warnings: string[] = [];
  const allNormalized: NormalizedProduct[] = [];
  let totalFetched = 0;
  let skipped = 0;

  const limit = Math.min(req.limit ?? MAX_PER_RUN, MAX_PER_RUN);

  pageLoop: for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    let rawProducts: ShopifyProduct[];
    try {
      rawProducts = await fetchPage(page);
    } catch (err) {
      warnings.push(`Page ${page} fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    // Tom sida = slut på katalog
    if (rawProducts.length === 0) break;

    for (const raw of rawProducts) {
      totalFetched++;

      // Hoppa över inaktiva produkter
      if (raw.status && raw.status !== "active") {
        skipped++;
        continue;
      }

      const normalized = normalizeProduct(raw);
      if (!normalized) {
        skipped++;
        continue;
      }

      // Hoppa över sålda om inte includeUnavailable
      if (!normalized.available && !req.includeUnavailable) {
        skipped++;
        continue;
      }

      // Keyword-filter
      if (req.keywords && !matchesKeywords(normalized, req.keywords)) {
        continue; // Räknas inte som skipped — bara filtrerat
      }

      allNormalized.push(normalized);

      // Nått limit — avbryt
      if (allNormalized.length >= limit) break pageLoop;
    }
  }

  if (allNormalized.length === 0 && totalFetched === 0) {
    warnings.push(
      "Inga produkter hämtades. Om redesignedby.se kräver API-token: " +
        "lägg till X-Shopify-Access-Token header i fetchPage() och konfigurera token i Supabase Vault."
    );
  }

  return {
    dry_run: req.dry_run ?? true,
    fetched_at: new Date().toISOString(),
    total_fetched: totalFetched,
    returned: allNormalized.length,
    products: allNormalized,
    skipped,
    warnings,
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
    const body: SearchRequest = req.method === "POST" ? await req.json() : {};

    const result = await searchProducts({
      keywords: body.keywords,
      includeUnavailable: body.includeUnavailable ?? false,
      dry_run: body.dry_run ?? true,
      limit: body.limit ?? MAX_PER_RUN,
    });

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
