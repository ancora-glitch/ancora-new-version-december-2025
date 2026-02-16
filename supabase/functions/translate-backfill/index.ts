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

// ── Language heuristic ──

const SWEDISH_STOPWORDS = ['och', 'det', 'som', 'är', 'en', 'ett', 'att', 'för', 'med', 'har', 'den', 'av', 'inte', 'var', 'kan', 'till', 'på', 'om'];

function isLikelyEnglish(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  // Check for åäö characters
  if (/[åäöÅÄÖ]/.test(combined)) return false;
  // Check ratio of A-Z to total letters
  const letters = combined.replace(/[^a-zà-ÿ]/gi, '');
  if (letters.length === 0) return false;
  const azLetters = combined.replace(/[^a-z]/gi, '');
  const ratio = azLetters.length / letters.length;
  if (ratio <= 0.8) return false;
  // Count Swedish stopwords
  const words = combined.split(/\s+/);
  let swCount = 0;
  for (const w of words) {
    if (SWEDISH_STOPWORDS.includes(w)) swCount++;
  }
  if (swCount >= 2) return false;
  return true;
}

// ── Budget helpers ──

const MAX_ITEMS_PER_DAY = 200;
const MAX_CHARS_PER_DAY = 200000;

interface BudgetResult {
  allowed: boolean;
  items_used: number;
  chars_used: number;
  items_max: number;
  chars_max: number;
}

async function checkAndIncrementBudget(supabase: any, charEstimate: number): Promise<BudgetResult> {
  const today = new Date().toISOString().slice(0, 10);

  // Upsert today's row
  const { data: row } = await supabase
    .from('translation_usage')
    .select('items_used, chars_used')
    .eq('day_utc', today)
    .maybeSingle();

  const currentItems = row?.items_used ?? 0;
  const currentChars = row?.chars_used ?? 0;

  if (currentItems >= MAX_ITEMS_PER_DAY || currentChars + charEstimate > MAX_CHARS_PER_DAY) {
    return { allowed: false, items_used: currentItems, chars_used: currentChars, items_max: MAX_ITEMS_PER_DAY, chars_max: MAX_CHARS_PER_DAY };
  }

  // Increment
  await supabase
    .from('translation_usage')
    .upsert({
      day_utc: today,
      items_used: currentItems + 1,
      chars_used: currentChars + charEstimate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'day_utc' });

  return { allowed: true, items_used: currentItems + 1, chars_used: currentChars + charEstimate, items_max: MAX_ITEMS_PER_DAY, chars_max: MAX_CHARS_PER_DAY };
}

// ── Main handler ──

const BATCH_LIMIT = 20;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  const startedAt = new Date();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Concurrency-safe selection: only pick rows where translated_at IS NULL
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, name_original, description, description_original, brand, condition, marketplace, translated_at, name_en, description_en')
      .eq('marketplace', 'tradera')
      .is('translated_at', null)
      .or('name_en.is.null,description_en.is.null')
      .limit(BATCH_LIMIT);

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({
        message: 'No untranslated products found',
        processed: 0, translated: 0, skipped_already_english: 0, skipped_budget: 0, failed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let translated = 0;
    let skippedAlreadyEnglish = 0;
    let skippedBudget = 0;
    let failed = 0;

    for (const product of products) {
      const nameToTranslate = product.name_original || product.name;
      const descToTranslate = product.description_original || product.description || '';

      // 1. Skip if already English
      if (isLikelyEnglish(nameToTranslate, descToTranslate)) {
        console.log(`[Translation] Skipped (already EN): product ${product.id}`);
        // Re-check translated_at is still null before updating
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            name_en: nameToTranslate,
            description_en: descToTranslate || null,
            name_original: nameToTranslate,
            description_original: descToTranslate || null,
            language: 'en',
            translated_at: new Date().toISOString(),
          })
          .eq('id', product.id)
          .is('translated_at', null);
        if (!updateErr) skippedAlreadyEnglish++;
        else failed++;
        continue;
      }

      // 2. Check budget
      const charEstimate = (nameToTranslate + descToTranslate).length;
      const budget = await checkAndIncrementBudget(supabase, charEstimate);
      if (!budget.allowed) {
        console.warn(`[Translation] Budget exceeded, skipping product ${product.id}`);
        // Store original as fallback
        await supabase
          .from('products')
          .update({
            name_en: nameToTranslate,
            description_en: descToTranslate || null,
            name_original: nameToTranslate,
            description_original: descToTranslate || null,
            language: 'sv',
            translated_at: new Date().toISOString(),
          })
          .eq('id', product.id)
          .is('translated_at', null);
        skippedBudget++;
        continue;
      }

      // 3. Translate
      try {
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
          continue;
        }

        const result = await translateResponse.json();

        // Concurrency guard: only update if translated_at is still null
        const { error: updateError, count } = await supabase
          .from('products')
          .update({
            name_en: result.name || null,
            description_en: result.description || null,
            name_original: product.name_original || product.name,
            description_original: product.description_original || product.description || null,
            language: 'sv',
            translated_at: new Date().toISOString(),
          })
          .eq('id', product.id)
          .is('translated_at', null);

        if (updateError) {
          console.error(`[Backfill] Update failed for product ${product.id}: ${updateError.message}`);
          failed++;
        } else {
          console.log(`[Backfill] Translated product ${product.id}`);
          translated++;
        }
      } catch (err) {
        console.error(`[Backfill] Error for product ${product.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
        failed++;
      }
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    // Log cron run
    try {
      await supabase.from('cron_runs').insert({
        job_name: 'translate_backfill',
        status: failed > 0 && translated === 0 ? 'error' : 'success',
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        items_processed: products.length,
        checked_count: products.length,
        sold_marked: translated,
      });
    } catch (_) { /* non-blocking */ }

    return new Response(JSON.stringify({
      message: 'Backfill complete',
      processed: products.length,
      translated,
      skipped_already_english: skippedAlreadyEnglish,
      skipped_budget: skippedBudget,
      failed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
