/**
 * Sellpy Search — queries Sellpy's public Algolia index.
 * Manual-only flow. Isolated from Tradera/eBay/VintageSphere/Worn Vintage/Pure Effect.
 *
 * Algolia credentials below are Sellpy's public search-only keys (the same
 * ones their own browser ships); safe to hardcode.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALGOLIA_APP_ID = "M6WNFR0LVI";
const ALGOLIA_API_KEY = "313e09c3b00b6e2da5dbe382cd1c8f4b";
const ALGOLIA_INDEX = "prod_marketItem_se_relevance";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;
const PRODUCT_BASE = "https://www.sellpy.se/item";

const MAX_HITS = 10;

interface NormalizedItem {
  external_id: string;
  marketplace: "sellpy";
  title: string;
  price: number | null;
  currency: string;
  primaryImage: string | null;
  imageCount: number;
  brand: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  condition_raw: string | null;
  available: boolean;
  productUrl: string;
  description: string | null;
  sourceCollection: string;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && v[0].trim()) {
      return v[0].trim();
    }
  }
  return null;
}

function extractPrice(hit: any): number | null {
  const candidates = [
    hit.price,
    hit.currentPrice,
    hit.priceAmount,
    hit?.prices?.SEK,
    hit?.prices?.sek,
    hit?.price?.amount,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && !isNaN(c)) return c;
    if (typeof c === "string") {
      const n = parseFloat(c);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function extractImages(hit: any): string[] {
  const raw =
    hit.imageUrls ||
    hit.images ||
    hit.imageURL ||
    hit.image ||
    hit.thumbnails ||
    [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const urls: string[] = [];
  for (const it of arr) {
    if (typeof it === "string" && it.startsWith("http")) urls.push(it);
    else if (it && typeof it === "object") {
      const u = it.url || it.src || it.large || it.medium || it.original;
      if (typeof u === "string" && u.startsWith("http")) urls.push(u);
    }
  }
  return urls;
}

function normalizeHit(hit: any): NormalizedItem { function normalizeHit(hit: Record<string, unknown>): SellpyItem {
  console.log("SELLPY HIT KEYS:", Object.keys(hit));
  console.log("SELLPY HIT:", JSON.stringify(hit));
  // ... resten oförändrad
  const id = String(hit.objectID ?? hit.id ?? "");
  const images = extractImages(hit);
  const title =
    firstString(hit.title, hit.name, hit?.title?.sv, hit?.title?.en) ||
    "(no title)";
  const brand = firstString(hit.brand, hit.brandName, hit?.brand?.name);
  const size = firstString(hit.size, hit.sizes, hit?.size?.label);
  const color = firstString(hit.color, hit.colors, hit?.color?.label);
  const material = firstString(hit.material, hit.materials, hit?.material?.label);
  const condition_raw = firstString(hit.condition, hit.conditionLabel, hit?.condition?.label);
  const description = firstString(hit.description, hit?.description?.sv, hit?.description?.en);
  const available =
    typeof hit.available === "boolean"
      ? hit.available
      : typeof hit.inStock === "boolean"
      ? hit.inStock
      : true;

  return {
    external_id: id,
    marketplace: "sellpy",
    title,
    price: extractPrice(hit),
    currency: "SEK",
    primaryImage: images[0] || null,
    imageCount: images.length,
    brand,
    size,
    color,
    material,
    condition_raw,
    available,
    productUrl: `${PRODUCT_BASE}/${id}`,
    description,
    sourceCollection: "sellpy",
  };
}

async function algoliaQuery(query: string, page: number, hitsPerPage: number): Promise<any> {
  const body = {
    query,
    hitsPerPage,
    page,
  };
  const doFetch = () =>
    fetch(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "X-Algolia-API-Key": ALGOLIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let response = await doFetch();
  if (response.status === 429) {
    console.warn("[SellpySearch] Algolia 429 — retrying after 2s");
    await new Promise((r) => setTimeout(r, 2000));
    response = await doFetch();
  }
  if (!response.ok) {
    throw new Error(`Algolia HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const log: Record<string, unknown> = { function: "sellpy-search" };

  try {
    const body = await req.json().catch(() => ({}));
    const query = ((body.keywords as string) || (body.query as string) || "").trim();
    const page = Math.max(0, Math.floor((body.page as number) ?? 0));
    const includeUnavailable = body.includeUnavailable ?? true;

    const data = await algoliaQuery(query, page, MAX_HITS);
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];

    let items = hits.map(normalizeHit);
    if (!includeUnavailable) items = items.filter((i) => i.available);

    const durationMs = Date.now() - startTime;
    log.query = query;
    log.page = page;
    log.total_hits = items.length;
    log.duration_ms = durationMs;
    console.info("[SellpySearch]", JSON.stringify(log));

    return new Response(
      JSON.stringify({
        items,
        total: items.length,
        pagesScanned: 1,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    log.error = err.message;
    log.duration_ms = Date.now() - startTime;
    console.error("[SellpySearch] Error:", JSON.stringify(log));
    return new Response(
      JSON.stringify({ error: err.message, items: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
