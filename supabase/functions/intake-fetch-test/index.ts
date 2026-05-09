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

/* ── Ancora taxonomy ── */
const ANCORA_CATEGORIES = new Set([
  "outerwear", "tops", "knitwear", "shirts", "blazers", "dresses",
  "skirts", "jeans", "trousers", "shorts", "bags", "shoes", "accessories",
]);

/* ── eBay helpers ── */
let cachedToken: { token: string; expiresAt: number } | null = null;

function getEbayBaseUrl(): string {
  return (Deno.env.get("EBAY_ENV") || "production") === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

async function getAccessToken(clientId: string, clientSecret: string) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return { token: cachedToken.token };
  }
  const url = `${getEbayBaseUrl()}/identity/v1/oauth2/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: `OAuth failed (${res.status}): ${t}` };
  }
  const d = await res.json();
  cachedToken = { token: d.access_token, expiresAt: now + (d.expires_in || 7200) * 1000 };
  return { token: d.access_token };
}

function normalizeImageUrl(url: string): string {
  if (!url || !url.includes("i.ebayimg.com")) return url;
  return url.replace(/s-l(64|140|225|300|400|500)\b/gi, "s-l1600");
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const cleaned = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

interface EbayItemDetails {
  description: string | null;
  conditionStr: string | null;
  conditionId: string | null;
  size: string | null;
  localizedAspects: any;
}

const SIZE_ASPECT_NAMES = new Set([
  "size", "uk size", "eu size", "it size", "us size", "size (women's)",
]);

function extractSizeFromAspects(
  localizedAspects: any,
  itemSpecifics: any,
): string | null {
  const sources = [localizedAspects, itemSpecifics];
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const a of src) {
      const name = (a?.name || a?.aspectName || "").toString().toLowerCase().trim();
      if (SIZE_ASPECT_NAMES.has(name)) {
        const val = a?.value || a?.aspectValue ||
          (Array.isArray(a?.values) ? a.values[0] : null);
        if (val) return String(val).trim();
      }
    }
  }
  return null;
}

async function fetchEbayItemDetails(
  itemId: string,
  token: string,
): Promise<EbayItemDetails | null> {
  try {
    const url = `${getEbayBaseUrl()}/buy/browse/v1/item/${encodeURIComponent(itemId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`getItem failed for ${itemId}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return {
      description: stripHtml(data.description) || stripHtml(data.shortDescription),
      conditionStr: data.condition || null,
      conditionId: data.conditionId ? String(data.conditionId) : null,
      size: extractSizeFromAspects(data.localizedAspects, data.itemSpecifics),
      localizedAspects: data.localizedAspects || null,
    };
  } catch (e: any) {
    console.warn(`getItem error for ${itemId}:`, e.message);
    return null;
  }
}

/* ── eBay condition → Ancora canonical condition ──
 * Maps both conditionId (numeric) and condition string to:
 *   "new" | "very_good" | "poor" | null
 * Used / Pre-Owned defaults to very_good; enrichment refines later.
 */
function mapCondition(
  conditionStr: string | null | undefined,
  conditionId: string | number | null | undefined,
): string | null {
  const cid = conditionId != null ? String(conditionId) : "";
  const cstr = (conditionStr || "").toLowerCase().trim();

  if (cid === "1000" || cid === "1500" || cid === "1750") return "new";
  if (cstr === "new with tags" || cstr === "new without tags" ||
      cstr === "new" || cstr === "brand new") return "new";

  if (cid === "7000") return "poor";
  if (cstr === "for parts or not working") return "poor";

  if (cid === "2000" || cid === "2500" || cid === "2750" ||
      cid === "3000" || cid === "4000" || cid === "5000" || cid === "6000") {
    return "very_good";
  }
  if (cstr === "pre-owned" || cstr === "preowned" || cstr === "used" ||
      cstr === "very good" || cstr === "good" || cstr === "excellent") {
    return "very_good";
  }

  return null;
}

/* ── Simple category guesser from title ── */
function guessCategory(title: string): string | null {
  const t = title.toLowerCase();
  const map: [string, string[]][] = [
    ["outerwear", ["coat", "jacket", "parka", "trench", "overcoat", "cape", "poncho"]],
    ["knitwear", ["sweater", "jumper", "cardigan", "knit", "pullover"]],
    ["blazers", ["blazer"]],
    ["shirts", ["shirt", "blouse"]],
    ["dresses", ["dress", "gown"]],
    ["skirts", ["skirt"]],
    ["jeans", ["jeans", "denim"]],
    ["trousers", ["trousers", "pants", "slacks", "chinos"]],
    ["shorts", ["shorts"]],
    ["tops", ["top", "t-shirt", "tee", "tank", "camisole", "bodysuit"]],
    ["bags", ["bag", "handbag", "purse", "tote", "clutch", "backpack"]],
    ["shoes", ["shoes", "boots", "heels", "sandals", "loafers", "sneakers", "pumps", "flats", "mules"]],
    ["accessories", ["scarf", "belt", "hat", "gloves", "sunglasses", "jewelry", "necklace", "bracelet", "earring", "watch"]],
  ];
  for (const [cat, kws] of map) {
    if (kws.some((k) => t.includes(k))) return cat;
  }
  return null;
}

/* ── Brand extraction from title ── */
function extractBrand(title: string): string | null {
  // Simple heuristic: first capitalized word(s) before any size / style keywords
  const words = title.split(/\s+/);
  if (words.length === 0) return null;
  // Take first word if it looks like a brand (starts uppercase, >2 chars)
  const first = words[0];
  if (first && first.length > 2 && /^[A-Z]/.test(first)) return first;
  return null;
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

function jsonRes(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ══════════════════════════════════════════════════════ */
/*  MAIN HANDLER                                         */
/* ══════════════════════════════════════════════════════ */

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // ── Auth ──
  const auth = await verifyAdmin(req, cors);
  if (!auth.authorized) return auth.response;

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Parse body ──
  let source: string;
  let dryRun = false;
  try {
    const body = await req.json();
    source = body.source;
    dryRun = body.dry_run === true;
    if (!source || typeof source !== "string") {
      return jsonRes({ error: "source is required" }, 400, cors);
    }
  } catch {
    return jsonRes({ error: "Invalid JSON body" }, 400, cors);
  }

  /* ════════════════════════════════════════ */
  /*  GUARD RULES                            */
  /* ════════════════════════════════════════ */

  const env = (k: string) => Deno.env.get(k) ?? "";

  // Guard: INTAKE_V1_ENABLED
  if (env("VITE_INTAKE_V1_ENABLED") !== "true") {
    await svc.from("intake_run_logs").insert({
      source, run_type: "fetch", status: "aborted_flag_disabled",
      items_fetched: 0, items_processed: 0,
    });
    return jsonRes({ error: "Pipeline disabled (INTAKE_V1_ENABLED != true)" }, 200, cors);
  }

  // Guard: INTAKE_FETCH_ENABLED
  if (env("VITE_INTAKE_FETCH_ENABLED") !== "true") {
    await svc.from("intake_run_logs").insert({
      source, run_type: "fetch", status: "aborted_flag_disabled",
      items_fetched: 0, items_processed: 0,
    });
    return jsonRes({ error: "Fetch disabled (INTAKE_FETCH_ENABLED != true)" }, 200, cors);
  }

  // Guard: INTAKE_KILL_SWITCH
  if (env("VITE_INTAKE_KILL_SWITCH") === "true") {
    await svc.from("intake_run_logs").insert({
      source, run_type: "fetch", status: "aborted_kill_switch",
      items_fetched: 0, items_processed: 0,
    });
    return jsonRes({ error: "Kill switch active" }, 200, cors);
  }

  // Guard: INTAKE_ALLOWED_SOURCES
  const allowed = env("VITE_INTAKE_ALLOWED_SOURCES").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(source)) {
    await svc.from("intake_run_logs").insert({
      source, run_type: "fetch", status: "aborted_flag_disabled",
      items_fetched: 0, items_processed: 0,
      summary: { reason: `Source "${source}" not in INTAKE_ALLOWED_SOURCES` },
    });
    return jsonRes({ error: `Source "${source}" not allowed` }, 200, cors);
  }

  // Source support check
  if (source !== "ebay") {
    return jsonRes({ error: `Source "${source}" not supported in v1 (only ebay)` }, 400, cors);
  }

  /* ════════════════════════════════════════ */
  /*  START RUN                              */
  /* ════════════════════════════════════════ */

  const maxItems = parseInt(env("VITE_INTAKE_MAX_ITEMS_PER_RUN") || "10", 10) || 10;

  const { data: runRow, error: runErr } = await svc.from("intake_run_logs").insert({
    source, run_type: "fetch", status: "started",
    items_fetched: 0, items_processed: 0,
  }).select("id").single();

  if (runErr || !runRow) {
    console.error("Failed to create run log:", runErr);
    return jsonRes({ error: "Failed to create run log" }, 500, cors);
  }
  const runId = runRow.id;

  /* ════════════════════════════════════════ */
  /*  FETCH FROM EBAY                        */
  /* ════════════════════════════════════════ */

  const clientId = Deno.env.get("EBAY_CLIENT_ID") || Deno.env.get("EBAY_APP_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET") || Deno.env.get("EBAY_CERT_ID");
  if (!clientId || !clientSecret) {
    await svc.from("intake_run_logs").update({ status: "failed", completed_at: new Date().toISOString(), summary: { reason: "Missing eBay credentials" } }).eq("id", runId);
    return jsonRes({ error: "eBay credentials not configured" }, 500, cors);
  }

  const tokenResult = await getAccessToken(clientId, clientSecret);
  if ("error" in tokenResult) {
    await svc.from("intake_run_logs").update({ status: "failed", completed_at: new Date().toISOString(), summary: { reason: tokenResult.error } }).eq("id", runId);
    return jsonRes({ error: tokenResult.error }, 500, cors);
  }

  // Full Tier A brand pool — each run picks 8-10 randomly
  const allBrands = [
    'Toteme', 'Acne Studios', 'Filippa K', 'Tiger of Sweden',
    'Stine Goya', 'Ganni', 'By Malene Birger', 'Rodebjer',
    'Hope Stockholm', 'Our Legacy', '3.1 Phillip Lim', 'Alaia',
    'Alexander McQueen', 'ATP Atelier', 'APC', 'Balenciaga',
    'Baserange', 'Baum und Pferdgarten', 'Brixtol Textiles',
    'Bottega Veneta', 'Burberry', 'Copenhagen Studios', 'By Malina',
    'Carhartt', 'CDLP', 'Chanel', 'Chimi', 'Chloe', 'Dagmar', 'Dior',
    'Dr Martens', 'Eytys', 'Flattered', 'House of Dagmar', 'Gucci',
    'Patagonia', 'Isabel Marant', 'Jacquemus', 'Jeanerica',
    'Jil Sander', 'Lisa Yang', 'Loewe', 'Louis Vuitton',
    'Ralph Lauren', 'Maison Margiela', 'Maria Nilsdotter',
    'Marimekko', 'Marni', 'Miu Miu', 'Moncler', 'Mulberry', 'Prada',
    'Pucci', 'Saint Laurent', 'Sandqvist', 'See by Chloe',
    'Self Portrait', 'Sefr', 'Skall Studio', 'Stella McCartney',
    'The Row', 'Sophie Billie Brahe', 'Stand Studio', 'Valentino',
    'Veja', 'Versace', 'Wood Wood', 'Avavav', 'Soft Goat',
    'Vivienne Westwood', 'Diesel', 'Adidas by Stella McCartney',
    'Barbour', 'Ahlvar Gallery', 'ROTATE Birger Christensen',
    'Stylein', 'Just Cavalli', 'Helmut Lang', 'Calvin Klein',
    'Little Liffner', 'Paloma Wool', 'Simone Rocha',
    'Proenza Schouler', 'Axel Arigato', 'Celine',
  ];

  // Fisher-Yates shuffle and pick 3-5 brands to search individually
  const shuffled = [...allBrands];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const pickCount = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const selectedBrands = shuffled.slice(0, pickCount);
  console.log(`Selected ${selectedBrands.length} brands:`, selectedBrands);

  const baseUrl = getEbayBaseUrl();
  const filterStr = `buyingOptions:{FIXED_PRICE},price:[38.46..],priceCurrency:GBP,itemLocationCountry:GB`;
  const perBrandLimit = Math.max(2, Math.floor(Math.min(maxItems, 50) / selectedBrands.length));

  let ebayItems: any[] = [];
  let rateLimited = false;
  let rateLimitCount = 0;

  // Search one brand at a time to stay within eBay q-param limits
  for (const brand of selectedBrands) {
    if (rateLimited || ebayItems.length >= maxItems) break;

    const aspectFilter = encodeURIComponent("categoryId:15724,Gender:{Women}");
    const searchUrl = `${baseUrl}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(brand)}&category_ids=15724&limit=${perBrandLimit}&filter=${encodeURIComponent(filterStr)}&aspect_filter=${aspectFilter}`;
    console.log(`Searching eBay for brand: ${brand}`);

    try {
      const res = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
          "Content-Type": "application/json",
        },
      });

      if (res.status === 429) {
        rateLimited = true;
        rateLimitCount++;
        console.warn(`Rate limited on brand: ${brand}`);
        break;
      } else if (!res.ok) {
        const t = await res.text();
        console.error(`eBay search failed for ${brand}:`, res.status, t);
      } else {
        const data = await res.json();
        const items = data.itemSummaries || [];
        console.log(`Brand "${brand}": ${items.length} results (total: ${data.total || 0})`);
        ebayItems.push(...items);
      }

      // Rate-limit courtesy delay between brand searches
      if (selectedBrands.indexOf(brand) < selectedBrands.length - 1) {
        await delay(200);
      }
    } catch (e: any) {
      console.error(`Error searching brand ${brand}:`, e.message);
    }
  }

  // Trim to maxItems and deduplicate by itemId
  const seen = new Set<string>();
  ebayItems = ebayItems.filter((item) => {
    if (!item.itemId || seen.has(item.itemId)) return false;
    seen.add(item.itemId);
    return true;
  });

  // Post-fetch gender filter — safety net in case aspect_filter is not applied
  const GENDER_REJECT_PATTERNS = [
    /\bmen's\b/i,
    /\bmens\b/i,
    /\bman's\b/i,
    /\bunisex\b/i,
    /\bboys\b/i,
    /\bkids\b/i,
    /\bchildren\b/i,
    /\smen\s/i,
  ];
  const beforeGenderFilter = ebayItems.length;
  ebayItems = ebayItems.filter((item) => {
    const title = item.title || "";
    return !GENDER_REJECT_PATTERNS.some((re) => re.test(title));
  });
  const filteredGenderCount = beforeGenderFilter - ebayItems.length;
  console.log(`Gender filter removed ${filteredGenderCount} items`);

  ebayItems = ebayItems.slice(0, maxItems);

  console.log(`Total unique eBay items after all brand searches: ${ebayItems.length}`);

  if (ebayItems.length === 0 && rateLimited) {
    await svc.from("intake_run_logs").update({
      status: "failed", completed_at: new Date().toISOString(),
      summary: { reason: "Rate limited, no items fetched", selected_brands: selectedBrands },
    }).eq("id", runId);
    return jsonRes({ error: "Rate limited" }, 429, cors);
  }

  /* ════════════════════════════════════════ */
  /*  PROCESS ITEMS: normalise + rules       */
  /* ════════════════════════════════════════ */

  const results: any[] = [];
  let processedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;
  let duplicatesSkipped = 0;
  let alreadyInProduction = 0;

  for (let i = 0; i < ebayItems.length; i++) {
    if (rateLimited) break;

    const item = ebayItems[i];
    try {
      // Add 300ms delay between items (skip first)
      if (i > 0) await delay(300);

      // Normalise
      const images: string[] = [];
      if (item.image?.imageUrl) images.push(normalizeImageUrl(item.image.imageUrl));
      if (item.additionalImages) {
        for (const img of item.additionalImages) {
          if (img.imageUrl) {
            const u = normalizeImageUrl(img.imageUrl);
            if (!images.includes(u)) images.push(u);
          }
        }
      }

      const price = item.price?.value ? parseFloat(item.price.value) : null;
      const currency = item.price?.currency || "USD";

      // Convert price to SEK using fixed approximate rates
      const SEK_RATES: Record<string, number> = { GBP: 13, EUR: 11.5, USD: 10.5, SEK: 1 };
      const sekRate = SEK_RATES[currency] || 10.5;
      const priceSek = price !== null ? Math.round(price * sekRate) : null;

      const title = item.title || "";
      const affiliateUrl = item.itemWebUrl || null;
      const externalId = item.itemId || null;
      const category = guessCategory(title);
      const brand = extractBrand(title);

      // Fetch full item details once (description + condition + size aspects)
      const details = externalId
        ? await fetchEbayItemDetails(externalId, tokenResult.token)
        : null;

      const condition = mapCondition(
        details?.conditionStr ?? item.condition ?? null,
        details?.conditionId ?? item.conditionId ?? null,
      );

      const size = details?.size
        || extractSizeFromAspects(item.localizedAspects, item.itemSpecifics)
        || item.size
        || null;

      /* ── HARD REJECT rules ── */
      const hardFlags: string[] = [];
      if (!affiliateUrl) hardFlags.push("missing_affiliate_url");
      if (price === null || price === 0) hardFlags.push("missing_or_zero_price");
      if (images.length === 0) hardFlags.push("no_images");
      if (!title || title.length < 3) hardFlags.push("title_too_short");
      if (!category || !ANCORA_CATEGORIES.has(category)) hardFlags.push("unmapped_category");

      /* ── SOFT FLAG rules ── */
      const softFlags: string[] = [];
      if (images.length < 2) softFlags.push("fewer_than_2_images");
      if (!brand) softFlags.push("brand_undetected");
      if (!size) softFlags.push("size_missing");
      if (priceSek !== null && priceSek < 500) softFlags.push("price_below_500_sek");
      if (priceSek !== null && priceSek > 50000) softFlags.push("price_above_50000_sek");

      const isRejected = hardFlags.length > 0;
      const queueState = isRejected ? "rules_rejected" : "normalized";

      /* ── DUPLICATE CHECK (runs in dry-run too, before any writes) ── */
      if (externalId) {
        const { data: dupRaw } = await svc
          .from("intake_raw_listings")
          .select("id")
          .eq("external_id", externalId)
          .eq("source", "ebay")
          .limit(1)
          .maybeSingle();

        const { data: dupNorm } = !dupRaw
          ? await svc
              .from("intake_normalized_products")
              .select("id")
              .eq("external_id", externalId)
              .eq("source", "ebay")
              .limit(1)
              .maybeSingle()
          : { data: null };

        const { data: dupProd } = !dupRaw && !dupNorm && affiliateUrl
          ? await svc
              .from("products")
              .select("id")
              .eq("affiliate_url", affiliateUrl)
              .limit(1)
              .maybeSingle()
          : { data: null };

        if (dupRaw || dupNorm) {
          duplicatesSkipped++;
          results.push({
            external_id: externalId,
            title,
            queue_state: "duplicate_skipped",
            hard_flags: [],
            soft_flags: [],
            skipped: "duplicate_intake",
            price,
            raw_price: price,
            raw_currency: currency,
            converted_sek: priceSek,
            category,
            brand,
            image_count: images.length,
          });
          continue;
        }
        if (dupProd) {
          alreadyInProduction++;
          results.push({
            external_id: externalId,
            title,
            queue_state: "already_in_production",
            hard_flags: [],
            soft_flags: [],
            skipped: "already_in_production",
            price,
            raw_price: price,
            raw_currency: currency,
            converted_sek: priceSek,
            category,
            brand,
            image_count: images.length,
          });
          continue;
        }
      }

      const normalized = {
        source: "ebay",
        external_id: externalId,
        affiliate_url: affiliateUrl,
        title_raw: title,
        title_clean: title,
        description_raw: details?.description || stripHtml(item.shortDescription),
        brand,
        category,
        color: null,
        size,
        material: null,
        condition,
        price: priceSek,
        currency: "SEK",
        image_urls: images,
        availability_status: "available",
        current_queue_state: queueState,
      };

      const rawPayload = {
        itemId: externalId,
        title,
        price,
        currency,
        images,
        condition,
        affiliateUrl,
        conditionId: details?.conditionId ?? item.conditionId ?? null,
        conditionStr: details?.conditionStr ?? item.condition ?? null,
        size,
        shortDescription: item.shortDescription,
        seller: item.seller?.username,
        itemWebUrl: item.itemWebUrl,
        localizedAspects: details?.localizedAspects ?? item.localizedAspects,
      };

      if (!dryRun) {
        // Write raw listing
        const { data: rawRow } = await svc.from("intake_raw_listings").insert({
          source: "ebay",
          external_id: externalId,
          raw_payload: rawPayload,
          import_run_id: runId,
        }).select("id").single();

        // Write normalized product
        const { data: normRow } = await svc.from("intake_normalized_products").insert({
          ...normalized,
          raw_listing_id: rawRow?.id || null,
        }).select("id").single();

        // Write evaluation
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
        external_id: externalId,
        title,
        queue_state: queueState,
        hard_flags: hardFlags,
        soft_flags: softFlags,
        price,
        raw_price: price !== null ? parseFloat(item.price.value) : null,
        raw_currency: item.price?.currency || "USD",
        converted_sek: priceSek,
        category,
        brand,
        image_count: images.length,
      });

      processedCount++;
      if (isRejected) rejectedCount++;
    } catch (e: any) {
      console.error(`Error processing item ${i}:`, e.message);
      errorCount++;
    }
  }

  /* ════════════════════════════════════════ */
  /*  UPDATE RUN LOG                         */
  /* ════════════════════════════════════════ */

  const reviewCount = results.filter((r) => r.hard_flags.length === 0 && r.soft_flags.length > 0).length;
  const approvedCount = results.filter((r) => r.hard_flags.length === 0 && r.soft_flags.length === 0).length;

  // Build detailed summary
  const rejectedReasons = results
    .filter((r) => r.hard_flags.length > 0)
    .map((r) => ({ external_id: r.external_id, reasons: r.hard_flags }));

  const softFlagsSummary: Record<string, number> = {};
  for (const r of results) {
    for (const flag of r.soft_flags) {
      softFlagsSummary[flag] = (softFlagsSummary[flag] || 0) + 1;
    }
  }

  const categoriesSeen = [...new Set(results.map((r) => r.category).filter(Boolean))];

  await svc.from("intake_run_logs").update({
    status: rateLimited ? "failed" : "completed",
    completed_at: new Date().toISOString(),
    items_fetched: ebayItems.length,
    items_processed: processedCount,
    rules_rejected_count: rejectedCount,
    review_count: reviewCount,
    draft_approved_count: approvedCount,
    error_count: errorCount,
    rate_limit_count: rateLimitCount,
    summary: {
      dry_run: dryRun,
      selected_brands: selectedBrands,
      total_results: results.length,
      filtered_gender_count: filteredGenderCount,
      duplicates_skipped: duplicatesSkipped,
      already_in_production: alreadyInProduction,
      rejected_reasons: rejectedReasons,
      soft_flags_summary: softFlagsSummary,
      categories_seen: categoriesSeen,
      ...(dryRun ? {
        price_debug: results.slice(0, 5).map((r) => ({
          external_id: r.external_id,
          raw_price: r.raw_price,
          raw_currency: r.raw_currency,
          converted_sek: r.converted_sek,
        })),
      } : {}),
    },
  }).eq("id", runId);

  return jsonRes({
    run_id: runId,
    dry_run: dryRun,
    items_fetched: ebayItems.length,
    items_processed: processedCount,
    rules_rejected: rejectedCount,
    review: reviewCount,
    draft_approved: approvedCount,
    errors: errorCount,
    duplicates_skipped: duplicatesSkipped,
    already_in_production: alreadyInProduction,
    rate_limited: rateLimited,
    results,
  }, 200, cors);
});
