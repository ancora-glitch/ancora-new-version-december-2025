/**
 * Worn Vintage Search — scrapes Shopify /collections/<handle>/products.json
 * Restricted to genuine secondhand: /collections/vintage and /collections/bags.
 * The "Worn Design" line (newly manufactured upcycled leather) is intentionally
 * NOT included. Isolated from Tradera/eBay/VintageSphere/Pure Effect flows.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://wornvintage.se";
const COLLECTIONS = ["vintage", "bags"]; // genuine secondhand only — Worn Design excluded
const MAX_PAGES = 20;
const PAGE_SIZE = 250;
const DELAY_MS = 500;

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: Array<{
    id: number;
    title: string;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    available: boolean;
    price: string;
  }>;
  images: Array<{ src: string; position: number }>;
  options: Array<{ name: string; values: string[] }>;
  published_at: string | null;
  updated_at: string | null;
}

interface NormalizedItem {
  external_id: string;
  handle: string;
  title: string;
  price: number | null;
  currency: string;
  primaryImage: string | null;
  imageCount: number;
  vendor: string;
  productType: string;
  size: string | null;
  color: string | null;
  material: string | null;
  available: boolean;
  productUrl: string;
  tags: string[];
  sourceCollection: string;
}

function extractOption(product: ShopifyProduct, optionName: string): string | null {
  const opt = product.options.find(
    (o) => o.name.toLowerCase() === optionName.toLowerCase()
  );
  if (!opt || opt.values.length === 0) return null;
  const val = opt.values[0];
  if (val.toLowerCase() === "default title" || val.toLowerCase() === "default") return null;
  return val;
}

function normalizeProduct(product: ShopifyProduct, sourceCollection: string): NormalizedItem {
  const variant = product.variants[0];
  const allAvailable = product.variants.some((v) => v.available);
  const price = variant ? parseFloat(variant.price) : null;
  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);

  return {
    external_id: product.handle,
    handle: product.handle,
    title: product.title,
    price: price && !isNaN(price) ? price : null,
    currency: "SEK",
    primaryImage: sortedImages[0]?.src || null,
    imageCount: product.images.length,
    vendor: product.vendor,
    productType: product.product_type,
    size: extractOption(product, "Size") || variant?.option1 || null,
    color: extractOption(product, "Color") || variant?.option2 || null,
    material: extractOption(product, "Material") || variant?.option3 || null,
    available: allAvailable,
    productUrl: `${BASE_URL}/products/${product.handle}`,
    tags: product.tags,
    sourceCollection,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCollection(collection: string, maxPages: number): Promise<{ items: NormalizedItem[]; pages: number }> {
  const items: NormalizedItem[] = [];
  let page = 1;
  while (page <= maxPages) {
    const url = `${BASE_URL}/collections/${collection}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    console.info(`[WornVintageSearch] Fetching ${collection} page ${page}: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Ancora-Import/1.0 (+https://ancoraedit.lovable.app)" },
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === "AbortError") {
        console.warn(`[WornVintageSearch] Timeout on ${collection} page ${page}`);
        break;
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[WornVintageSearch] Rate limited at ${collection} page ${page}, waiting 2s`);
        await sleep(2000);
        const retry = await fetch(url, {
          headers: { "User-Agent": "Ancora-Import/1.0 (+https://ancoraedit.lovable.app)" },
        });
        if (!retry.ok) {
          console.error(`[WornVintageSearch] Retry failed: ${retry.status}`);
          break;
        }
        const retryData = await retry.json();
        const products = (retryData.products as ShopifyProduct[]) || [];
        if (products.length === 0) break;
        items.push(...products.map((p) => normalizeProduct(p, collection)));
        if (products.length < PAGE_SIZE) break;
        page++;
        await sleep(DELAY_MS);
        continue;
      }
      console.error(`[WornVintageSearch] HTTP ${response.status} on ${collection} page ${page}`);
      break;
    }

    const data = await response.json();
    const products = (data.products as ShopifyProduct[]) || [];
    if (products.length === 0) break;
    items.push(...products.map((p) => normalizeProduct(p, collection)));
    if (products.length < PAGE_SIZE) break;
    page++;
    await sleep(DELAY_MS);
  }
  return { items, pages: page };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const log: Record<string, unknown> = { function: "wornvintage-search" };

  try {
    const body = await req.json().catch(() => ({}));
    const filterKeywords = ((body.keywords as string) || "").trim().toLowerCase();
    const includeUnavailable = body.includeUnavailable ?? true;
    const maxPages = Math.min((body.maxPages as number) ?? MAX_PAGES, MAX_PAGES);

    const all: NormalizedItem[] = [];
    let totalPages = 0;
    for (const collection of COLLECTIONS) {
      const { items, pages } = await fetchCollection(collection, maxPages);
      all.push(...items);
      totalPages += pages;
    }

    // Dedupe by handle (an item may live in both collections)
    const seen = new Set<string>();
    const deduped = all.filter((it) => {
      if (seen.has(it.handle)) return false;
      seen.add(it.handle);
      return true;
    });

    let filtered = deduped;
    if (filterKeywords) {
      const words = filterKeywords.split(/\s+/);
      filtered = filtered.filter((item) => {
        const searchText = `${item.title} ${item.vendor} ${item.productType} ${item.tags.join(" ")}`.toLowerCase();
        return words.every((w) => searchText.includes(w));
      });
    }

    if (!includeUnavailable) {
      filtered = filtered.filter((item) => item.available);
    }

    const durationMs = Date.now() - startTime;
    log.pages_fetched = totalPages;
    log.total_products = deduped.length;
    log.filtered_count = filtered.length;
    log.duration_ms = durationMs;
    console.info("[WornVintageSearch]", JSON.stringify(log));

    return new Response(
      JSON.stringify({
        items: filtered,
        total: filtered.length,
        pagesScanned: totalPages,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    log.error = err.message;
    log.duration_ms = Date.now() - startTime;
    console.error("[WornVintageSearch] Error:", JSON.stringify(log));

    return new Response(
      JSON.stringify({ error: err.message, items: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
