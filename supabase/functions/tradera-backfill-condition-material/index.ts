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

function mapConditionToText(raw?: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "oanvänd" || lower === "ny" || lower === "ny med etikett") return "New";
  if (lower === "ny utan etikett") return "New without tags";
  if (lower.includes("utmärkt") || lower.includes("mycket gott skick")) return "Excellent";
  if (lower === "begagnad" || lower.includes("gott skick") || lower.includes("bra skick")) return "Good";
  if (lower.includes("hyfsad") || lower.includes("ok skick")) return "Fair";
  if (lower.includes("new")) return "New";
  if (lower.includes("excellent")) return "Excellent";
  if (lower.includes("good")) return "Good";
  if (lower.includes("fair")) return "Fair";
  return raw;
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

  // Select Tradera products missing condition or material
  const { data: products, error: fetchErr } = await serviceClient
    .from('products')
    .select('id, tradera_item_id, condition, material')
    .ilike('marketplace', 'tradera')
    .not('tradera_item_id', 'is', null)
    .or('condition.is.null,material.is.null')
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }

  let processed = 0, updated_condition = 0, updated_material = 0, skipped_already_set = 0, rate_limited = 0, errors = 0;

  for (const product of products || []) {
    processed++;
    const needsCondition = !product.condition;
    const needsMaterial = !product.material;

    if (!needsCondition && !needsMaterial) {
      skipped_already_set++;
      continue;
    }

    let xml: string | null = null;

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
        // Use cached parsed item directly
        const item = cached.raw_payload.item;
        const patch: Record<string, unknown> = {};
        if (needsCondition && item.condition) {
          patch.condition = mapConditionToText(item.condition);
          updated_condition++;
        }
        if (needsMaterial && item.material) {
          patch.material = item.material;
          updated_material++;
        }
        if (Object.keys(patch).length > 0) {
          const { error: upErr } = await serviceClient.from('products').update(patch).eq('id', product.id);
          if (upErr) { console.error(`[backfill] Update failed for ${product.id}:`, upErr.message); errors++; }
        }
        continue;
      }
    }

    // Need fresh API call — check rate limit
    const { data: rlData } = await serviceClient.rpc('tradera_increment_usage', { daily_limit: 75 });
    if (rlData && !rlData.allowed) {
      rate_limited = (products || []).length - processed + 1;
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
        rate_limited = (products || []).length - processed + 1;
        console.warn(`[backfill] 429 rate limited at item ${product.tradera_item_id}`);
        break;
      }

      if (!response.ok) {
        console.error(`[backfill] API error for ${product.tradera_item_id}: ${response.status}`);
        errors++;
        continue;
      }

      xml = await response.text();

      // If forceFresh, update cache with new version
      if (forceFresh) {
        const cacheKey = `item:${product.tradera_item_id}`;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        // We store the raw result after parsing below — but first parse attributes from xml
      }
    } catch (err) {
      console.error(`[backfill] Exception fetching ${product.tradera_item_id}:`, err);
      errors++;
      continue;
    }

    if (!xml) continue;

    // Parse condition and material from XML
    const extractText = (tag: string): string | undefined => {
      const match = xml!.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
      return match ? match[1].trim() : undefined;
    };

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

    const conditionRaw = extractText('ItemCondition') || attributes['term_121'] || attributes['skick'] || attributes['condition'] || null;
    const materialRaw = attributes['term_105'] || attributes['material'] || attributes['materiel'] || null;

    const patch: Record<string, unknown> = {};

    if (needsCondition && conditionRaw) {
      patch.condition = mapConditionToText(conditionRaw);
      updated_condition++;
    }
    if (needsMaterial && materialRaw) {
      patch.material = materialRaw;
      updated_material++;
    }

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await serviceClient.from('products').update(patch).eq('id', product.id);
      if (upErr) { console.error(`[backfill] Update failed for ${product.id}:`, upErr.message); errors++; }
    }

    // Update cache with v2 after fresh fetch
    if (forceFresh) {
      const cacheKey = `item:${product.tradera_item_id}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await serviceClient.from('tradera_cache').upsert({
        cache_key: cacheKey,
        cache_type: 'item',
        cache_version: TRADERA_CACHE_VERSION,
        raw_payload: { item: { condition: conditionRaw, material: materialRaw, attributes } },
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'cache_key' });
    }
  }

  console.info(`[tradera-backfill] forceFresh=${forceFresh} processed=${processed} condition=${updated_condition} material=${updated_material} skipped=${skipped_already_set} rate_limited=${rate_limited} errors=${errors}`);

  return new Response(JSON.stringify({
    processed,
    updated_condition,
    updated_material,
    skipped_already_set,
    rate_limited,
    errors,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
