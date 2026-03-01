import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_CHECKS_PER_RUN = 25;

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

async function verifyAdminOrServiceRole(
  req: Request,
): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token === serviceRoleKey) {
    return { authorized: true, userId: "service-role" };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleData) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return { authorized: true, userId: user.id };
}

// ── Helpers ──

async function runRetention(supabase: any) {
  try {
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
    await supabase.from("cron_runs").delete().lt("ran_at", cutoff);
  } catch (_) {
    /* never block */
  }
}

async function logCronRun(supabase: any, payload: Record<string, any>) {
  try {
    await supabase.from("cron_runs").insert(payload);
  } catch (_) {
    /* non-blocking */
  }
}

// ── Cursor helpers ──

async function getCursor(supabase: any, jobName: string): Promise<number> {
  const { data } = await supabase.from("cron_job_state").select("cursor_value").eq("job_name", jobName).maybeSingle();
  return data?.cursor_value ?? 0;
}

async function setCursor(supabase: any, jobName: string, value: number) {
  await supabase
    .from("cron_job_state")
    .upsert({ job_name: jobName, cursor_value: value, updated_at: new Date().toISOString() });
}

// ── eBay API ──

type AffiliateStatus = "active" | "sold" | "unavailable" | "unknown";

let cachedToken: { token: string; expiresAt: number } | null = null;

