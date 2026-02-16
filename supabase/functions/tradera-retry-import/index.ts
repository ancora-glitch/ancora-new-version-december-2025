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

// Auth: allows admin JWT OR service-role key (for cron jobs)
async function verifyAdminOrServiceRole(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('tradera-retry-import: auth failed — missing token');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Allow service-role key directly (used by pg_cron)
  if (token === serviceRoleKey) {
    console.log('tradera-retry-import: auth via service-role key');
    return { authorized: true, userId: 'service-role' };
  }

  // Otherwise, verify as admin user JWT via getUser
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.log('tradera-retry-import: auth failed — invalid token');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const userId = user.id;
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    console.log('tradera-retry-import: auth failed — not admin');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  console.log('tradera-retry-import: auth via jwt (admin)');
  return { authorized: true, userId };
}

// ========================================
// BACKGROUND RETRY PROCESSOR
// ========================================

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30 * 60 * 1000;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const _startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending retry jobs that are ready to process
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('tradera_retry_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('retry_after', new Date().toISOString())
      .order('retry_after', { ascending: true })
      .limit(3); // Process up to 3 per invocation

    if (fetchError) {
      console.error('Error fetching retry jobs:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch retry jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending retry jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingJobs.length} retry job(s)`);

    const results: Array<{ id: string; source_ref: string; result: string }> = [];

    for (const job of pendingJobs) {
      const attempt = job.attempt_count + 1;

      // INVARIANT: Stop retrying after max attempts
      if (attempt > MAX_ATTEMPTS) {
        console.error(`[Retry] Job ${job.source_ref} exceeded ${MAX_ATTEMPTS} attempts — marking as failed`);
        await supabase
          .from('tradera_retry_jobs')
          .update({ 
            status: 'failed', 
            last_error: `Exceeded max attempts (${MAX_ATTEMPTS})`,
            attempt_count: attempt,
          })
          .eq('id', job.id);
        results.push({ id: job.id, source_ref: job.source_ref, result: 'max_attempts_exceeded' });
        continue;
      }

      console.log(`[Retry] Attempt ${attempt}/${MAX_ATTEMPTS} for item ${job.source_ref}`);

      // Call tradera-item edge function to re-fetch
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

        // Rate limited again — reschedule with exponential backoff
        if (itemData.rateLimited) {
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1); // 30m, 1h, 2h, 4h...
          const nextRetry = new Date(Date.now() + backoffMs);
          
          console.warn(`[Retry] Rate limited again for ${job.source_ref} — rescheduling to ${nextRetry.toISOString()} (attempt ${attempt})`);
          
          await supabase
            .from('tradera_retry_jobs')
            .update({
              attempt_count: attempt,
              retry_after: nextRetry.toISOString(),
              last_error: 'Rate limited — rescheduled with backoff',
            })
            .eq('id', job.id);
          
          results.push({ id: job.id, source_ref: job.source_ref, result: 'rescheduled' });
          continue;
        }

        // Failed to fetch (non-rate-limit error)
        if (!itemData.item) {
          console.warn(`[Retry] Could not fetch item ${job.source_ref}: ${itemData.error || 'unknown'}`);
          
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          const nextRetry = new Date(Date.now() + backoffMs);
          
          await supabase
            .from('tradera_retry_jobs')
            .update({
              attempt_count: attempt,
              retry_after: nextRetry.toISOString(),
              last_error: itemData.error || 'Item not found',
            })
            .eq('id', job.id);
          
          results.push({ id: job.id, source_ref: job.source_ref, result: 'fetch_failed' });
          continue;
        }

        // SUCCESS — create AIS draft item with HD images
        const item = itemData.item;
        const payload = job.item_payload || {};

        // Check if AIS item already exists (another process may have created it)
        const { data: existing } = await supabase
          .from('ancora_import_items')
          .select('id')
          .eq('source_ref', job.source_ref)
          .eq('source_type', 'tradera')
          .maybeSingle();

        if (existing) {
          console.log(`[Retry] AIS item already exists for ${job.source_ref} — marking job complete`);
          await supabase
            .from('tradera_retry_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              attempt_count: attempt,
            })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'already_exists' });
          continue;
        }

        // Extract HD images
        const images = item.imageLinks || [];
        
        // INVARIANT: Only proceed if we have HD images
        if (images.length === 0) {
          console.warn(`[Retry] No images for ${job.source_ref} — rescheduling`);
          await supabase
            .from('tradera_retry_jobs')
            .update({
              attempt_count: attempt,
              retry_after: new Date(Date.now() + BASE_BACKOFF_MS).toISOString(),
              last_error: 'No images returned',
            })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'no_images' });
          continue;
        }

        // Build AIS signals
        const keywords = (item.shortDescription || '')
          .toLowerCase()
          .replace(/[^\wåäöÅÄÖ\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length > 2)
          .slice(0, 10);

        // Create AIS draft item
        const { error: insertError } = await supabase
          .from('ancora_import_items')
          .insert({
            source_type: 'tradera',
            source_ref: job.source_ref,
            source_url: item.itemLink || payload.itemLink,
            affiliate_url: item.itemLink || payload.itemLink,
            title: item.shortDescription || payload.shortDescription || 'Untitled',
            description: item.longDescription || payload.longDescription || null,
            images,
            price: item.buyItNowPrice || item.price || payload.price || null,
            currency: 'SEK',
            condition: mapCondition(item.condition || payload.condition),
            provenance: item.sellerAlias || payload.sellerAlias || 'Tradera',
            signals: {
              keywords,
              colors: [],
              era: null,
              material: item.material ? [item.material] : null,
              vibe: null,
            },
            status: 'draft',
          });

        if (insertError) {
          console.error(`[Retry] Failed to create AIS item for ${job.source_ref}:`, insertError);
          await supabase
            .from('tradera_retry_jobs')
            .update({
              attempt_count: attempt,
              last_error: insertError.message,
              retry_after: new Date(Date.now() + BASE_BACKOFF_MS).toISOString(),
            })
            .eq('id', job.id);
          results.push({ id: job.id, source_ref: job.source_ref, result: 'insert_failed' });
          continue;
        }

        // Mark job as completed
        console.log(`[Retry] Successfully created AIS draft for ${job.source_ref} with ${images.length} HD images`);
        await supabase
          .from('tradera_retry_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            attempt_count: attempt,
          })
          .eq('id', job.id);

        results.push({ id: job.id, source_ref: job.source_ref, result: 'success' });

      } catch (err) {
        console.error(`[Retry] Unexpected error for ${job.source_ref}:`, err);
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

    // Log cron run with telemetry
    const successCount = results.filter(r => r.result === 'success').length;
    try {
      await supabase.from('cron_runs').insert({
        job_name: 'tradera_retry_import',
        status: 'success',
        duration_ms: Date.now() - _startTime,
        items_processed: results.length,
        checked_count: results.length,
        sold_marked: successCount,
      });
    } catch (_) { /* non-blocking */ }

    return new Response(
      JSON.stringify({
        message: 'Retry processing complete',
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tradera-retry-import:', error);
    // Log cron failure
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabase.from('cron_runs').insert({
        job_name: 'tradera_retry_import',
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - _startTime,
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
