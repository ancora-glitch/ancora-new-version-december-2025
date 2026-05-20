/**
 * Pure Effect Item — fetches a single product via Shopify JSON API
 * Returns full product details for import.
 * Modelled exactly after vintagesphere-item. Purely additive.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://www.pureeffectsweden.com";

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
  images: Array<{
    src: string;
    position: number;
    width: number;
    height: number;
  }>;
  options: Array<{
    name: string;
    position: number;
    values: string[];
  }>;
  published_at: string | null;
  updated_at: string | null;
}

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

function extractOption(product: ShopifyProductFull, patterns: RegExp[]): string | null {
  const opt = product.options.find((o) => patterns.some((p) => p.test(o.name)));
  if (!opt || opt.values.length === 0) return null;
  const val = opt.values[0];
  if (val.toLowerCase() === "default title" || val.toLowerCase() === "default") return null;
  return val;
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
    console.info(`[PureEffectItem] Fetching: ${url}`);

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
      size: extractOption(product, [/size/i, /storlek/i]) || variant?.option1 || null,
      color: extractOption(product, [/color/i, /colour/i, /f[äa]rg/i]) || null,
      material: extractOption(product, [/material/i]) || null,
      // Pure Effect has no equivalent of VintageSphere star ratings — always null
      condition: null,
      era: null,
      available: allAvailable,
      images: product.images
        .sort((a, b) => a.position - b.position)
        .map((img) => img.src),
      productUrl: `${BASE_URL}/sv-se/products/${product.handle}`,
      updatedAt: product.updated_at,
    };

    console.info("[PureEffectItem]", {
      handle: product.handle,
      images: item.images.length,
      available: item.available,
      hasDescription: !!description,
    });

    return new Response(
      JSON.stringify({ item }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[PureEffectItem] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
