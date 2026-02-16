import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';

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

async function verifyAdmin(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (token === serviceRoleKey) {
    return { authorized: true, userId: 'service-role' };
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { authorized: true, userId: user.id };
}

const BATCH_LIMIT = 20;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find untranslated Tradera products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, name_original, description, description_original, brand, condition, marketplace')
      .eq('marketplace', 'tradera')
      .is('name_en', null)
      .limit(BATCH_LIMIT);

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: 'No untranslated products found', translated: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let translated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const product of products) {
      try {
        const nameToTranslate = product.name_original || product.name;
        const descToTranslate = product.description_original || product.description || '';

        const translateResponse = await fetch(`${supabaseUrl}/functions/v1/translate-swedish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            name: nameToTranslate,
            description: descToTranslate,
            condition: product.condition || '',
            brand: product.brand || '',
          }),
        });

        if (!translateResponse.ok) {
          console.error(`[Backfill] Translation failed for product ${product.id}: HTTP ${translateResponse.status}`);
          failed++;
          errors.push({ id: product.id, error: `HTTP ${translateResponse.status}` });
          continue;
        }

        const result = await translateResponse.json();

        const { error: updateError } = await supabase
          .from('products')
          .update({
            name_en: result.name || null,
            description_en: result.description || null,
            name_original: product.name_original || product.name,
            description_original: product.description_original || product.description || null,
            language: 'sv',
            translated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          console.error(`[Backfill] Update failed for product ${product.id}: ${updateError.message}`);
          failed++;
          errors.push({ id: product.id, error: updateError.message });
        } else {
          console.log(`[Backfill] Translated product ${product.id}`);
          translated++;
        }
      } catch (err) {
        console.error(`[Backfill] Error for product ${product.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
        failed++;
        errors.push({ id: product.id, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    return new Response(JSON.stringify({
      message: 'Backfill complete',
      total: products.length,
      translated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
