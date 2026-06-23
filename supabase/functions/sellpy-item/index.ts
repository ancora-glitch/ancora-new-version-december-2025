/**
 * Sellpy Item — fetches a single product via Sellpy's Algolia index (objectID lookup).
 * Conservative condition mapping: unknown strings stay null + warn.
 * Isolated from Tradera/eBay/VintageSphere/Worn Vintage/Pure Effect.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALGOLIA_APP_ID = "M6WNFR0LVI";
const ALGOLIA_API_KEY = "313e09c3b00b6e2da5dbe382cd1c8f4b";
const ALGOLIA_INDEX = "prod_marketItem_se_relevance";
const ALGOLIA_OBJECT_URL = (id: string) =>
  `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/${encodeURIComponent(id)}`;
const PRODUCT_BASE = "https://www.sellpy.se/item";

// Sellpy's Swedish condition vocabulary. Unknown → null + warn.
const CONDITION_MAP: Record<string, string> = {
  "nyskick": "new",
  "mycket bra": "very_good",
  "bra": "good",
  "acceptabelt": "fair",
};


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

function mapCondition(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const mapped = CONDITION_MAP[key];
  if (!mapped) {
    console.warn(`[SellpyItem] Unmapped condition string: "${raw}" — left null`);
    return null;
  }
  return mapped;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const id = String(body.external_id ?? body.handle ?? body.objectID ?? "").trim();
    if (!id) {
      return new Response(
        JSON.stringify({ error: "external_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = ALGOLIA_OBJECT_URL(id);
    console.info(`[SellpyItem] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "X-Algolia-API-Key": ALGOLIA_API_KEY,
      },
    });

    if (response.status === 404) {
      return new Response(
        JSON.stringify({ error: "Product not found", external_id: id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Algolia HTTP ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hit = await response.json();
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

    const item = {
      external_id: id,
      title,
      handle: id,
      description,
      price: extractPrice(hit),
      currency: "SEK",
      brand,
      size,
      color,
      material,
      condition: mapCondition(condition_raw),
      condition_raw,
      available,
      images,
      productUrl: `${PRODUCT_BASE}/${id}`,
      tags: Array.isArray(hit.tags) ? hit.tags : [],
      era: null,
      vendor: brand ?? "Sellpy",
      productType: firstString(hit.category, hit.productType, hit?.category?.label) ?? "",
    };

    console.info("[SellpyItem]", {
      id,
      images: item.images.length,
      condition_raw,
      condition_mapped: item.condition,
    });

    return new Response(
      JSON.stringify({ item }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[SellpyItem] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
