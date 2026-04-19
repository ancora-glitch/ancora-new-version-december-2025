import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROMPT_VERSION = "v2";
const RULES_VERSION = "v2";
const MODEL = "claude-sonnet-4-20250514";

const ANCORA_CATEGORIES = new Set([
  "outerwear", "tops", "knitwear", "shirts", "blazers", "dresses",
  "skirts", "jeans", "trousers", "shorts", "bags", "shoes", "accessories",
]);

const BRAND_SCORES: Record<string, number> = {
  a: 25, b: 18, c: 8, unknown: 10, reject: 0,
};

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

/* ── VISUAL: image count (0-10) ── */
function imageCountScore(imageUrls: unknown): number {
  if (!Array.isArray(imageUrls)) return 0;
  const count = imageUrls.length;
  if (count >= 3) return 10;
  if (count === 2) return 6;
  if (count === 1) return 2;
  return 0;
}

function metadataScore(p: Record<string, unknown>): number {
  let s = 0;
  if (p.title_clean) s += 3;
  if (p.brand) s += 3;
  if (p.color) s += 2;
  if (p.material) s += 2;
  return s;
}

/* ── MATERIAL adjustment for metadata_quality ── */
const NATURAL_MATERIALS = ["wool", "cashmere", "silk", "linen", "leather", "cotton", "denim"];
const SYNTHETIC_MATERIALS = ["polyester", "synthetic", "acrylic", "nylon"];

function materialAdjustment(material: string | null): number {
  if (!material) return -1;
  const m = material.toLowerCase();
  if (NATURAL_MATERIALS.some((n) => m === n || m.startsWith(n))) return 0;
  if (SYNTHETIC_MATERIALS.some((s) => m.includes(s))) return -4;
  // mixed/blend with natural majority indicators
  if (NATURAL_MATERIALS.some((n) => m.includes(n))) return -1;
  return -1;
}

function commercialScore(price: number | null): number {
  if (!price || price <= 0) return 0;
  if (price < 500) return 4;
  if (price <= 1000) return 10;
  if (price <= 5000) return 15;
  return 12;
}

/* ── CONDITION adjustment for commercial_quality ── */
function conditionAdjustment(condition: string | null): { delta: number; flag: string | null } {
  if (!condition) return { delta: -2, flag: null };
  const c = condition.toLowerCase();
  if (c === "new" || c === "very_good" || c === "excellent") return { delta: 0, flag: null };
  if (c === "good") return { delta: -3, flag: null };
  if (c === "fair") return { delta: -8, flag: null };
  if (c === "poor") return { delta: -15, flag: "poor_condition" };
  return { delta: -2, flag: null };
}

function categoryScore(cat: string | null): number {
  if (!cat) return 0;
  return ANCORA_CATEGORIES.has(cat.toLowerCase()) ? 15 : 0;
}

interface EditorialResult {
  presentation_score: number;
  editorial_score: number;
  editorial_reason: string;
}