function getEbayBaseUrl(): string {
  return (Deno.env.get("EBAY_ENV") || "production") === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<{ token: string } | { error: string }> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return { token: cachedToken.token };
  }
  try {
    const response = await fetch(`${getEbayBaseUrl()}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });
    if (!response.ok) return { error: "OAuth token generation failed" };
    const tokenData = await response.json();
    cachedToken = { token: tokenData.access_token, expiresAt: now + (tokenData.expires_in || 7200) * 1000 };
    return { token: tokenData.access_token };
  } catch (error: any) {
    return { error: error.message };
  }
}

function extractEbayItemId(url: string | null): string | null {
  if (!url) return null;

  const match = url.match(/\/itm\/[^0-9]*?(\d{10,15})/i);
  if (match?.[1]) return match[1];

  const fallback = url.match(/(\d{10,15})/);
  if (fallback?.[1]) return fallback[1];

  return null;
}

async function checkEbayItemAvailability(
  itemId: string,
  accessToken: string,
): Promise<{ status: AffiliateStatus; error?: string }> {
  const itemUrl = `${getEbayBaseUrl()}/buy/browse/v1/item/v1|${itemId}|0`;
  try {
    const response = await fetch(itemUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    });
    if (response.status === 404) return { status: "unavailable" };
    if (!response.ok) return { status: "unknown", error: `API error: ${response.status}` };
    const item = await response.json();
    if (item.itemEndDate && new Date(item.itemEndDate) < new Date()) return { status: "sold" };
    if (item.estimatedAvailabilities) {
      for (const avail of item.estimatedAvailabilities) {
        if (avail.availabilityStatus === "OUT_OF_STOCK") return { status: "sold" };
        if (avail.estimatedAvailableQuantity === 0) return { status: "sold" };
      }
    }
    if (item.currentBidPrice && item.biddingInfo?.auctionStatus === "ENDED") return { status: "sold" };
    return { status: "active" };
  } catch (error: any) {
    return { status: "unknown", error: error.message };
  }
}

// ── Main handler ──

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  const startedAt = new Date();
  const _startTime = startedAt.getTime();
  let supabase: any;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY in Edge environment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const EBAY_CLIENT_ID = Deno.env.get("EBAY_CLIENT_ID") || Deno.env.get("EBAY_APP_ID");
    const EBAY_CLIENT_SECRET = Deno.env.get("EBAY_CLIENT_SECRET") || Deno.env.get("EBAY_CERT_ID");

    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "eBay API credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
    await runRetention(supabase);

    const tokenResult = await getAccessToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);
    if ("error" in tokenResult) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: "ebay_availability",
        status: "error",
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0,
        checked_count: 0,
        sold_marked: 0,
        batch_size: MAX_CHECKS_PER_RUN,
        error_message: "OAuth token failed",
      });
      return new Response(JSON.stringify({ error: tokenResult.error }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = tokenResult.token;

    // Fetch ALL eligible products (guardrails: published + has affiliate_url + ebay marketplace)
    const { data: allProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, name, brand, affiliate_url, affiliate_auto_handling, affiliate_status, marketplace")
      .ilike("marketplace", "%ebay%")
      .in("status", ["active", "published"])
      .not("affiliate_url", "is", null)
      .order("id", { ascending: true });

    if (fetchError) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: "ebay_availability",
        status: "error",
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0,
        checked_count: 0,
        sold_marked: 0,
        batch_size: MAX_CHECKS_PER_RUN,
        error_message: fetchError.message,
      });
      return new Response(JSON.stringify({ error: "Failed to fetch products", details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!allProducts || allProducts.length === 0) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: "ebay_availability",
        status: "success",
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0,
        checked_count: 0,
        sold_marked: 0,
        batch_size: MAX_CHECKS_PER_RUN,
      });
      return new Response(JSON.stringify({ message: "No active eBay products to check", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Round-robin cursor
    const cursorBefore = await getCursor(supabase, "ebay_availability");
    const totalProducts = allProducts.length;
    const startIdx = cursorBefore % totalProducts;

    // Pick batch from cursor position, wrapping around
    const batch: typeof allProducts = [];
    for (let i = 0; i < Math.min(MAX_CHECKS_PER_RUN, totalProducts); i++) {
      batch.push(allProducts[(startIdx + i) % totalProducts]);
    }
    const cursorAfter = (startIdx + batch.length) % totalProducts;

    const THROTTLE_DELAY_MS = 500;
    const results: any[] = [];

    for (const product of batch) {
      const itemId = extractEbayItemId(product.affiliate_url);
      if (!itemId) {
        console.warn(
          `[EbayAvailability:Skip] { productId: "${product.id}", reason: "item_id_extraction_failed", affiliate_url: "${product.affiliate_url}" }`,
        );
        results.push({
          productId: product.id,
          productName: `${product.brand} - ${product.name}`,
          affiliateStatus: "unknown",
          autoUnpublished: false,
          error: "Could not extract eBay item ID from URL",
        });
        continue;
      }

      if (results.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, THROTTLE_DELAY_MS));
      }

      const availability = await checkEbayItemAvailability(itemId, accessToken);
      const affiliateAutoHandling = product.affiliate_auto_handling !== false;
      // INVARIANT: Only update availability/status fields. Never overwrite editorial content
      // (name, description, name_en, description_en, images, brand, etc.)
      const updateData: Record<string, any> = {
        affiliate_status: availability.status,
        affiliate_last_checked_at: new Date().toISOString(),
        affiliate_checked_via: "ebay",
        updated_at: new Date().toISOString(),
      };
      let autoUnpublished = false;
      if (availability.status !== "active" && availability.status !== "unknown" && affiliateAutoHandling) {
        updateData.status = "sold";
        updateData.unpublished_reason = "affiliate_unavailable";
        autoUnpublished = true;
      }
      await supabase.from("products").update(updateData).eq("id", product.id);
      results.push({
        productId: product.id,
        productName: `${product.brand} - ${product.name}`,
        affiliateStatus: availability.status,
        autoUnpublished,
        error: availability.error,
      });
    }

    // Update cursor
    await setCursor(supabase, "ebay_availability", cursorAfter);

    const sold = results.filter((r) => r.affiliateStatus === "sold").length;
    const unpublished = results.filter((r) => r.autoUnpublished).length;
    const finishedAt = new Date();

    await logCronRun(supabase, {
      job_name: "ebay_availability",
      status: "success",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - _startTime,
      items_processed: totalProducts,
      checked_count: results.length,
      sold_marked: unpublished,
      batch_size: MAX_CHECKS_PER_RUN,
      cursor_before: cursorBefore,
      cursor_after: cursorAfter,
    });

    return new Response(
      JSON.stringify({
        message: `Checked ${results.length}/${totalProducts} eBay products (batch ${MAX_CHECKS_PER_RUN})`,
        summary: {
          total: totalProducts,
          checked: results.length,
          active: results.filter((r) => r.affiliateStatus === "active").length,
          sold,
          unavailable: results.filter((r) => r.affiliateStatus === "unavailable").length,
          unknown: results.filter((r) => r.affiliateStatus === "unknown").length,
          unpublished,
        },
        cursor: { before: cursorBefore, after: cursorAfter },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const finishedAt = new Date();
    try {
      if (!supabase) {
        supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      }
      await logCronRun(supabase, {
        job_name: "ebay_availability",
        status: "error",
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0,
        checked_count: 0,
        sold_marked: 0,
        batch_size: MAX_CHECKS_PER_RUN,
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (_) {
      /* non-blocking */
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
