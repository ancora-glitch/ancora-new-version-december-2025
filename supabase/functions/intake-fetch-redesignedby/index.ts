import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── CORS ── */
const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isAllowed =
    origin === "https://ancoraedit.lovable.app" ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (isAllowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonRes(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── RDBY base + endpoints (public catalog, no auth) ── */
const RDBY_BASE = "https://wiuiatrnvqyclntzwirz.supabase.co/functions/v1";

/* ── English heuristic (inline copy of src/lib/languageDetect) ── */
function isLikelyEnglish(text: string): boolean {
  if (!text) return false;
  if (/[åäöÅÄÖ]/.test(text)) return false;
  const stop = ["och", "för", "med", "som", "det", "den", "ett", "att", "har", "kan", "inte", "från", "ska", "till"];
  const lower = text.toLowerCase();
  const matches = stop.filter((w) => new RegExp(`\\b${w}\\b`).test(lower));
  return matches.length < 2;
}

/* ── Auth: admin or service-role ── */
async function verifyAdmin(req: Request, cors: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false as const, response: jsonRes({ error: "Unauthorized" }, 401, cors) };
  }
  const token = authHeader.replace("Bearer ", "");
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token === srk) return { authorized: true as const, userId: "service-role" };

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return { authorized: false as const, response: jsonRes({ error: "Unauthorized" }, 401, cors) };

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, srk);
  const { data: r } = await svc.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!r) return { authorized: false as const, response: jsonRes({ error: "Forbidden" }, 403, cors) };
  return { authorized: true as const, userId: user.id };
}

