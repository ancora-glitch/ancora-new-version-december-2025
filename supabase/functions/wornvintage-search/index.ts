/**
 * Worn Vintage Search — paginated fetch from the global /products.json endpoint.
 * Returns all products from the store in a single sweep; no per-collection logic,
 * no dedupe. Isolated from Tradera/eBay/VintageSphere/Pure Effect flows.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://wornvintage.se";
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
  brand: string;
  vendor: string;
  productType: string;
  size: string | null;
  color: string | null;
  material: string | null;
  available: boolean;
  productUrl: string;
  tags: string[];
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

function normalizeProduct(product: ShopifyProduct): NormalizedItem {
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
    brand: "Worn",
    vendor: product.vendor,
    productType: product.product_type,
    size: extractOption(product, "Size") || variant?.option1 || null,
    color: extractOption(product, "Color") || variant?.option2 || null,
    material: extractOption(product, "Material") || variant?.option3 || null,
    available: allAvailable,
    productUrl: `${BASE_URL}/products/${product.handle}`,
    tags: product.tags,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${BASE_URL}/products.json?limit=${PAGE_SIZE}&page=${page}`;
  console.info(`[WornVintageSearch] Fetching page ${page}: ${url}`);

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
      console.warn(`[WornVintageSearch] Timeout on page ${page}`);
      return [];
    }
    throw fetchErr;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    console.warn(`[WornVintageSearch] Rate limited at page ${page}, waiting 2s`);
    await sleep(2000);
    response = await fetch(url, {
      headers: { "User-Agent": "Ancora-Import/1.0 (+https://ancoraedit.lovable.app)" },
    });
  }

  if (!response.ok) {
    console.error(`[WornVintageSearch] HTTP ${response.status} on page ${page}`);
    return [];
  }

  const data = await response.json();
  return (data.products as ShopifyProduct[]) || [];
}

async function fetchAllProducts(maxPages: number): Promise<{ products: ShopifyProduct[]; pages: number }> {
  const all: ShopifyProduct[] = [];
  let page = 1;
  for (; page <= maxPages; page++) {
    const products = await fetchPage(page);
    if (products.length === 0) break;
    all.push(...products);
    if (products.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  return { products: all, pages: page };
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

    const { products, pages } = await fetchAllProducts(maxPages);
    const normalized = products.map((p) => normalizeProduct(p));

    let filtered = normalized;
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
    log.pages_fetched = pages;
    log.total_products = normalized.length;
    log.filtered_count = filtered.length;
    log.duration_ms = durationMs;
    console.info("[WornVintageSearch]", JSON.stringify(log));

    return new Response(
      JSON.stringify({
        items: filtered,
        total: filtered.length,
        pagesScanned: pages,
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
