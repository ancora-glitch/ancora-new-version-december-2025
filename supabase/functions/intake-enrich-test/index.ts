import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Constants ── */
const PROMPT_VERSION = "v1";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are an editorial assistant for Ancora, a curated second-hand fashion storefront with a minimalist, Scandinavian aesthetic.
Your job is to enrich product listings with structured fashion data.
Always return valid JSON only. No prose, no markdown.`;

function userPrompt(p: {
  title_raw: string;
  description_raw: string;
  category: string;
  price: number;
  currency: string;
  brand: string;
  tier: string;
}): string {
  return `Enrich this product listing for Ancora. The listing may be in Italian or another language — translate all output fields to English.

Raw title: ${p.title_raw}
Raw description: ${p.description_raw}
Source category: ${p.category}
Price: ${p.price} ${p.currency}
Brand (detected): ${p.brand}
Brand tier: ${p.tier}

Return JSON only:
{
  "brand": string or null (identify the fashion brand from title and description — look beyond the first word, check for known brand names anywhere in the text; return null if no brand is identifiable),
  "brand_confidence": number 0-1,
  "category": one of: outerwear|tops|knitwear|shirts|blazers|dresses|skirts|jeans|trousers|shorts|bags|shoes|accessories,
  "category_confidence": number 0-1,
  "subcategory": string or null,
  "color": string or null,
  "color_confidence": number 0-1,
  "material": string or null,
  "material_confidence": number 0-1,
  "size": string or null,
  "size_confidence": number 0-1,
  "condition": one of: new|very_good|good|fair|poor|null,
  "condition_confidence": number 0-1,
  "title_clean": string in English (Ancora house style: Brand + Color + Material + Item – Size, e.g. 'Toteme Black Wool Coat – Size 38'),
  "description_clean": string in English (2-3 sentences, editorial tone, no marketing fluff),
  "style_tags": array of 2-4 strings in English,
  "editorial_notes": array of 1-3 strings in English
}`;
}

/* ── Helpers ── */
function envFlag(key: string): boolean {
  const v = Deno.env.get(key);
  return v === "true" || v === "1";
}

function envInt(key: string, fallback: number): number {
  const v = Deno.env.get(key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  /* ── Guard: flags ── */
  const killSwitch = envFlag("VITE_INTAKE_KILL_SWITCH");
  if (killSwitch) {
    await supabase.from("intake_run_logs").insert({
      run_type: "enrich",
      source: "ebay",
      status: "aborted_kill_switch",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return json({ status: "aborted_kill_switch" });
  }

  const pipelineEnabled = envFlag("VITE_INTAKE_V1_ENABLED");
  const aiEnabled = envFlag("VITE_INTAKE_AI_ENABLED");
  if (!pipelineEnabled || !aiEnabled) {
    await supabase.from("intake_run_logs").insert({
      run_type: "enrich",
      source: "ebay",
      status: "aborted_flag_disabled",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return json({ status: "aborted_flag_disabled" });
  }

  if (!anthropicKey) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  const limit = envInt("VITE_INTAKE_MAX_ITEMS_PER_RUN", 10);
  const startedAt = new Date().toISOString();

  /* ── 1. Fetch normalized products ── */
  const { data: products, error: fetchErr } = await supabase
    .from("intake_normalized_products")
    .select("*")
    .eq("current_queue_state", "normalized")
    .limit(limit);

  if (fetchErr) {
    console.error("[intake-enrich-test] fetch error:", fetchErr.message);
    return json({ error: fetchErr.message }, 500);
  }

  if (!products || products.length === 0) {
    await supabase.from("intake_run_logs").insert({
      run_type: "enrich",
      source: "ebay",
      status: "completed",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      items_fetched: 0,
      items_processed: 0,
      error_count: 0,
      summary: { model_version: MODEL, prompt_version: PROMPT_VERSION, enriched_brands: [] },
    });
    return json({ status: "completed", items_fetched: 0, items_processed: 0 });
  }

  /* ── 2. Fetch brand tiers (all at once for efficiency) ── */
  const { data: brandTiers } = await supabase
    .from("intake_brand_tiers")
    .select("brand_name, tier");

  const tierMap = new Map<string, string>();
  if (brandTiers) {
    for (const bt of brandTiers) {
      tierMap.set(bt.brand_name.toLowerCase(), bt.tier);
    }
  }

  /* ── 3-5. Enrich each product ── */
  let successCount = 0;
  let errorCount = 0;
  const enrichedBrands: string[] = [];

  for (const product of products) {
    const brandLower = (product.brand || "").toLowerCase();
    const tier = tierMap.get(brandLower) || "unknown";

    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userPrompt({
                title_raw: product.title_raw || "",
                description_raw: product.description_raw || "",
                category: product.category || "unknown",
                price: product.price || 0,
                currency: product.currency || "SEK",
                brand: product.brand || "unknown",
                tier,
              }),
            },
          ],
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error(`[intake-enrich-test] Anthropic error for ${product.id}: ${anthropicRes.status} ${errText}`);
        errorCount++;
        continue;
      }

      const anthropicData = await anthropicRes.json();
      const textBlock = anthropicData?.content?.find(
        (b: { type: string }) => b.type === "text"
      );
      if (!textBlock?.text) {
        console.error(`[intake-enrich-test] No text in response for ${product.id}`);
        errorCount++;
        continue;
      }

      /* ── 4. Parse safely ── */
      let enriched: Record<string, unknown>;
      try {
        // Strip possible markdown fences
        const raw = textBlock.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        enriched = JSON.parse(raw);
      } catch {
        console.error(`[intake-enrich-test] Malformed JSON for ${product.id}:`, textBlock.text.slice(0, 200));
        errorCount++;
        continue;
      }

      /* ── 5. Update product ── */
      const confidence = {
        brand: enriched.brand_confidence ?? null,
        category: enriched.category_confidence ?? null,
        color: enriched.color_confidence ?? null,
        material: enriched.material_confidence ?? null,
        size: enriched.size_confidence ?? null,
        condition: enriched.condition_confidence ?? null,
      };

      const { error: updateErr } = await supabase
        .from("intake_normalized_products")
        .update({
          brand: (enriched.brand as string) || product.brand,
          category: (enriched.category as string) || product.category,
          subcategory: (enriched.subcategory as string) || null,
          color: (enriched.color as string) || null,
          material: (enriched.material as string) || null,
          size: (enriched.size as string) || null,
          condition: (enriched.condition as string) || null,
          title_clean: (enriched.title_clean as string) || null,
          description_clean: (enriched.description_clean as string) || null,
          style_tags: enriched.style_tags || null,
          confidence,
          current_queue_state: "enriched",
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (updateErr) {
        console.error(`[intake-enrich-test] Update error for ${product.id}:`, updateErr.message);
        errorCount++;
        continue;
      }

      successCount++;
      if (enriched.brand) enrichedBrands.push(enriched.brand as string);
    } catch (err) {
      console.error(`[intake-enrich-test] Unexpected error for ${product.id}:`, err);
      errorCount++;
    }
  }

  /* ── 6. Write run log ── */
  await supabase.from("intake_run_logs").insert({
    run_type: "enrich",
    source: "ebay",
    status: "completed",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    items_fetched: products.length,
    items_processed: successCount,
    error_count: errorCount,
    summary: {
      model_version: MODEL,
      prompt_version: PROMPT_VERSION,
      enriched_brands: [...new Set(enrichedBrands)],
    },
  });

  return json({
    status: "completed",
    items_fetched: products.length,
    items_processed: successCount,
    error_count: errorCount,
  });
});
