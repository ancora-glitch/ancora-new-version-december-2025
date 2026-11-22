import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import {
  cleanProductName,
  cleanProductSize,
  englishColor,
  englishCondition,
  englishMaterial,
  isStockholmMondayEight,
  matchedBrand,
  matchesColor,
  matchesMaterial,
  normalizeText,
  ssmShopUrlCandidates,
} from "./rules.ts";

const CONFIG_TABLE = "stadsmissionen_auto_import_configs";
const MARKETPLACE = "stadsmissionen";
const MAX_PAGES_PER_BRAND = 5;
const RequestSchema = z.object({
  trigger: z.enum(["manual", "scheduled"]).default("manual"),
  targetCount: z.number().int().min(1).max(50).optional(),
});

interface Config {
  id: string;
  brands: string[];
  materials: string[];
  colors: string[];
  target_count: number;
  active: boolean;
}

interface SsmCategory { id: string; name: string; parent: string | null }
interface SsmListItem { id: string; title: string }
interface SsmProduct {
  id: string;
  sku: string | null;
  type: string;
  title: string;
  price: { amount: string; currency: string } | null;
  category: { id: string; name: string }[];
  condition: string | null;
  description: string | null;
  details: string | null;
  attributes: Record<string, any>;
  images: { url: string; alt: string | null }[];
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/(?:&#0?39;|&apos;)/gi, "'")
    .replace(/<[^>]+>/g, " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let parsedBody: z.infer<typeof RequestSchema>;
  try {
    parsedBody = RequestSchema.parse(await req.json());
  } catch {
    return json({ error: "Invalid request. trigger must be manual or scheduled; targetCount must be 1–50." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  if (parsedBody.trigger === "scheduled") {
    const failure = authenticateCronRequest(req);
    if (failure) return json({ error: "Unauthorized scheduled request" }, failure.status);
    if (!isStockholmMondayEight(new Date())) {
      return json({ data: { status: "skipped", reason: "Outside Monday 08:00 Europe/Stockholm" } });
    }
  } else {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);
  }

  const service = createClient(supabaseUrl, serviceRoleKey);
  const { data: config, error: configError } = await service
    .from(CONFIG_TABLE)
    .select("id, brands, materials, colors, target_count, active")
    .eq("config_key", "default")
    .maybeSingle();
  if (configError || !config) return json({ error: "Auto-import is not configured" }, 400);
  const typedConfig = config as Config;
  if (parsedBody.trigger === "scheduled" && !typedConfig.active) {
    return json({ data: { status: "skipped", reason: "Auto-import is paused" } });
  }

  const brands = typedConfig.brands.map((brand) => brand.trim()).filter(Boolean);
  if (brands.length === 0) return json({ error: "Add at least one brand before running the import" }, 400);

  const lockStartedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const { data: lock } = await service
    .from(CONFIG_TABLE)
    .update({ running_started_at: lockStartedAt })
    .eq("id", typedConfig.id)
    .or(`running_started_at.is.null,running_started_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();
  if (!lock) return json({ error: "An import is already running" }, 409);

  const targetCount = parsedBody.trigger === "manual" && parsedBody.targetCount
    ? parsedBody.targetCount
    : typedConfig.target_count;
  const summary: Record<string, unknown> = {
    status: "running",
    targetCount,
    inspected: 0,
    imported: 0,
    duplicates: 0,
    filtered: 0,
    failed: 0,
    perBrand: {},
    products: [] as { id: string; slug: string; name: string; brand: string }[],
  };
  let locked = true;

  const finish = async (status: string) => {
    summary.status = status;
    await service.from(CONFIG_TABLE).update({
      running_started_at: null,
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_summary: summary,
    }).eq("id", typedConfig.id);
    locked = false;
  };

  try {
    const apiKey = Deno.env.get("STADSMISSIONEN_API_KEY");
    const rawHost = Deno.env.get("STADSMISSIONEN_HOST");
    if (!apiKey || !rawHost) throw new Error("Stadsmissionen API configuration is missing");
    const host = rawHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const apiBase = `https://${host}/api/v1`;

    const apiFetch = async (path: string) => {
      const response = await fetch(`${apiBase}${path}`, {
        headers: { "ssm-api-key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`Stadsmissionen API error ${response.status}`);
      return await response.json();
    };

    const categoryPayload = await apiFetch("/categories");
    const categories = (categoryPayload.data || []) as SsmCategory[];
    const byId = new Map(categories.map((category) => [category.id, category]));
    const roots = categories.filter((category) => category.name === "Dam" || category.name === "Herr");
    const clothingIds = new Set<string>();
    const segmentByCategory = new Map<string, "womenswear" | "menswear">();
    for (const category of categories) {
      let current: SsmCategory | undefined = category;
      while (current?.parent) current = byId.get(current.parent);
      const root = roots.find((candidate) => candidate.id === current?.id);
      if (root) {
        clothingIds.add(category.id);
        segmentByCategory.set(category.id, root.name === "Herr" ? "menswear" : "womenswear");
      }
    }

    const [{ data: existingProducts }, { data: existingImports }] = await Promise.all([
      service.from("products").select("affiliate_url, name_original").eq("marketplace", MARKETPLACE),
      service.from("ancora_import_items").select("source_ref").eq("marketplace", MARKETPLACE),
    ]);
    const existingUrls = new Set((existingProducts || []).map((product) => product.affiliate_url).filter(Boolean));
    const existingTitles = new Set((existingProducts || []).map((product) => normalizeText(product.name_original)).filter(Boolean));
    const seenSourceIds = new Set((existingImports || []).map((item) => item.source_ref).filter(Boolean));
    const perBrand: Record<string, number> = {};
    summary.perBrand = perBrand;
    const products = summary.products as { id: string; slug: string; name: string; brand: string }[];

    const resolveShopUrl = async (title: string): Promise<string | null> => {
      for (const candidate of ssmShopUrlCandidates(title)) {
        try {
          const response = await fetch(candidate, {
            headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; AncoraLinkCheck/1.0)" },
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) continue;
          const html = await response.text();
          const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
          if (normalizeText(decodeHtml(h1)) === normalizeText(title)) return candidate;
        } catch { /* Try the next Pathauto collision variant. */ }
      }
      return null;
    };

    const translate = async (product: SsmProduct, description: string, material: string | null, size: string | null, brand: string) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/translate-swedish`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: product.title,
            description,
            condition: product.condition || "",
            material: material || "",
            size: size || "",
            brand,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };

    const uniqueSlug = async (name: string): Promise<string> => {
      const base = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "product";
      for (let suffix = 0; suffix < 100; suffix++) {
        const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
        const { data } = await service.from("products").select("id").eq("slug", candidate).maybeSingle();
        if (!data) return candidate;
      }
      throw new Error("Could not create a unique product slug");
    };

    outer: for (const configuredBrand of brands) {
      perBrand[configuredBrand] = 0;
      for (let page = 1; page <= MAX_PAGES_PER_BRAND; page++) {
        const searchPayload = await apiFetch(`/products?search=${encodeURIComponent(configuredBrand)}&page=${page}&limit=50`);
        const items = (searchPayload.data || []) as SsmListItem[];
        if (items.length === 0) break;

        for (const item of items) {
          if ((summary.imported as number) >= targetCount) break outer;
          if (seenSourceIds.has(item.id)) {
            summary.duplicates = (summary.duplicates as number) + 1;
            continue;
          }
          summary.inspected = (summary.inspected as number) + 1;
          try {
            const detailPayload = await apiFetch(`/products/${item.id}`);
            const product = detailPayload.data as SsmProduct;
            if (!product) {
              summary.failed = (summary.failed as number) + 1;
              continue;
            }
            if (existingTitles.has(normalizeText(product.title))) {
              summary.duplicates = (summary.duplicates as number) + 1;
              seenSourceIds.add(item.id);
              continue;
            }
            const candidates = ssmShopUrlCandidates(product.title);
            if (candidates.some((candidate) => existingUrls.has(candidate))) {
              summary.duplicates = (summary.duplicates as number) + 1;
              seenSourceIds.add(item.id);
              continue;
            }
            if (!product.category?.some((category) => clothingIds.has(category.id))) {
              summary.filtered = (summary.filtered as number) + 1;
              continue;
            }
            const attributes = product.attributes || {};
            const apiBrand = typeof attributes.brand === "string" ? attributes.brand : null;
            const brand = matchedBrand(product.title, apiBrand, brands);
            if (!brand) {
              summary.filtered = (summary.filtered as number) + 1;
              continue;
            }
            const material = attributes.material_text || (Array.isArray(attributes.material) ? attributes.material.join(", ") : null);
            const color = typeof attributes.color === "string" ? attributes.color : null;
            if (!matchesMaterial(material, typedConfig.materials) || !matchesColor(color, typedConfig.colors)) {
              summary.filtered = (summary.filtered as number) + 1;
              continue;
            }
            const images = [...new Set((product.images || []).map((image) => image.url).filter(Boolean))];
            if (images.length === 0) {
              summary.filtered = (summary.filtered as number) + 1;
              continue;
            }
            const shopUrl = await resolveShopUrl(product.title);
            if (!shopUrl) {
              summary.failed = (summary.failed as number) + 1;
              continue;
            }
            const size = Array.isArray(attributes.size) && attributes.size.length ? attributes.size.join(", ") : null;
            const description = [product.description, product.details].filter(Boolean).join("\n\n") || product.title;
            const translation = await translate(product, description, material, size, brand);
            const displayName = cleanProductName(translation?.name || product.title, brand);
            const slug = await uniqueSlug(displayName);
            const price = product.price ? Number.parseFloat(product.price.amount) : null;
            const translatedAt = translation ? new Date().toISOString() : null;
            const productCategory = product.category.find((category) => clothingIds.has(category.id));
            const productData = {
              brand,
              brand_original: apiBrand,
              name: displayName,
              name_original: product.title,
              name_en: translation?.name ? cleanProductName(translation.name, brand) : null,
              price: price != null && Number.isFinite(price) ? `${price} ${product.price?.currency || "SEK"}` : "0",
              image: images[0],
              additional_images: images.slice(1),
              description: translation?.description || description,
              description_original: description,
              description_en: translation?.description || null,
              language: "other",
              translated_at: translatedAt,
              condition: englishCondition(translation?.condition || product.condition) || null,
              condition_original: product.condition,
              material: englishMaterial(translation?.material || material) || null,
              material_original: material,
              color: englishColor(color) || null,
              color_original: color,
              size: cleanProductSize(size) || null,
              status: "draft",
              slug,
              marketplace: MARKETPLACE,
              category_id: null,
              ancora_select_source: null,
              affiliate_url: shopUrl,
              tradera_item_id: null,
              segment: productCategory ? segmentByCategory.get(productCategory.id) || "womenswear" : "womenswear",
              in_weekly_edit: false,
              affiliate_status: "unknown",
              affiliate_auto_handling: false,
            };
            const { data: inserted, error: insertError } = await service.from("products").insert(productData).select("id").single();
            if (insertError || !inserted) throw new Error(insertError?.message || "Could not save draft product");

            const { error: logError } = await service.from("ancora_import_items").insert({
              source_type: "other",
              source_ref: product.id,
              source_url: shopUrl,
              affiliate_url: shopUrl,
              title: cleanProductName(product.title, brand),
              title_original: product.title,
              title_en: translation?.name ? cleanProductName(translation.name, brand) : null,
              description,
              description_original: description,
              description_en: translation?.description || null,
              language: "other",
              translated_at: translatedAt,
              images,
              price,
              currency: product.price?.currency || "SEK",
              condition: "unknown",
              provenance: "Stockholms Stadsmission",
              signals: { sku: product.sku, type: product.type, categories: product.category.map((category) => category.name), auto_import: true },
              status: "promoted",
              product_id: inserted.id,
              promoted_at: new Date().toISOString(),
              brand_text: brand,
              size_text: cleanProductSize(size) || null,
              color_text: englishColor(color) || null,
              material_text: englishMaterial(translation?.material || material) || null,
              condition_text: englishCondition(translation?.condition || product.condition) || null,
              primary_image: images[0],
              marketplace: MARKETPLACE,
              category_id: null,
            });
            if (logError) console.error("[stadsmissionen-auto-import] import log failed", logError.message);

            seenSourceIds.add(product.id);
            existingTitles.add(normalizeText(product.title));
            existingUrls.add(shopUrl);
            summary.imported = (summary.imported as number) + 1;
            perBrand[configuredBrand] = (perBrand[configuredBrand] || 0) + 1;
            products.push({ id: inserted.id, slug, name: displayName, brand });
          } catch (error) {
            summary.failed = (summary.failed as number) + 1;
            console.error("[stadsmissionen-auto-import] item failed", item.id, error);
          }
        }
        const totalPages = Number(searchPayload.meta?.pages || page);
        if (page >= totalPages) break;
      }
    }

    const imported = summary.imported as number;
    const status = imported === targetCount ? "success" : imported > 0 ? "partial" : "no_matches";
    await finish(status);
    return json({ data: summary });
  } catch (error) {
    console.error("[stadsmissionen-auto-import] run failed", error);
    summary.status = "error";
    summary.error = error instanceof Error ? error.message : "Unknown error";
    if (locked) {
      await service.from(CONFIG_TABLE).update({
        running_started_at: null,
        last_run_at: new Date().toISOString(),
        last_run_status: "error",
        last_run_summary: summary,
      }).eq("id", typedConfig.id);
    }
    return json({ error: summary.error, data: summary }, 500);
  }
});
