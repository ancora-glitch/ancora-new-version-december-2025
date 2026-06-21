/**
 * Worn Vintage Item — fetches a single product via Shopify JSON API.
 * Returns full product details for import.
 * Isolated from Tradera/eBay/VintageSphere/Pure Effect flows.
 *
 * Condition mapping is conservative: unknown raw strings stay null and log a
 * warning. We never force an unmapped string into a wrong enum value.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://wornvintage.se";

interface ShopifyProductFull {
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
    compare_at_price: string | null;
  }>;
  images: Array<{ src: string; position: number; width: number; height: number }>;
  options: Array<{ name: string; position: number; values: string[] }>;
  published_at: string | null;
  updated_at: string | null;
}

// UNVERIFIED against Worn Vintage's full vocabulary — tune after a dry-run.
// Values mirror display labels used elsewhere (capitalized) so they match the
// existing condition_text column shape. Unknown strings stay null.
const CONDITION_MAP: Record<string, string> = {
  "excellent": "Excellent",
  "very good": "Very good",
  "good": "Good",
  "fair": "Fair",
  "poor": "Poor",
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOption(product: ShopifyProductFull, optionName: string): string | null {
  const opt = product.options.find(
    (o) => o.name.toLowerCase() === optionName.toLowerCase()
  );
  if (!opt || opt.values.length === 0) return null;
  const val = opt.values[0];
  if (val.toLowerCase() === "default title" || val.toLowerCase() === "default") return null;
  return val;
}

function extractConditionFromHtml(bodyHtml: string | null): string | null {
  if (!bodyHtml) return null;
  const text = stripHtml(bodyHtml);
  const match = text.match(/Condition:\s*([A-Za-z ]+?)(?:[-–•.,;]|$)/i);
  if (!match) return null;
  const raw = match[1].trim().toLowerCase();
  const mapped = CONDITION_MAP[raw];
  if (!mapped) {
    console.warn(`[WornVintageItem] Unmapped condition string: "${raw}" — left null`);
    return null;
  }
  return mapped;
}

function extractEraFromHtml(bodyHtml: string | null): string | null {
  if (!bodyHtml) return null;
  const text = stripHtml(bodyHtml);
  const eraMatch = text.match(/Era:[\s\S]{0,30}?(\d{4}'?s?)/i);
  return eraMatch ? eraMatch[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const handle = body.handle as string;

    if (!handle) {
      return new Response(
        JSON.stringify({ error: "handle is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `${BASE_URL}/products/${handle}.json`;
    console.info(`[WornVintageItem] Fetching: ${url}`);

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
        return new Response(
          JSON.stringify({ error: "Request timed out" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) {
      return new Response(
        JSON.stringify({ error: "Product not found", handle }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `HTTP ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const product = data.product as ShopifyProductFull;

    if (!product) {
      return new Response(
        JSON.stringify({ error: "No product data in response" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const variant = product.variants[0];
    const allAvailable = product.variants.some((v) => v.available);
    const price = variant ? parseFloat(variant.price) : null;
    const description = product.body_html ? stripHtml(product.body_html) : null;
    const condition = extractConditionFromHtml(product.body_html);
    const era = extractEraFromHtml(product.body_html);

    const item = {
      external_id: product.handle,
      shopify_id: product.id,
      title: product.title,
      handle: product.handle,
      description,
      descriptionHtml: product.body_html,
      price: price && !isNaN(price) ? price : null,
      currency: "SEK",
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      size: extractOption(product, "Size") || variant?.option1 || null,
      color: extractOption(product, "Color") || variant?.option2 || null,
      material: extractOption(product, "Material") || variant?.option3 || null,
      condition,
      era,
      available: allAvailable,
      images: product.images
        .sort((a, b) => a.position - b.position)
        .map((img) => img.src),
      productUrl: `${BASE_URL}/products/${product.handle}`,
      updatedAt: product.updated_at,
    };

    console.info("[WornVintageItem]", {
      handle: product.handle,
      images: item.images.length,
      available: item.available,
      hasDescription: !!description,
      condition: item.condition,
    });

    return new Response(
      JSON.stringify({ item }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[WornVintageItem] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
