import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // --- Auth: admin or service role ---
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token === serviceRoleKey) {
    // ok
  } else if (token) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const serviceClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // --- Health checks ---
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const checks: Record<string, boolean> = { db: false, secrets: false, retryQueue: false };
  const errors: Record<string, string> = {};

  // 1. DB ping
  try {
    const { error } = await serviceClient.from('tradera_api_usage').select('id').limit(1);
    checks.db = !error;
    if (error) errors.db = error.message;
  } catch (e: any) {
    errors.db = e.message;
  }

  // 2. Required secrets
  try {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TRADERA_APP_ID', 'TRADERA_APP_KEY', 'EBAY_APP_ID'];
    const missing = required.filter(k => !Deno.env.get(k));
    checks.secrets = missing.length === 0;
    if (missing.length > 0) errors.secrets = `Missing: ${missing.join(', ')}`;
  } catch (e: any) {
    errors.secrets = e.message;
  }

  // 3. Retry queue readable
  try {
    const { count, error } = await serviceClient
      .from('tradera_retry_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'retrying']);
    checks.retryQueue = !error;
    if (error) errors.retryQueue = error.message;
  } catch (e: any) {
    errors.retryQueue = e.message;
  }

  const ok = Object.values(checks).every(Boolean);
  const version = new Date().toISOString();

  // 4. Cron run visibility — latest run + last success per job
  const cronJobs = ['tradera_sync', 'tradera_retry_import', 'ebay_availability'];
  const cron: Record<string, any> = {};
  for (const jobName of cronJobs) {
    try {
      // Latest run (any status)
      const { data: latest } = await serviceClient
        .from('cron_runs')
        .select('ran_at, started_at, finished_at, status, duration_ms, items_processed, checked_count, sold_marked, error_message')
        .eq('job_name', jobName)
        .order('ran_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Last successful run (for fallback display when latest is error)
      let lastSuccess: string | null = null;
      if (latest && latest.status === 'error') {
        const { data: successRow } = await serviceClient
          .from('cron_runs')
          .select('ran_at')
          .eq('job_name', jobName)
          .eq('status', 'success')
          .order('ran_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        lastSuccess = successRow?.ran_at ?? null;
      }

      cron[jobName] = latest
        ? {
            lastRun: latest.ran_at,
            status: latest.status,
            duration_ms: latest.duration_ms ?? 0,
            items_processed: latest.items_processed ?? 0,
            checked_count: latest.checked_count ?? 0,
            sold_marked: latest.sold_marked ?? 0,
            error_message: latest.error_message ?? null,
            lastSuccess,
          }
        : { lastRun: null, status: 'never', lastSuccess: null };
    } catch (_) {
      cron[jobName] = { lastRun: null, status: 'unknown', lastSuccess: null };
    }
  }

  // 5. Translation status + budget
  const translation = {
    enabled: true,
    last_error: null as string | null,
    untranslated_count: 0,
    failure_count_24h: 0,
    budget: { items_used: 0, items_max: 200, chars_used: 0, chars_max: 200000, limit_reached: false },
  };
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      translation.enabled = false;
      translation.last_error = 'LOVABLE_API_KEY not configured';
    }

    // Count untranslated Tradera products
    const { count: untranslatedCount } = await serviceClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('marketplace', 'tradera')
      .is('name_en', null);
    translation.untranslated_count = untranslatedCount ?? 0;

    // Count products where language=sv but missing translations (guardrail)
    const { count: missingCount } = await serviceClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('language', 'sv')
      .is('name_en', null)
      .not('marketplace', 'is', null);
    if (missingCount && missingCount > 0) {
      translation.failure_count_24h = missingCount;
    }

    // Daily budget
    const today = new Date().toISOString().slice(0, 10);
    const { data: budgetRow } = await serviceClient
      .from('translation_usage')
      .select('items_used, chars_used')
      .eq('day_utc', today)
      .maybeSingle();
    if (budgetRow) {
      translation.budget.items_used = budgetRow.items_used;
      translation.budget.chars_used = budgetRow.chars_used;
    }
    translation.budget.limit_reached = translation.budget.items_used >= translation.budget.items_max;
  } catch (_) { /* non-blocking */ }

  // 6. Missing source_ref invariant: published affiliate products without tradera_item_id / parseable source
  let missing_source_ref_count = 0;
  try {
    const { count } = await serviceClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'published'])
      .not('affiliate_url', 'is', null)
      .is('tradera_item_id', null);
    missing_source_ref_count = count ?? 0;
  } catch (_) { /* non-blocking */ }

  return new Response(JSON.stringify({ ok, checks, version, cron, translation, missing_source_ref_count, errors: Object.keys(errors).length > 0 ? errors : undefined }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
