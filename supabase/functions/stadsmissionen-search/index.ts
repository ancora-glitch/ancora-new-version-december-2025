/**
 * Stadsmissionen Catalog API proxy (read-only).
 * Actions: "categories" | "search" | "item" | "validateShopUrl".
 * The API key (STADSMISSIONEN_API_KEY) stays server-side and is sent as the
 * `ssm-api-key` header. Host comes from STADSMISSIONEN_HOST.
 * Manual curation only — no cron, no background polling.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Require a signed-in admin
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const apiKey = Deno.env.get("STADSMISSIONEN_API_KEY");
  const rawHost = Deno.env.get("STADSMISSIONEN_HOST");
  // Missing config is an expected setup state, not a server failure → 200 with notConfigured flag.
  if (!apiKey) return json({ notConfigured: true, error: "Stadsmissionen API key is not configured" }, 200);
  if (!rawHost) return json({ notConfigured: true, error: "Stadsmissionen server address is not configured yet. Search will work once it is added." }, 200);
  const host = rawHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const base = `https://${host}/api/v1`;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const action = body?.action;

  let url: string;
  let shopValidationTitle = "";
  if (action === "categories") {
    url = `${base}/categories`;
  } else if (action === "search") {
    const params = new URLSearchParams();
    const search = typeof body.search === "string" ? body.search.trim().slice(0, 100) : "";
    if (search) params.set("search", search);
    if (typeof body.category === "string" && UUID_RE.test(body.category)) params.set("category", body.category);
    const page = Number.isInteger(body.page) && body.page > 0 ? body.page : 1;
    const limit = Number.isInteger(body.limit) ? Math.min(Math.max(body.limit, 1), 50) : 20;
    params.set("page", String(page));
    params.set("limit", String(limit));
    url = `${base}/products?${params}`;
  } else if (action === "item") {
    if (typeof body.id !== "string" || !UUID_RE.test(body.id)) return json({ error: "Invalid id" }, 400);
    url = `${base}/products/${body.id}`;
  } else if (action === "validateShopUrl") {
    if (typeof body.url !== "string" || typeof body.title !== "string") {
      return json({ error: "A shop URL and original product title are required" }, 400);
    }
    let candidate: URL;
    try {
      candidate = new URL(body.url);
    } catch {
      return json({ error: "Invalid shop URL" }, 400);
    }
    const validHost = candidate.hostname === "www.stadsmissionen.se" || candidate.hostname === "stadsmissionen.se";
    if (candidate.protocol !== "https:" || !validHost || !candidate.pathname.startsWith("/shop/produkt/")) {
      return json({ error: "Shop URL is outside Stadsmissionen's product pages" }, 400);
    }
    url = candidate.toString();
    shopValidationTitle = body.title.trim().slice(0, 300);
  } else {
    return json({ error: "Unknown action" }, 400);
  }

  try {
    const res = await fetch(url, {
      headers: shopValidationTitle
        ? { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; AncoraLinkCheck/1.0)" }
        : { "ssm-api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (shopValidationTitle) {
      const html = await res.text();
      const decode = (value: string) => value
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/(?:&#0?39;|&apos;)/gi, "'")
        .replace(/<[^>]+>/g, " ");
      const normalize = (value: string) => decode(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
      const valid = res.ok && normalize(h1) === normalize(shopValidationTitle);
      return json({ data: { valid, status: res.status } });
    }
    if (res.status === 404) return json({ error: "Product not found (may be sold)" }, 404);
    if (res.status === 403) return json({ error: "Stadsmissionen rejected the API key" }, 502);
    if (!res.ok) return json({ error: `Stadsmissionen API error ${res.status}` }, 502);
    return json(await res.json());
  } catch (err) {
    console.error("[stadsmissionen] fetch failed", err);
    return json({ error: "Could not reach Stadsmissionen" }, 502);
  }
});
