import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';

const TRADERA_CACHE_VERSION = 2;
const BATCH_SIZE = 50;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const isAllowed =
    origin === 'https://ancoraedit.lovable.app' ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// ── Normalization helpers (mirrors src/lib/traderaNormalization.ts) ──

const CONDITION_MAP: Array<{ match: (s: string) => boolean; en: string }> = [
  { match: (s) => /defekt|trasig/.test(s), en: "Poor" },
  { match: (s) => /acceptabelt skick|slitet|välanvänt/.test(s), en: "Fair" },
  { match: (s) => /mycket gott skick|mycket bra skick/.test(s), en: "Excellent" },
  { match: (s) => /nyskick|som ny/.test(s), en: "Like new" },
  { match: (s) => /gott skick|bra skick/.test(s), en: "Good" },
  { match: (s) => /oanvänd|ny med etikett/.test(s), en: "New" },
  { match: (s) => s === "ny" || s === "ny utan etikett", en: "New" },
  { match: (s) => /\bnew\b/.test(s), en: "New" },
  { match: (s) => /\bexcellent\b/.test(s), en: "Excellent" },
  { match: (s) => /\bgood\b/.test(s), en: "Good" },
  { match: (s) => /\bfair\b/.test(s), en: "Fair" },
  { match: (s) => /\blike new\b/.test(s), en: "Like new" },
  { match: (s) => /\bpoor\b/.test(s), en: "Poor" },
];

function normalizeCondition(sv?: string | null): { en: string | null; original: string | null } {
  if (!sv || !sv.trim()) return { en: null, original: null };
  const original = sv.trim();
  const lower = original.toLowerCase();
  for (const rule of CONDITION_MAP) {
    if (rule.match(lower)) return { en: rule.en, original };
  }
  return { en: "Good", original };
}

const MATERIAL_MAP: Record<string, string> = {
  ull: "Wool", kashmir: "Cashmere", cashmere: "Cashmere", bomull: "Cotton",
  linne: "Linen", silke: "Silk", skinn: "Leather", läder: "Leather",
  mocka: "Suede", polyester: "Polyester", viskos: "Viscose", nylon: "Nylon",
  akryl: "Acrylic", elastan: "Elastane", dun: "Down", fleece: "Fleece",
  syntet: "Synthetic",
};

