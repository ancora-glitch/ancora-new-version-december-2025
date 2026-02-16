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

type AffiliateStatus = 'active' | 'sold' | 'unavailable' | 'unknown';

interface AvailabilityResult {
  productId: string;
  productName: string;
  affiliateStatus: AffiliateStatus;
  autoUnpublished: boolean;
  error?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getEbayBaseUrl(): string {
  const env = Deno.env.get('EBAY_ENV') || 'production';
  return env === 'sandbox' 
    ? 'https://api.sandbox.ebay.com' 
    : 'https://api.ebay.com';
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<{ token: string } | { error: string }> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return { token: cachedToken.token };
  }

  const baseUrl = getEbayBaseUrl();
  const tokenUrl = `${baseUrl}/identity/v1/oauth2/token`;
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      return { error: 'OAuth token generation failed' };
    }

    const tokenData = await response.json();
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + ((tokenData.expires_in || 7200) * 1000),
    };
    return { token: tokenData.access_token };
  } catch (error: any) {
    return { error: error.message };
  }
}

function extractEbayItemId(url: string | null): string | null {
  if (!url) return null;
  const itmMatch = url.match(/\/itm\/(?:[^/]+\/)?(\d{10,15})/i);
  if (itmMatch?.[1]) return itmMatch[1];
  const queryMatch = url.match(/[?&](?:item|itemId)=(\d{10,15})/i);
  if (queryMatch?.[1]) return queryMatch[1];
  return null;
}

async function checkEbayItemAvailability(
  itemId: string, 
  accessToken: string
): Promise<{ status: AffiliateStatus; error?: string }> {
  const baseUrl = getEbayBaseUrl();
  const itemUrl = `${baseUrl}/buy/browse/v1/item/v1|${itemId}|0`;
  
  try {
    const response = await fetch(itemUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) return { status: 'unavailable' };

    if (!response.ok) {
      return { status: 'unknown', error: `API error: ${response.status}` };
    }

    const item = await response.json();
    
    if (item.itemEndDate) {
      if (new Date(item.itemEndDate) < new Date()) return { status: 'sold' };
    }
    
    if (item.estimatedAvailabilities) {
      for (const avail of item.estimatedAvailabilities) {
        if (avail.availabilityStatus === 'OUT_OF_STOCK') return { status: 'sold' };
        if (avail.estimatedAvailableQuantity === 0) return { status: 'sold' };
      }
    }
    
    if (item.currentBidPrice && item.biddingInfo?.auctionStatus === 'ENDED') return { status: 'sold' };
    
    return { status: 'active' };
  } catch (error: any) {
    return { status: 'unknown', error: error.message };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  const startedAt = new Date();
  const _startTime = startedAt.getTime();
  let supabase: any;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID') || Deno.env.get('EBAY_APP_ID');
    const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET') || Deno.env.get('EBAY_CERT_ID');

    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'eBay API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retention cleanup
    await runRetention(supabase);

    const tokenResult = await getAccessToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);
    if ('error' in tokenResult) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'ebay_availability', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0,
        error_message: 'OAuth token failed',
      });
      return new Response(
        JSON.stringify({ error: tokenResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const accessToken = tokenResult.token;

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, brand, affiliate_url, affiliate_auto_handling, affiliate_status')
      .ilike('marketplace', '%ebay%')
      .in('status', ['active', 'published']);

    if (fetchError) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'ebay_availability', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0,
        error_message: fetchError.message,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!products || products.length === 0) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'ebay_availability', status: 'success',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0,
      });
      return new Response(
        JSON.stringify({ message: 'No active eBay products to check', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const THROTTLE_DELAY_MS = 500;
    const results: AvailabilityResult[] = [];

    for (const product of products) {
      const itemId = extractEbayItemId(product.affiliate_url);
      
      if (!itemId) {
        results.push({
          productId: product.id, productName: `${product.brand} - ${product.name}`,
          affiliateStatus: 'unknown', autoUnpublished: false,
          error: 'Could not extract eBay item ID from URL',
        });
        continue;
      }

      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY_MS));
      }

      const availability = await checkEbayItemAvailability(itemId, accessToken);
      const affiliateAutoHandling = product.affiliate_auto_handling !== false;
      
      const updateData: Record<string, any> = {
        affiliate_status: availability.status,
        affiliate_last_checked_at: new Date().toISOString(),
        affiliate_checked_via: 'ebay',
        updated_at: new Date().toISOString(),
      };
      
      let autoUnpublished = false;
      
      if (availability.status !== 'active' && availability.status !== 'unknown' && affiliateAutoHandling) {
        updateData.status = 'sold';
        updateData.unpublished_reason = 'affiliate_unavailable';
        autoUnpublished = true;
      }
      
      await supabase.from('products').update(updateData).eq('id', product.id);
      
      results.push({
        productId: product.id, productName: `${product.brand} - ${product.name}`,
        affiliateStatus: availability.status, autoUnpublished,
        error: availability.error,
      });
    }

    const sold = results.filter(r => r.affiliateStatus === 'sold').length;
    const unpublished = results.filter(r => r.autoUnpublished).length;

    const finishedAt = new Date();
    await logCronRun(supabase, {
      job_name: 'ebay_availability', status: 'success',
      started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - _startTime,
      items_processed: products.length, checked_count: results.length, sold_marked: unpublished,
    });

    return new Response(
      JSON.stringify({
        message: `Checked ${products.length} eBay products`,
        summary: {
          active: results.filter(r => r.affiliateStatus === 'active').length,
          sold, unavailable: results.filter(r => r.affiliateStatus === 'unavailable').length,
          unknown: results.filter(r => r.affiliateStatus === 'unknown').length, unpublished,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const finishedAt = new Date();
    try {
      if (!supabase) {
        supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      }
      await logCronRun(supabase, {
        job_name: 'ebay_availability', status: 'error',
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
