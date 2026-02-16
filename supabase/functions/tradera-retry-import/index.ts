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

async function verifyAdminOrServiceRole(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
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
  const userId = user.id;
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { authorized: true, userId };
}

// ── Language heuristic ──

const SWEDISH_STOPWORDS = ['och', 'det', 'som', 'är', 'en', 'ett', 'att', 'för', 'med', 'har', 'den', 'av', 'inte', 'var', 'kan', 'till', 'på', 'om'];

function isLikelyEnglish(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  if (/[åäöÅÄÖ]/.test(combined)) return false;
  const letters = combined.replace(/[^a-zà-ÿ]/gi, '');
  if (letters.length === 0) return false;
  const azLetters = combined.replace(/[^a-z]/gi, '');
  const ratio = azLetters.length / letters.length;
  if (ratio <= 0.8) return false;
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

async function checkAndIncrementBudget(supabase: any, charEstimate: number): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: row } = await supabase
    .from('translation_usage')
    .select('items_used, chars_used')
    .eq('day_utc', today)
    .maybeSingle();

  const currentItems = row?.items_used ?? 0;
  const currentChars = row?.chars_used ?? 0;

  if (currentItems >= MAX_ITEMS_PER_DAY || currentChars + charEstimate > MAX_CHARS_PER_DAY) {
    return false;
  }

  await supabase
    .from('translation_usage')
    .upsert({
      day_utc: today,
      items_used: currentItems + 1,
      chars_used: currentChars + charEstimate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'day_utc' });

  return true;
}

// ── Shared helpers ──

async function runRetention(supabase: any) {
  try {
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { count } = await supabase
      .from('cron_runs')
      .delete()
      .lt('ran_at', cutoff)
      .select('id', { count: 'exact', head: true });
    if (count && count > 0) {
      console.log(`[retention] Deleted ${count} cron_runs older than 14 days`);
    }
  } catch (_) { /* never block */ }
}

