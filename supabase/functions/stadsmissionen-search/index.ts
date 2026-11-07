/**
 * Stadsmissionen Catalog API proxy (read-only).
 * Actions: "categories" | "search" | "item".
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
  if (!apiKey) return json({ error: "Stadsmissionen API key is not configured" }, 500);
  if (!rawHost) return json({ error: "Stadsmissionen host is not configured yet" }, 500);
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
  } else {
    return json({ error: "Unknown action" }, 400);
  }

  try {
    const res = await fetch(url, { headers: { "ssm-api-key": apiKey, Accept: "application/json" } });
    if (res.status === 404) return json({ error: "Product not found (may be sold)" }, 404);
    if (res.status === 403) return json({ error: "Stadsmissionen rejected the API key" }, 502);
    if (!res.ok) return json({ error: `Stadsmissionen API error ${res.status}` }, 502);
    return json(await res.json());
  } catch (err) {
    console.error("[stadsmissionen] fetch failed", err);
    return json({ error: "Could not reach Stadsmissionen" }, 502);
  }
});