async function aiEvaluate(
  anthropicKey: string,
  p: Record<string, unknown>,
  tier: string,
  editorialBrief: string,
): Promise<EditorialResult> {
  const styleTags = Array.isArray(p.style_tags) ? p.style_tags.join(", ") : "";
  const imageUrls = Array.isArray(p.image_urls) ? p.image_urls : [];
  const firstImage = imageUrls[0] || "(none)";

  const briefBlock = editorialBrief.trim()
    ? `\n\nCurrent editorial brief for Ancora:\n${editorialBrief}\nProducts that align with this brief should score higher on editorial distinctiveness. Products that feel off-season, off-trend, or misaligned with the brief should score lower.`
    : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 384,
      system:
        "You are an editorial assistant for Ancora, a curated second-hand fashion storefront with a minimalist, Scandinavian aesthetic. Score presentation quality and editorial distinctiveness. Return JSON only.",
      messages: [
        {
          role: "user",
          content: `Evaluate this product for Ancora.

Brand: ${p.brand || "unknown"} (tier: ${tier})
Category: ${p.category || "unknown"} / ${p.subcategory || ""}
Title: ${p.title_clean || p.title_raw || ""}
Style tags: ${styleTags}
Price: ${p.price || 0} SEK
Color: ${p.color || "unknown"}
Material: ${p.material || "unknown"}
Condition: ${p.condition || "unknown"}
Primary image URL: ${firstImage}
Image count: ${imageUrls.length}

Score on TWO dimensions:

1) presentation_score (0-10) — based on the primary image:
   10 = model or mannequin, clean/white/neutral background, sharp and well-lit
   7  = flat lay on clean surface, good lighting
   4  = hanger shot, acceptable background
   1  = photographed on floor, bed, or chair
   0  = cluttered background, other items visible
   If you cannot infer presentation from the URL alone, estimate from filename/path hints (e.g. "model", "flatlay", "hanger") and default to 4.

   Be strict about background quality. A home environment with furniture, walls, or personal items visible should score 1-2 regardless of garment quality. Only professional or clean neutral backgrounds score above 6.

   Updated scale:
   10 = model or mannequin, clean/white/neutral background, sharp and well-lit, professional styling
   6  = flat lay on clean surface, good lighting
   3  = hanger shot on plain wall or door, acceptable background
   1  = photographed in home environment (bedroom, living room, kitchen, on furniture), any personal items visible in background, outfit shot on person but in home setting
   0  = photographed on floor, cluttered background with many objects, very dark or blurry image

2) editorial_score (0-15) — distinctiveness and fit:
   Is this distinctive, timeless, or trend-relevant? Would it feel at home in a curated Ancora edit?
   Marks & Spencer, fast fashion, or generic items score 0-3. Tier A brands with strong editorial potential score 10-15.${briefBlock}

Return JSON only:
{"presentation_score": number 0-10, "editorial_score": number 0-15, "editorial_reason": string (one sentence)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[intake-score-test] Anthropic error: ${res.status} ${err}`);
    return { presentation_score: 4, editorial_score: 5, editorial_reason: "AI scoring unavailable" };
  }

  const data = await res.json();
  const textBlock = data?.content?.find((b: { type: string }) => b.type === "text");
  if (!textBlock?.text) {
    return { presentation_score: 4, editorial_score: 5, editorial_reason: "No AI response" };
  }

  try {
    const raw = textBlock.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(raw);
    return {
      presentation_score: Math.min(10, Math.max(0, Number(parsed.presentation_score) || 0)),
      editorial_score: Math.min(15, Math.max(0, Number(parsed.editorial_score) || 0)),
      editorial_reason: String(parsed.editorial_reason || ""),
    };
  } catch {
    console.error("[intake-score-test] Malformed JSON:", textBlock.text.slice(0, 200));
    return { presentation_score: 4, editorial_score: 5, editorial_reason: "Parse error" };
  }
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

  // Guards
  if (envFlag("VITE_INTAKE_KILL_SWITCH")) {
    await supabase.from("intake_run_logs").insert({
      run_type: "score", source: "ebay", status: "aborted_kill_switch",
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    });
    return json({ status: "aborted_kill_switch" });
  }

  if (!envFlag("VITE_INTAKE_V1_ENABLED") || !envFlag("VITE_INTAKE_SCORING_ENABLED")) {
    await supabase.from("intake_run_logs").insert({
      run_type: "score", source: "ebay", status: "aborted_flag_disabled",
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    });
    return json({ status: "aborted_flag_disabled" });
  }

  if (!anthropicKey) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }

  const limit = envInt("VITE_INTAKE_MAX_ITEMS_PER_RUN", 10);
  const startedAt = new Date().toISOString();

  // 0. Fetch active editorial brief
  let editorialBrief = "";
  try {
    const { data: briefRow } = await supabase
      .from("intake_editorial_briefs")
      .select("brief_text")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (briefRow?.brief_text) editorialBrief = briefRow.brief_text;
  } catch (e) {
    console.error("[intake-score-test] brief fetch error:", e);
  }

  // 1. Fetch enriched products
  const { data: products, error: fetchErr } = await supabase
    .from("intake_normalized_products")
    .select("*")
    .eq("current_queue_state", "enriched")
    .limit(limit);

  if (fetchErr) {
    console.error("[intake-score-test] fetch error:", fetchErr.message);
    return json({ error: fetchErr.message }, 500);
  }

  if (!products || products.length === 0) {
    await supabase.from("intake_run_logs").insert({
      run_type: "score", source: "ebay", status: "completed",
      started_at: startedAt, completed_at: new Date().toISOString(),
      items_fetched: 0, items_processed: 0, error_count: 0,
      summary: { model_version: MODEL, prompt_version: PROMPT_VERSION, score_distribution: {}, editorial_brief_used: !!editorialBrief },
    });
    return json({ status: "completed", items_fetched: 0, items_processed: 0 });
  }

  // 2. Fetch brand tiers
  const { data: brandTiers } = await supabase
    .from("intake_brand_tiers")
    .select("brand_name, tier");

  const tierMap = new Map<string, string>();
  if (brandTiers) {
    for (const bt of brandTiers) tierMap.set(bt.brand_name.toLowerCase(), bt.tier);
  }

  // 3-7. Score each product
  let successCount = 0;
  let errorCount = 0;
  let draftApproved = 0;
  let reviewCount = 0;
  let rejectedCount = 0;

  for (const product of products) {
    try {
      const brandLower = (product.brand || "").toLowerCase();
      const tier = tierMap.get(brandLower) || "unknown";
      const brandFit = BRAND_SCORES[tier] ?? 10;
      const catFit = categoryScore(product.category);

      // AI evaluates presentation + editorial
      const ai = await aiEvaluate(anthropicKey, product, tier, editorialBrief);

      // VISUAL = presentation (0-10) + image count (0-10) = 0-20
      const imgCountScore = imageCountScore(product.image_urls);
      const visual = ai.presentation_score + imgCountScore;

      // METADATA with material adjustment
      const metaBase = metadataScore(product);
      const matAdj = materialAdjustment(product.material);
      const metadata = Math.max(0, metaBase + matAdj);

      // COMMERCIAL with condition adjustment
      const commBase = commercialScore(product.price);
      const condAdj = conditionAdjustment(product.condition);
      const commercial = Math.max(0, commBase + condAdj.delta);

      const totalScore = brandFit + catFit + visual + metadata + commercial + ai.editorial_score;

      // Hard overrides
      const hardFlags: string[] = [];
      if (tier === "reject") hardFlags.push("tier_reject");
      if (!product.affiliate_url) hardFlags.push("no_affiliate_url");
      if (!Array.isArray(product.image_urls) || product.image_urls.length === 0) hardFlags.push("no_images");

      const softFlags: string[] = [];
      if (condAdj.flag) softFlags.push(condAdj.flag);

      let decision: string;
      if (hardFlags.length > 0) {
        decision = "rejected";
      } else if (totalScore >= 75) {
        decision = "scored_draft_approved";
      } else if (totalScore >= 40) {
        decision = "scored_review";
      } else {
        decision = "rejected";
      }

      // 6. Write evaluation
      const { error: evalErr } = await supabase.from("intake_evaluations").insert({
        normalized_product_id: product.id,
        rules_version: RULES_VERSION,
        prompt_version: PROMPT_VERSION,
        model_version: MODEL,
        subscores: {
          brand_fit: brandFit,
          category_fit: catFit,
          visual_quality: visual,
          visual_presentation: ai.presentation_score,
          visual_image_count: imgCountScore,
          metadata_quality: metadata,
          metadata_material_adjustment: matAdj,
          commercial_quality: commercial,
          commercial_condition_adjustment: condAdj.delta,
          editorial_distinctiveness: ai.editorial_score,
        },
        score_total: totalScore,
        decision,
        reasons: [ai.editorial_reason, `brand tier: ${tier}`, editorialBrief ? "editorial brief applied" : "no brief"],
        hard_flags: hardFlags,
        soft_flags: softFlags,
      });

      if (evalErr) {
        console.error(`[intake-score-test] eval insert error for ${product.id}:`, evalErr.message);
        errorCount++;
        continue;
      }

      // 7. Update queue state
      const { error: updateErr } = await supabase
        .from("intake_normalized_products")
        .update({ current_queue_state: decision, updated_at: new Date().toISOString() })
        .eq("id", product.id);

      if (updateErr) {
        console.error(`[intake-score-test] update error for ${product.id}:`, updateErr.message);
        errorCount++;
        continue;
      }

      successCount++;
      if (decision === "scored_draft_approved") draftApproved++;
      else if (decision === "scored_review") reviewCount++;
      else rejectedCount++;
    } catch (err) {
      console.error(`[intake-score-test] unexpected error for ${product.id}:`, err);
      errorCount++;
    }
  }

  // 8. Run log
  await supabase.from("intake_run_logs").insert({
    run_type: "score",
    source: "ebay",
    status: "completed",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    items_fetched: products.length,
    items_processed: successCount,
    draft_approved_count: draftApproved,
    review_count: reviewCount,
    rules_rejected_count: rejectedCount,
    error_count: errorCount,
    summary: {
      model_version: MODEL,
      prompt_version: PROMPT_VERSION,
      editorial_brief_used: !!editorialBrief,
      score_distribution: {
        scored_draft_approved: draftApproved,
        scored_review: reviewCount,
        rejected: rejectedCount,
      },
    },
  });

  return json({
    status: "completed",
    items_fetched: products.length,
    items_processed: successCount,
    draft_approved_count: draftApproved,
    review_count: reviewCount,
    rules_rejected_count: rejectedCount,
    error_count: errorCount,
  });
});