const COLOR_MAP: Record<string, string> = {
  svart: "Black", vit: "White", grå: "Grey", beige: "Beige", brun: "Brown",
  blå: "Blue", marin: "Navy", marinblå: "Navy", röd: "Red", rosa: "Pink",
  grön: "Green", gul: "Yellow", lila: "Purple", orange: "Orange",
  silver: "Silver", guld: "Gold", flerfärgad: "Multicolor", mönstrad: "Multicolor",
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function splitTokens(text: string): string[] {
  return text.split(/[,\/&+]|\boch\b/i).map(t => t.trim()).filter(Boolean);
}

function normalizeMaterial(sv?: string | null): { en: string | null; original: string | null } {
  if (!sv || !sv.trim()) return { en: null, original: null };
  const original = sv.trim();
  const tokens = splitTokens(original);
  const mapped = tokens.map(t => MATERIAL_MAP[t.toLowerCase()] || titleCase(t));
  return { en: [...new Set(mapped)].join(", "), original };
}

function normalizeColor(sv?: string | null): { en: string | null; original: string | null } {
  if (!sv || !sv.trim()) return { en: null, original: null };
  const original = sv.trim();
  const tokens = splitTokens(original);
  const mapped = tokens.map(t => COLOR_MAP[t.toLowerCase()] || titleCase(t));
  return { en: [...new Set(mapped)].join(" / "), original };
}

function normalizeBrand(brand?: string | null): { cleaned: string | null; original: string | null } {
  if (!brand || !brand.trim()) return { cleaned: null, original: null };
  const original = brand.trim();
  const collapsed = original.replace(/\s+/g, " ");
  if (collapsed === collapsed.toLowerCase() || collapsed === collapsed.toUpperCase()) {
    const titled = collapsed.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    return { cleaned: titled, original };
  }
  return { cleaned: collapsed, original };
}

const SV_INDICATORS = new Set([
  "skick", "ull", "bomull", "läder", "svart", "vit", "grå", "blå", "röd",
  "rosa", "grön", "gul", "brun", "silke", "linne", "mocka", "begagnad",
  "oanvänd", "nyskick", "mönstrad", "flerfärgad", "marinblå", "viskos",
  "akryl", "elastan", "syntet", "kashmir", "mycket", "gott",
]);

function isLikelySwedish(text?: string | null): boolean {
  if (!text) return false;
  if (/[åäöÅÄÖ]/.test(text)) return true;
  const lower = text.toLowerCase();
  for (const word of SV_INDICATORS) {
    if (lower.includes(word)) return true;
  }
  return false;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Auth: admin or service role
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      const sc = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await sc.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!roleData) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  }

  // Parse body params
  let forceFresh = false;
  try {
    const body = await req.json();
    forceFresh = body?.forceFresh === true;
  } catch (_) {
    // No body or invalid JSON — defaults apply
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const appId = Deno.env.get('TRADERA_APP_ID');
  const appKey = Deno.env.get('TRADERA_APP_KEY');

  if (!appId || !appKey) {
    return new Response(JSON.stringify({ error: 'Tradera credentials not configured' }), { status: 500, headers: corsHeaders });
  }

  // Select Tradera products needing field updates:
  // NULL fields OR fields that look Swedish
  const { data: products, error: fetchErr } = await serviceClient
    .from('products')
    .select('id, tradera_item_id, condition, material, color, brand, condition_original, material_original, color_original, brand_original')
    .ilike('marketplace', 'tradera')
    .not('tradera_item_id', 'is', null)
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }

  // Filter to products that actually need updates
  const needsWork = (products || []).filter(p =>
    !p.condition || !p.material || !p.color || !p.brand ||
    isLikelySwedish(p.condition) || isLikelySwedish(p.material) ||
    isLikelySwedish(p.color) || isLikelySwedish(p.brand)
  );

  let processed = 0, updated_condition = 0, updated_material = 0, updated_color = 0, updated_brand = 0;
  let skipped_already_set = 0, rate_limited = 0, errors = 0;

  for (const product of needsWork) {
    processed++;

    const shouldUpdateField = (field: string | null): boolean =>
      !field || isLikelySwedish(field);

    const needsCondition = shouldUpdateField(product.condition);
    const needsMaterial = shouldUpdateField(product.material);
    const needsColor = shouldUpdateField(product.color);
    const needsBrand = shouldUpdateField(product.brand);

    if (!needsCondition && !needsMaterial && !needsColor && !needsBrand) {
      skipped_already_set++;
      continue;
    }

    let conditionRaw: string | null = null;
    let materialRaw: string | null = null;
    let colorRaw: string | null = null;
    let brandRaw: string | null = null;

    // Try cache first (unless forceFresh)
    if (!forceFresh) {
      const cacheKey = `item:${product.tradera_item_id}`;
      const { data: cached } = await serviceClient
        .from('tradera_cache')
        .select('raw_payload')
        .eq('cache_key', cacheKey)
        .eq('cache_version', TRADERA_CACHE_VERSION)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached?.raw_payload?.item) {
        const item = cached.raw_payload.item;
        conditionRaw = item.condition || null;
        materialRaw = item.material || null;
        colorRaw = item.attributes?.['term_102'] || null;
        brandRaw = item.brand || item.attributes?.['term_3'] || null;
      }
    }

    // If no cache hit or forceFresh, fetch from API
    if (forceFresh || (!conditionRaw && !materialRaw && !colorRaw && !brandRaw)) {
      // Check rate limit
      const { data: rlData } = await serviceClient.rpc('tradera_increment_usage', { daily_limit: 75 });
      if (rlData && !rlData.allowed) {
        rate_limited = needsWork.length - processed + 1;
        console.warn(`[backfill] Rate limit reached after ${processed} items`);
        break;
      }

      // Fetch item details via SOAP
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <AuthenticationHeader xmlns="http://api.tradera.com">
      <AppId>${appId}</AppId>
      <AppKey>${appKey}</AppKey>
    </AuthenticationHeader>
  </soap:Header>
  <soap:Body>
    <GetItem xmlns="http://api.tradera.com">
      <itemId>${product.tradera_item_id}</itemId>
    </GetItem>
  </soap:Body>
</soap:Envelope>`;

      try {
        const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://api.tradera.com/GetItem',
          },
          body: soapEnvelope,
        });

        if (response.status === 429) {
          rate_limited = needsWork.length - processed + 1;
          console.warn(`[backfill] 429 rate limited at item ${product.tradera_item_id}`);
          break;
        }

        if (!response.ok) {
          console.error(`[backfill] API error for ${product.tradera_item_id}: ${response.status}`);
          errors++;
          continue;
        }

        const xml = await response.text();

        // Parse TermAttributeValues
        const attributes: Record<string, string> = {};
        const termAttrSection = xml.match(/<TermAttributeValues>([\s\S]*?)<\/TermAttributeValues>/);
        if (termAttrSection) {
          const termAttrMatches = termAttrSection[1].match(/<TermAttributeValue>([\s\S]*?)<\/TermAttributeValue>/g);
          if (termAttrMatches) {
            for (const tav of termAttrMatches) {
              const attrId = (() => { const m = tav.match(/<Id[^>]*>(.*?)<\/Id>/s); return m ? m[1].trim() : null; })();
              const valuesSection = tav.match(/<Values>([\s\S]*?)<\/Values>/);
              const valueStrings = valuesSection
                ? (valuesSection[1].match(/<string>([^<]*)<\/string>/g) || []).map(s => s.replace(/<\/?string>/g, '').trim())
                : [];
              if (attrId && valueStrings.length > 0) {
                attributes[`term_${attrId}`] = valueStrings.join(', ');
              }
            }
          }
        }

        // Legacy fallback
        const attrMatches = xml.match(/<Attribute>([\s\S]*?)<\/Attribute>/g);
        if (attrMatches) {
          for (const attrXml of attrMatches) {
            const name = (() => { const m = attrXml.match(/<Name[^>]*>(.*?)<\/Name>/s); return m ? m[1].trim() : null; })();
            const value = (() => { const m = attrXml.match(/<Value[^>]*>(.*?)<\/Value>/s); return m ? m[1].trim() : null; })();
            if (name && value) attributes[name.toLowerCase()] = value;
          }
        }

        const extractText = (tag: string): string | undefined => {
          const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
          return match ? match[1].trim() : undefined;
        };

        conditionRaw = extractText('ItemCondition') || attributes['term_121'] || attributes['skick'] || attributes['condition'] || null;
        materialRaw = attributes['term_105'] || attributes['material'] || attributes['materiel'] || null;
        colorRaw = attributes['term_102'] || attributes['färg'] || attributes['color'] || null;
        brandRaw = extractText('Brand') || attributes['term_3'] || attributes['märke'] || attributes['brand'] || null;

        // Update cache with v2
        const cacheKey = `item:${product.tradera_item_id}`;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await serviceClient.from('tradera_cache').upsert({
          cache_key: cacheKey,
          cache_type: 'item',
          cache_version: TRADERA_CACHE_VERSION,
          raw_payload: {
            item: {
              condition: conditionRaw,
              material: materialRaw,
              brand: brandRaw,
              attributes,
            }
          },
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        }, { onConflict: 'cache_key' });
      } catch (err) {
        console.error(`[backfill] Exception fetching ${product.tradera_item_id}:`, err);
        errors++;
        continue;
      }
    }

    // Normalize and build patch
    const patch: Record<string, unknown> = {};

    if (needsCondition && conditionRaw) {
      const norm = normalizeCondition(conditionRaw);
      if (norm.en) { patch.condition = norm.en; patch.condition_original = norm.original; updated_condition++; }
    }
    if (needsMaterial && materialRaw) {
      const norm = normalizeMaterial(materialRaw);
      if (norm.en) { patch.material = norm.en; patch.material_original = norm.original; updated_material++; }
    }
    if (needsColor && colorRaw) {
      const norm = normalizeColor(colorRaw);
      if (norm.en) { patch.color = norm.en; patch.color_original = norm.original; updated_color++; }
    }
    if (needsBrand && brandRaw) {
      const norm = normalizeBrand(brandRaw);
      if (norm.cleaned) { patch.brand = norm.cleaned; patch.brand_original = norm.original; updated_brand++; }
    }

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await serviceClient.from('products').update(patch).eq('id', product.id);
      if (upErr) { console.error(`[backfill] Update failed for ${product.id}:`, upErr.message); errors++; }
    }
  }

  console.info(`[BackfillTraderaFields] forceFresh=${forceFresh} processed=${processed} condition=${updated_condition} material=${updated_material} color=${updated_color} brand=${updated_brand} skipped=${skipped_already_set} rate_limited=${rate_limited} errors=${errors}`);

  return new Response(JSON.stringify({
    processed,
    updated_condition,
    updated_material,
    updated_color,
    updated_brand,
    skipped_already_set,
    rate_limited,
    errors,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
