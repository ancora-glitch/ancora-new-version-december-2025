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
  let authMethod = 'none';

  if (token === serviceRoleKey) {
    authMethod = 'service_role';
  } else if (token) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.log('[admin-health] auth failed: no user');
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
        console.log('[admin-health] auth failed: not admin');
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
      }
      authMethod = 'jwt';
    } catch (e) {
      console.log('[admin-health] auth error:', e.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  console.log(`[admin-health] authorized via ${authMethod}`);

  // --- Health checks ---
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const checks: Record<string, boolean> = {
    db: false,
    secrets: false,
    retryQueue: false,
  };
  const errors: Record<string, string> = {};

  // 1. DB ping
  try {
    const { error } = await serviceClient.from('tradera_api_usage').select('id').limit(1);
    checks.db = !error;
    if (error) errors.db = error.message;
  } catch (e) {
    errors.db = e.message;
  }

  // 2. Required secrets exist (boolean only)
  try {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'TRADERA_APP_ID', 'TRADERA_APP_KEY', 'EBAY_APP_ID'];
    const missing = required.filter(k => !Deno.env.get(k));
    checks.secrets = missing.length === 0;
    if (missing.length > 0) errors.secrets = `Missing: ${missing.join(', ')}`;
  } catch (e) {
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
  } catch (e) {
    errors.retryQueue = e.message;
  }

  const ok = Object.values(checks).every(Boolean);
  const version = new Date().toISOString();

  // 4. Cron run visibility — latest run per job
  const cronJobs = ['tradera_sync', 'tradera_retry_import', 'ebay_availability'];
  const cron: Record<string, { lastRun: string | null; status: string; duration_ms?: number; items_processed?: number; checked_count?: number; sold_marked?: number }> = {};
  for (const jobName of cronJobs) {
    try {
      const { data } = await serviceClient
        .from('cron_runs')
        .select('ran_at, status, duration_ms, items_processed, checked_count, sold_marked')
        .eq('job_name', jobName)
        .order('ran_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cron[jobName] = data
        ? { lastRun: data.ran_at, status: data.status, duration_ms: data.duration_ms, items_processed: data.items_processed, checked_count: data.checked_count, sold_marked: data.sold_marked }
        : { lastRun: null, status: 'never' };
    } catch (_) {
      cron[jobName] = { lastRun: null, status: 'unknown' };
    }
  }

  return new Response(JSON.stringify({ ok, checks, version, cron, errors: Object.keys(errors).length > 0 ? errors : undefined }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