/* ══════════════════════════════════════════════════════ */
/*  MAIN HANDLER                                         */
/* ══════════════════════════════════════════════════════ */

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = await verifyAdmin(req, cors);
  if (!auth.authorized) return auth.response;

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Parse body
  let dryRun = false;
  try {
    const body = req.body ? await req.json() : {};
    dryRun = body?.dry_run === true;
  } catch {
    return jsonRes({ error: "Invalid JSON body" }, 400, cors);
  }

  const env = (k: string) => Deno.env.get(k) ?? "";
  const SOURCE = "redesignedby";

  /* ── GUARD RULES ── */
  if (env("VITE_INTAKE_V1_ENABLED") !== "true") {
    await svc.from("intake_run_logs").insert({
      source: SOURCE, run_type: "fetch", status: "aborted_flag_disabled",
      items_fetched: 0, items_processed: 0,
      summary: { reason: "INTAKE_V1_ENABLED != true" },
    });
    return jsonRes({ error: "Pipeline disabled (INTAKE_V1_ENABLED != true)" }, 200, cors);
  }
  if (env("VITE_INTAKE_FETCH_ENABLED") !== "true") {
    await svc.from("intake_run_logs").insert({
      source: SOURCE, run_type: "fetch", status: "aborted_flag_disabled",
      items_fetched: 0, items_processed: 0,
      summary: { reason: "INTAKE_FETCH_ENABLED != true" },
    });
    return jsonRes({ error: "Fetch disabled (INTAKE_FETCH_ENABLED != true)" }, 200, cors);
  }
  if (env("VITE_INTAKE_KILL_SWITCH") === "true") {
    await svc.from("intake_run_logs").insert({
      source: SOURCE, run_type: "fetch", status: "aborted_kill_switch",
      items_fetched: 0, items_processed: 0,
      summary: { reason: "INTAKE_KILL_SWITCH == true" },
    });
    return jsonRes({ error: "Kill switch active" }, 200, cors);
  }

  /* ── START RUN ── */
  const { data: runRow, error: runErr } = await svc.from("intake_run_logs").insert({
    source: SOURCE, run_type: "fetch", status: "started",
    items_fetched: 0, items_processed: 0,
  }).select("id").single();

  if (runErr || !runRow) {
    console.error("Failed to create run log:", runErr);
    return jsonRes({ error: "Failed to create run log" }, 500, cors);
  }
  const runId = runRow.id;

  /* ── FETCH SEARCH ── */
  let searchData: any;
  try {
    const res = await fetch(`${RDBY_BASE}/redesignedby-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 10 }),
    });
    if (!res.ok) {
      const t = await res.text();
      await svc.from("intake_run_logs").update({
        status: "failed", completed_at: new Date().toISOString(),
        summary: { reason: `redesignedby-search failed: ${res.status} ${t}`, selected_source: SOURCE },
      }).eq("id", runId);
      return jsonRes({ error: `Search failed: ${res.status}` }, 502, cors);
    }
    searchData = await res.json();
  } catch (e: any) {
    await svc.from("intake_run_logs").update({
      status: "failed", completed_at: new Date().toISOString(),
      summary: { reason: `redesignedby-search exception: ${e.message}`, selected_source: SOURCE },
    }).eq("id", runId);
    return jsonRes({ error: e.message }, 500, cors);
  }

  const summaries: any[] = Array.isArray(searchData?.products)
    ? searchData.products
    : Array.isArray(searchData?.items)
    ? searchData.items
    : Array.isArray(searchData)
    ? searchData
    : [];

  const itemsFetched = summaries.length;

  /* ── PROCESS ── */
  const results: any[] = [];
  let processedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;
  let duplicatesSkipped = 0;
  let alreadyInProduction = 0;
  let aborted = false;

  for (let i = 0; i < summaries.length; i++) {
    if (aborted) break;
    const summary = summaries[i];
    const handle: string | undefined = summary?.handle;
    const summaryAffiliateUrl: string | undefined = summary?.affiliateUrl;

    try {
      if (i > 0) await delay(300);

      // Early dedupe based on summary (handle + affiliateUrl)
      if (handle) {
        const { data: dupRaw } = await svc.from("intake_raw_listings")
          .select("id").eq("external_id", handle).eq("source", SOURCE).limit(1).maybeSingle();
        const { data: dupNorm } = !dupRaw ? await svc.from("intake_normalized_products")
          .select("id").eq("external_id", handle).eq("source", SOURCE).limit(1).maybeSingle()
          : { data: null };
        const { data: dupProd } = !dupRaw && !dupNorm && summaryAffiliateUrl
          ? await svc.from("products").select("id").eq("affiliate_url", summaryAffiliateUrl).limit(1).maybeSingle()
          : { data: null };

        if (dupRaw || dupNorm) {
          duplicatesSkipped++;
          results.push({ external_id: handle, title: summary?.title, queue_state: "duplicate_skipped", hard_flags: [], soft_flags: [], skipped: "duplicate_intake" });
          continue;
        }
        if (dupProd) {
          alreadyInProduction++;
          results.push({ external_id: handle, title: summary?.title, queue_state: "already_in_production", hard_flags: [], soft_flags: [], skipped: "already_in_production" });
          continue;
        }
      }

      // Fetch full item detail
      let detail: any;
      try {
        const res = await fetch(`${RDBY_BASE}/redesignedby-item`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`item fetch ${res.status}: ${t}`);
        }
        detail = await res.json();
      } catch (e: any) {
        // Per spec: abort remaining batch immediately on any fetch error
        errorCount++;
        results.push({ external_id: handle, title: summary?.title, queue_state: "error", hard_flags: [], soft_flags: [], error: e.message });
        aborted = true;
        break;
      }

      // Field mapping
      const title: string = detail?.title ?? "";
      const description: string = detail?.descriptionText ?? "";
      const brand: string | null = detail?.vendor ?? null;
      const price: number | null = (typeof detail?.price === "number" && detail.price > 0) ? detail.price : null;
      const currency: string = detail?.currency ?? "SEK";
      const affiliateUrl: string | null = detail?.affiliateUrl ?? summaryAffiliateUrl ?? null;
      const images: string[] = Array.isArray(detail?.images)
        ? detail.images.map((im: any) => im?.src).filter(Boolean)
        : [];
      const available: boolean = detail?.available !== false;
      const size: string | null = detail?.size ?? null;
      const color: string | null = detail?.color ?? null;
      const tags: string[] = Array.isArray(detail?.tags) ? detail.tags : [];
      const slug: string = detail?.handle ?? handle ?? "";

      /* HARD REJECT */
      const hardFlags: string[] = [];
      if (!affiliateUrl) hardFlags.push("missing_affiliate_url");
      if (price === null || price === 0) hardFlags.push("missing_or_zero_price");
      if (images.length === 0) hardFlags.push("no_images");
      if (!title || title.length < 3) hardFlags.push("title_too_short");
      if (!available) hardFlags.push("unavailable");
      if (!brand || !brand.trim()) hardFlags.push("unknown_brand");

      /* SOFT FLAGS */
      const softFlags: string[] = [];
      if (images.length < 2) softFlags.push("fewer_than_2_images");
      if (!size) softFlags.push("size_missing");
      if (price !== null && price < 500) softFlags.push("price_below_500_sek");


      const isRejected = hardFlags.length > 0;
      const queueState = isRejected ? "rules_rejected" : "normalized";

      /* TRANSLATION */
      let title_en: string | null = null;
      let description_en: string | null = null;
      let language: "sv" | "en" = "sv";
      let translated_at: string | null = null;
      if (!isRejected) {
        const sample = `${title} ${description}`.trim();
        if (isLikelyEnglish(sample)) {
          title_en = title;
          description_en = description || null;
          language = "en";
          translated_at = new Date().toISOString();
        } else {
          try {
            const { data: tr, error: trErr } = await svc.functions.invoke("translate-swedish", {
              body: { name: title, description },
            });
            if (!trErr && tr?.name) {
              title_en = tr.name;
              description_en = tr.description ?? null;
              language = "sv";
              translated_at = new Date().toISOString();
            } else {
              console.warn(`[intake-fetch-redesignedby] translation non-blocking error for ${handle}:`, trErr);
            }
          } catch (e: any) {
            console.warn(`[intake-fetch-redesignedby] translation exception for ${handle}:`, e.message);
          }
        }
      }

      const rawPayload = {
        handle,
        slug,
        title,
        descriptionText: description,
        descriptionHtml: detail?.descriptionHtml,
        vendor: brand,
        price,
        currency,
        affiliateUrl,
        productUrl: detail?.productUrl,
        images: detail?.images,
        tags,
        size,
        color,
        material: detail?.material,
        condition: detail?.condition,
        era: detail?.era,
        available,
        sku: detail?.sku,
        translation: { title_en, description_en, language, translated_at },
        _searchSummary: summary,
      };

      const normalized = {
        source: SOURCE,
        external_id: handle ?? null,
        affiliate_url: affiliateUrl,
        title_raw: title,
        title_clean: title,
        description_raw: description || null,
        brand,
        category: null,
        color,
        size,
        material: detail?.material ?? null,
        condition: detail?.condition ?? null,
        price,
        currency,
        image_urls: images,
        availability_status: available ? "available" : "unavailable",
        current_queue_state: queueState,
      };

      if (!dryRun) {
        const { data: rawRow } = await svc.from("intake_raw_listings").insert({
          source: SOURCE,
          external_id: handle ?? null,
          raw_payload: rawPayload,
          import_run_id: runId,
        }).select("id").single();

        const { data: normRow } = await svc.from("intake_normalized_products").insert({
          ...normalized,
          raw_listing_id: rawRow?.id || null,
        }).select("id").single();

        if (normRow) {
          await svc.from("intake_evaluations").insert({
            normalized_product_id: normRow.id,
            rules_version: "v1.0",
            hard_flags: hardFlags,
            soft_flags: softFlags,
            score_total: isRejected ? 0 : 100 - softFlags.length * 10,
            decision: isRejected ? "reject" : softFlags.length > 0 ? "review" : "draft_approve",
            reasons: [...hardFlags, ...softFlags],
          });
        }
      }

      results.push({
        external_id: handle,
        title,
        queue_state: queueState,
        hard_flags: hardFlags,
        soft_flags: softFlags,
        price,
        currency,
        brand,
        image_count: images.length,
      });

      processedCount++;
      if (isRejected) rejectedCount++;
    } catch (e: any) {
      console.error(`Error processing item ${i}:`, e.message);
      errorCount++;
      results.push({ external_id: handle, queue_state: "error", hard_flags: [], soft_flags: [], error: e.message });
      // Per spec: abort remaining batch on any fetch/process error
      aborted = true;
      break;
    }
  }

  /* ── RUN LOG UPDATE ── */
  const rejectedReasons = results
    .filter((r) => r.hard_flags?.length > 0)
    .map((r) => ({ external_id: r.external_id, reasons: r.hard_flags }));

  const softFlagsSummary: Record<string, number> = {};
  for (const r of results) {
    for (const flag of (r.soft_flags ?? [])) {
      softFlagsSummary[flag] = (softFlagsSummary[flag] || 0) + 1;
    }
  }

  const reviewCount = results.filter((r) => (r.hard_flags?.length ?? 0) === 0 && (r.soft_flags?.length ?? 0) > 0 && r.queue_state === "normalized").length;
  const approvedCount = results.filter((r) => (r.hard_flags?.length ?? 0) === 0 && (r.soft_flags?.length ?? 0) === 0 && r.queue_state === "normalized").length;

  await svc.from("intake_run_logs").update({
    status: aborted || errorCount > 0 ? "failed" : "completed",
    completed_at: new Date().toISOString(),
    items_fetched: itemsFetched,
    items_processed: processedCount,
    rules_rejected_count: rejectedCount,
    review_count: reviewCount,
    draft_approved_count: approvedCount,
    error_count: errorCount,
    summary: {
      dry_run: dryRun,
      total_results: results.length,
      duplicates_skipped: duplicatesSkipped,
      already_in_production: alreadyInProduction,
      rejected_reasons: rejectedReasons,
      soft_flags_summary: softFlagsSummary,
      selected_source: SOURCE,
    },
  }).eq("id", runId);

  return jsonRes({
    run_id: runId,
    dry_run: dryRun,
    items_fetched: itemsFetched,
    items_processed: processedCount,
    rules_rejected: rejectedCount,
    review: reviewCount,
    draft_approved: approvedCount,
    errors: errorCount,
    duplicates_skipped: duplicatesSkipped,
    already_in_production: alreadyInProduction,
    aborted,
    results,
  }, 200, cors);
});
