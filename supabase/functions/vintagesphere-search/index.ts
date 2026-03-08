/**
 * VintageSphere Search — scrapes Shopify /products.json API
 * Returns paginated product listings with availability status.
 * Isolated from Tradera/eBay flows per spec.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://vintagesphere.se";
const MAX_PAGES = 20; // safety cap
const PAGE_SIZE = 250; // Shopify max per page
const DELAY_MS = 500; // polite rate limiting between pages

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
  images: Array<{
    src: string;
    position: number;
  }>;
  options: Array<{
    name: string;
    values: string[];
  }>;
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
}

function extractOption(product: ShopifyProduct, optionName: string): string | null {
  const opt = product.options.find(
    (o) => o.name.toLowerCase() === optionName.toLowerCase()
  );
  if (!opt || opt.values.length === 0) return null;
  const val = opt.values[0];
  // Skip generic values
  if (val.toLowerCase() === "default title" || val.toLowerCase() === "default") return null;
  return val;
}

function normalizeProduct(product: ShopifyProduct): NormalizedItem {
  const variant = product.variants[0];
  const allAvailable = product.variants.some((v) => v.available);
  const price = variant ? parseFloat(variant.price) : null;

  return {
    external_id: product.handle,
    handle: product.handle,
    title: product.title,
    price: price && !isNaN(price) ? price : null,
    currency: "SEK",
    primaryImage: product.images[0]?.src || null,
    imageCount: product.images.length,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const log: Record<string, unknown> = { function: "vintagesphere-search" };

  try {
    const body = await req.json().catch(() => ({}));
    const filterKeywords = (body.keywords as string || "").trim().toLowerCase();
    const includeUnavailable = body.includeUnavailable ?? true;
    const maxPages = Math.min(body.maxPages ?? MAX_PAGES, MAX_PAGES);

    const allItems: NormalizedItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const url = `${BASE_URL}/products.json?limit=${PAGE_SIZE}&page=${page}`;
      console.info(`[VintageSphereSearch] Fetching page ${page}: ${url}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let response: Response;
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Ancora-Import/1.0 (+https://ancoraedit.lovable.app)" },
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === "AbortError") {
          console.warn(`[VintageSphereSearch] Timeout on page ${page}`);
          break;
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        // Retry once on 429
        if (response.status === 429 && page > 1) {
          console.warn(`[VintageSphereSearch] Rate limited at page ${page}, waiting 2s`);
          await sleep(2000);
          const retryResp = await fetch(url, {
            headers: { "User-Agent": "Ancora-Import/1.0 (+https://ancoraedit.lovable.app)" },
          });
          if (!retryResp.ok) {
            console.error(`[VintageSphereSearch] Retry failed: ${retryResp.status}`);
            break;
          }
          const retryData = await retryResp.json();
          const products = retryData.products as ShopifyProduct[];
          if (!products || products.length === 0) break;
          allItems.push(...products.map(normalizeProduct));
          page++;
          await sleep(DELAY_MS);
          continue;
        }
        console.error(`[VintageSphereSearch] HTTP ${response.status} on page ${page}`);
        break;
      }

      const data = await response.json();
      const products = data.products as ShopifyProduct[];

      if (!products || products.length === 0) {
        hasMore = false;
        break;
      }

      allItems.push(...products.map(normalizeProduct));

      if (products.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
        await sleep(DELAY_MS);
      }
    }

    // Apply keyword filter client-side
    let filteredItems = allItems;
    if (filterKeywords) {
      const words = filterKeywords.split(/\s+/);
      filteredItems = allItems.filter((item) => {
        const searchText = `${item.title} ${item.vendor} ${item.productType} ${item.tags.join(" ")}`.toLowerCase();
        return words.every((w) => searchText.includes(w));
      });
    }

    // Filter availability
    if (!includeUnavailable) {
      filteredItems = filteredItems.filter((item) => item.available);
    }

    const durationMs = Date.now() - startTime;
    log.pages_fetched = page;
    log.total_products = allItems.length;
    log.filtered_count = filteredItems.length;
    log.duration_ms = durationMs;
    console.info("[VintageSphereSearch]", JSON.stringify(log));

    return new Response(
      JSON.stringify({
        items: filteredItems,
        total: filteredItems.length,
        pagesScanned: page,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    log.error = err.message;
    log.duration_ms = Date.now() - startTime;
    console.error("[VintageSphereSearch] Error:", JSON.stringify(log));

    return new Response(
      JSON.stringify({ error: err.message, items: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