async function logCronRun(supabase: any, payload: {
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  items_processed: number;
  checked_count: number;
  sold_marked: number;
  error_message?: string | null;
}) {
  try {
    await supabase.from('cron_runs').insert({
      job_name: payload.job_name,
      status: payload.status,
      started_at: payload.started_at,
      finished_at: payload.finished_at,
      duration_ms: payload.duration_ms,
      items_processed: payload.items_processed ?? 0,
      checked_count: payload.checked_count ?? 0,
      sold_marked: payload.sold_marked ?? 0,
      error_message: payload.error_message ?? null,
    });
  } catch (_) { /* non-blocking */ }
}

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30 * 60 * 1000;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  const startedAt = new Date();
  const _startTime = startedAt.getTime();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retention cleanup
    await runRetention(supabase);

    const { data: pendingJobs, error: fetchError } = await supabase
      .from('tradera_retry_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('retry_after', new Date().toISOString())
      .order('retry_after', { ascending: true })
      .limit(3);

    if (fetchError) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'tradera_retry_import', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0,
        error_message: fetchError.message,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to fetch retry jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'tradera_retry_import', status: 'success',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0,
      });
      return new Response(
        JSON.stringify({ message: 'No pending retry jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ id: string; source_ref: string; result: string }> = [];

    for (const job of pendingJobs) {
      const attempt = job.attempt_count + 1;

      if (attempt > MAX_ATTEMPTS) {
        await supabase
          .from('tradera_retry_jobs')
          .update({ status: 'failed', last_error: `Exceeded max attempts (${MAX_ATTEMPTS})`, attempt_count: attempt })
          .eq('id', job.id);
        results.push({ id: job.id, source_ref: job.source_ref, result: 'max_attempts_exceeded' });
        continue;
      }

      try {
        const itemResponse = await fetch(`${supabaseUrl}/functions/v1/tradera-item`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ itemId: parseInt(job.source_ref) }),
        });

        const itemData = await itemResponse.json();

        if (itemData.rateLimited) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          const nextRetry = new Date(Date.now() + backoffMs);
          await supabase
            .from('tradera_retry_jobs')
            .update({ attempt_count: attempt, retry_after: nextRetry.toISOString(), last_error: 'Rate limited — rescheduled with backoff' })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'rescheduled' });
          continue;
        }

        if (!itemData.item) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          const nextRetry = new Date(Date.now() + backoffMs);
          await supabase
            .from('tradera_retry_jobs')
            .update({ attempt_count: attempt, retry_after: nextRetry.toISOString(), last_error: itemData.error || 'Item not found' })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'fetch_failed' });
          continue;
        }

        const item = itemData.item;
        const payload = job.item_payload || {};

        const { data: existing } = await supabase
          .from('ancora_import_items')
          .select('id')
          .eq('source_ref', job.source_ref)
          .eq('source_type', 'tradera')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('tradera_retry_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString(), attempt_count: attempt })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'already_exists' });
          continue;
        }

        const images = item.imageLinks || [];
        
        if (images.length === 0) {
          await supabase
            .from('tradera_retry_jobs')
            .update({ attempt_count: attempt, retry_after: new Date(Date.now() + BASE_BACKOFF_MS).toISOString(), last_error: 'No images returned' })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'no_images' });
          continue;
        }

        const keywords = (item.shortDescription || '')
          .toLowerCase()
          .replace(/[^\wåäöÅÄÖ\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .slice(0, 10);

        const originalTitle = item.shortDescription || payload.shortDescription || 'Untitled';
        const originalDescription = item.longDescription || payload.longDescription || null;

        // ── Translation with skip-if-English + budget ──
        let titleEn: string | null = null;
        let descriptionEn: string | null = null;
        let translatedAt: string | null = null;
        let detectedLanguage = 'sv';

        if (isLikelyEnglish(originalTitle, originalDescription || '')) {
          // Already English — skip API call
          console.log(`[Translation] Skipped (already EN): ${job.source_ref}`);
          titleEn = originalTitle;
          descriptionEn = originalDescription;
          translatedAt = new Date().toISOString();
          detectedLanguage = 'en';
        } else {
          // Check budget before calling translate API
          const charEstimate = (originalTitle + (originalDescription || '')).length;
          const budgetOk = await checkAndIncrementBudget(supabase, charEstimate);

          if (!budgetOk) {
            console.warn(`[Translation] Budget exceeded, skipping translation for ${job.source_ref}`);
            // Use originals as fallback
            titleEn = originalTitle;
            descriptionEn = originalDescription;
            translatedAt = new Date().toISOString();
          } else {
            try {
              const translateResponse = await fetch(`${supabaseUrl}/functions/v1/translate-swedish`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  name: originalTitle,
                  description: originalDescription || '',
                  condition: item.condition || '',
                }),
              });

              if (translateResponse.ok) {
                const translated = await translateResponse.json();
                titleEn = translated.name || null;
                descriptionEn = translated.description || null;
                translatedAt = new Date().toISOString();
                console.log(`[Tradera Import] Translated item ${job.source_ref}`);
              } else {
                console.error(`[Tradera Import] Translation failed for ${job.source_ref}: HTTP ${translateResponse.status}`);
              }
            } catch (translationErr) {
              console.error(`[Tradera Import] Translation failed for ${job.source_ref}: ${translationErr instanceof Error ? translationErr.message : 'Unknown'}`);
            }
          }
        }

        const { error: insertError } = await supabase
          .from('ancora_import_items')
          .insert({
            source_type: 'tradera',
            source_ref: job.source_ref,
            source_url: item.itemLink || payload.itemLink,
            affiliate_url: item.itemLink || payload.itemLink,
            title: titleEn || originalTitle,
            description: descriptionEn || originalDescription,
            title_original: originalTitle,
            description_original: originalDescription,
            title_en: titleEn,
            description_en: descriptionEn,
            language: detectedLanguage,
            translated_at: translatedAt,
            images,
            price: item.buyItNowPrice || item.price || payload.price || null,
            currency: 'SEK',
            condition: mapCondition(item.condition || payload.condition),
            provenance: item.sellerAlias || payload.sellerAlias || 'Tradera',
            signals: { keywords, colors: [], era: null, material: item.material ? [item.material] : null, vibe: null },
            status: 'draft',
          });

        if (insertError) {
          await supabase
            .from('tradera_retry_jobs')
            .update({ attempt_count: attempt, last_error: insertError.message, retry_after: new Date(Date.now() + BASE_BACKOFF_MS).toISOString() })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'insert_failed' });
          continue;
        }

        await supabase
          .from('tradera_retry_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString(), attempt_count: attempt })
          .eq('id', job.id);

        results.push({ id: job.id, source_ref: job.source_ref, result: 'success' });

      } catch (err) {
        await supabase
          .from('tradera_retry_jobs')
          .update({
            attempt_count: attempt,
            last_error: err instanceof Error ? err.message : 'Unknown error',
            retry_after: new Date(Date.now() + BASE_BACKOFF_MS).toISOString(),
          })
          .eq('id', job.id);
        results.push({ id: job.id, source_ref: job.source_ref, result: 'error' });
      }
    }

    const successCount = results.filter(r => r.result === 'success').length;
    const finishedAt = new Date();
    await logCronRun(supabase, {
      job_name: 'tradera_retry_import', status: 'success',
      started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - _startTime,
      items_processed: results.length, checked_count: results.length, sold_marked: successCount,
    });

    return new Response(
      JSON.stringify({ message: 'Retry processing complete', processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const finishedAt = new Date();
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logCronRun(supabase, {
        job_name: 'tradera_retry_import', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (_) { /* non-blocking */ }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapCondition(traderaCondition?: string): string {
  if (!traderaCondition) return 'unknown';
  const lower = traderaCondition.toLowerCase();
  if (lower.includes('new') || lower.includes('ny')) return 'new';
  if (lower.includes('excellent') || lower.includes('utmärkt')) return 'excellent';
  if (lower.includes('good') || lower.includes('god') || lower.includes('bra')) return 'good';
  if (lower.includes('fair') || lower.includes('hyfsad') || lower.includes('ok')) return 'fair';
  return 'unknown';
}
