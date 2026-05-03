import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isAllowed =
    origin === "https://ancoraedit.lovable.app" ||
    origin === "https://ancoraedit.com" ||
    origin === "https://www.ancoraedit.com" ||
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

async function verifyAdmin(req: Request, cors: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false as const, response: jsonRes({ success: false, error: "Unauthorized" }, 401, cors) };
  }
  const token = authHeader.replace("Bearer ", "");
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token === srk) return { authorized: true as const };

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) {
    return { authorized: false as const, response: jsonRes({ success: false, error: "Unauthorized" }, 401, cors) };
  }
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, srk);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles || []).some((r: any) => r.role === "admin");
  if (!isAdmin) {
    return { authorized: false as const, response: jsonRes({ success: false, error: "Forbidden" }, 403, cors) };
  }
  return { authorized: true as const };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Guard rails
  const v1Enabled = Deno.env.get("INTAKE_V1_ENABLED") ?? Deno.env.get("VITE_INTAKE_V1_ENABLED");
  const killSwitch = Deno.env.get("INTAKE_KILL_SWITCH") ?? Deno.env.get("VITE_INTAKE_KILL_SWITCH");
  if (v1Enabled !== "true" || killSwitch === "true") {
    return jsonRes({ success: false, error: "Intake disabled" }, 403, cors);
  }

  const auth = await verifyAdmin(req, cors);
  if (!auth.authorized) return auth.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ success: false, error: "Invalid JSON" }, 400, cors);
  }
  const normalized_product_id = body?.normalized_product_id;
  if (typeof normalized_product_id !== "string" || normalized_product_id.length < 8) {
    return jsonRes({ success: false, error: "normalized_product_id required" }, 400, cors);
  }

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1. Fetch normalized product
  const { data: intake, error: intakeErr } = await svc
    .from("intake_normalized_products")
    .select("*")
    .eq("id", normalized_product_id)
    .maybeSingle();
  if (intakeErr) return jsonRes({ success: false, error: intakeErr.message }, 500, cors);
  if (!intake) return jsonRes({ success: false, error: "Intake product not found" }, 404, cors);

  // 2. Fetch evaluation (context only)
  await svc
    .from("intake_evaluations")
    .select("id")
    .eq("normalized_product_id", normalized_product_id)
    .limit(1)
    .maybeSingle();

  // 3. Duplicate guard
  if (intake.affiliate_url) {
    const { data: existing } = await svc
      .from("products")
      .select("id")
      .eq("affiliate_url", intake.affiliate_url)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return jsonRes({ success: false, error: "Product already exists in production" }, 409, cors);
    }
  }

  // 4. Map fields
  const images: string[] = Array.isArray(intake.image_urls)
    ? (intake.image_urls as unknown[]).filter((u): u is string => typeof u === "string")
    : [];
  const heroImage = images[0] ?? "/placeholder.svg";
  const additionalImages = images.slice(1);

  const title = intake.title_clean || intake.title_raw || "Untitled";
  const priceText =
    intake.price != null ? `${intake.price} ${intake.currency ?? "SEK"}` : "";

  let categoryId: string | null = null;
  if (intake.category) {
    const { data: cat } = await svc
      .from("categories")
      .select("id")
      .ilike("name", intake.category)
      .limit(1)
      .maybeSingle();
    if (cat) categoryId = cat.id;
  }

  const insertRow: Record<string, unknown> = {
    brand: intake.brand ?? "Unknown",
    name: title,
    name_en: intake.title_clean ?? null,
    name_original: intake.title_raw ?? null,
    description: intake.description_raw ?? null,
    description_en: intake.description_raw ?? null,
    price: priceText,
    size: intake.size ?? null,
    color: intake.color ?? null,
    material: intake.material ?? null,
    condition: intake.condition ?? null,
    affiliate_url: intake.affiliate_url ?? null,
    marketplace: intake.source ?? null,
    image: heroImage,
    additional_images: additionalImages,
    status: "draft",
    subcategory: intake.subcategory ?? null,
    category_id: categoryId,
  };

  // 5. Insert
  const { data: inserted, error: insertErr } = await svc
    .from("products")
    .insert(insertRow)
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return jsonRes({ success: false, error: insertErr?.message ?? "Insert failed" }, 500, cors);
  }

  // 6. Update intake state
  const { error: updateErr } = await svc
    .from("intake_normalized_products")
    .update({
      current_queue_state: "test_approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalized_product_id);

  const payload: Record<string, unknown> = {
    success: true,
    product_id: inserted.id,
    message: "Draft created",
  };
  if (updateErr) payload.warning = `Product created but intake state not updated: ${updateErr.message}`;

  return jsonRes(payload, 200, cors);
});
