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

    const hit = await response.json() as Record<string, unknown>;

    const metadata = (hit.metadata ?? {}) as Record<string, unknown>;
    const pricing = (hit.pricing ?? {}) as Record<string, unknown>;

    const brand = (metadata.brand as string) ?? null;
    const type = (metadata.type as string) ?? "";
    const size = (metadata.size as string) ?? null;
    const title = [brand, type, size].filter(Boolean).join(" ") || "Untitled";
    const price = typeof pricing.amount === "number" ? pricing.amount : null;

    const colorArr = Array.isArray(metadata.color) ? metadata.color : [];
    const materialArr = Array.isArray(metadata.material) ? metadata.material : [];

    const available = hit.isForSale === true;
    const condition_raw = (metadata.condition as string) ?? null;
    const images = Array.isArray(hit.images) ? (hit.images as string[]) : [];
    const objectID = String(hit.objectID ?? id);

    const item = {
      external_id: objectID,
      title,
      handle: objectID,
      description: null,
      price,
      currency: "SEK",
      brand,
      size,
      color: colorArr.join(", ") || null,
      material: materialArr.join(", ") || null,
      condition: mapCondition(condition_raw),
      condition_raw,
      available,
      images,
      productUrl: `${PRODUCT_BASE}/${objectID}`,
      tags: [],
      era: null,
      vendor: brand ?? "Sellpy",
      productType: type,
    };

    console.info("[SellpyItem]", {
      id: objectID,
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
