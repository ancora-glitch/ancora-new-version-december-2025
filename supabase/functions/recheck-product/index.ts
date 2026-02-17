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
  if (token === serviceRoleKey) return { authorized: true, userId: 'service-role' };

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleData) return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  return { authorized: true, userId: user.id };
}

// ── Tradera check ──

function extractTraderaItemId(url: string | null): string | null {
  if (!url) return null;
  const twoSeg = url.match(/\/item\/\d+\/(\d+)/i);
  if (twoSeg?.[1]) return twoSeg[1];
  const oneSeg = url.match(/\/item\/(\d+)/i);
  if (oneSeg?.[1]) return oneSeg[1];
  const q = url.match(/[?&]itemId=(\d+)/i);
  if (q?.[1]) return q[1];
  return null;
}

async function checkTradera(itemId: string): Promise<{ status: 'active' | 'sold' | 'unavailable' | 'unknown'; reason: string }> {
  const appId = Deno.env.get('TRADERA_APP_ID');
  const appKey = Deno.env.get('TRADERA_APP_KEY');
  if (!appId || !appKey) return { status: 'unknown', reason: 'Tradera credentials not configured' };

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Header>
    <AuthenticationHeader xmlns="http://api.tradera.com">
      <AppId>${appId}</AppId>
      <AppKey>${appKey}</AppKey>
    </AuthenticationHeader>
  </soap:Header>
  <soap:Body>
    <GetItem xmlns="http://api.tradera.com">
      <itemId>${itemId}</itemId>
    </GetItem>
  </soap:Body>
</soap:Envelope>`;

  try {
    const res = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://api.tradera.com/GetItem' },
      body: soapEnvelope,
    });
    if (res.status === 429) return { status: 'unknown', reason: 'Rate limited (429)' };
    if (!res.ok) return { status: 'unknown', reason: `HTTP ${res.status}` };
    const xml = await res.text();

    // Check status
    const statusMatch = xml.match(/<ItemStatus>(.*?)<\/ItemStatus>/i);
    if (statusMatch) {
      const s = statusMatch[1].toLowerCase();
      if (s === 'ended' || s === 'sold' || s === 'closed') return { status: 'sold', reason: `ItemStatus=${statusMatch[1]}` };
    }
    // Check EndDate
    const endMatch = xml.match(/<EndDate>(.*?)<\/EndDate>/i);
    if (endMatch) {
      try {
        if (new Date(endMatch[1]) < new Date()) return { status: 'sold', reason: `EndDate ${endMatch[1]} passed` };
      } catch { /* ignore */ }
    }
    return { status: 'active', reason: 'Listing is live' };
  } catch (e: any) {
    return { status: 'unknown', reason: e.message };
  }
}

// ── eBay check ──

function extractEbayItemId(url: string | null): string | null {
  if (!url) return null;
  const itmMatch = url.match(/\/itm\/(?:[^/]+\/)?(\d{10,15})/i);
  if (itmMatch?.[1]) return itmMatch[1];
  const queryMatch = url.match(/[?&](?:item|itemId)=(\d{10,15})/i);
  if (queryMatch?.[1]) return queryMatch[1];
  return null;
}

async function getEbayToken(): Promise<string | null> {
  const clientId = Deno.env.get('EBAY_CLIENT_ID') || Deno.env.get('EBAY_APP_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET') || Deno.env.get('EBAY_CERT_ID');
  if (!clientId || !clientSecret) return null;
  const env = Deno.env.get('EBAY_ENV') || 'production';
  const baseUrl = env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
  try {
    const res = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.access_token;
  } catch { return null; }
}

async function checkEbay(itemId: string): Promise<{ status: 'active' | 'sold' | 'unavailable' | 'unknown'; reason: string }> {
  const token = await getEbayToken();
  if (!token) return { status: 'unknown', reason: 'eBay credentials not configured' };
  const env = Deno.env.get('EBAY_ENV') || 'production';
  const baseUrl = env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
  try {
    const res = await fetch(`${baseUrl}/buy/browse/v1/item/v1|${itemId}|0`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'Content-Type': 'application/json' },
    });
    if (res.status === 404) return { status: 'unavailable', reason: 'Item not found (404)' };
    if (!res.ok) return { status: 'unknown', reason: `API error ${res.status}` };
    const item = await res.json();
    if (item.itemEndDate && new Date(item.itemEndDate) < new Date()) return { status: 'sold', reason: `endDate ${item.itemEndDate} passed` };
    if (item.estimatedAvailabilities) {
      for (const a of item.estimatedAvailabilities) {
        if (a.availabilityStatus === 'OUT_OF_STOCK') return { status: 'sold', reason: 'OUT_OF_STOCK' };
        if (a.estimatedAvailableQuantity === 0) return { status: 'sold', reason: 'quantity=0' };
      }
    }
    if (item.currentBidPrice && item.biddingInfo?.auctionStatus === 'ENDED') return { status: 'sold', reason: 'Auction ended' };
    return { status: 'active', reason: 'Listing is live' };
  } catch (e: any) {
    return { status: 'unknown', reason: e.message };
  }
}

// ── Detect marketplace from product ──

function detectMarketplace(product: any): 'tradera' | 'ebay' | null {
  const mp = (product.marketplace || '').toLowerCase();
  if (mp.includes('tradera')) return 'tradera';
  if (mp.includes('ebay')) return 'ebay';
  // Try to detect from affiliate_url
  const url = product.affiliate_url || '';
  if (url.includes('tradera.com')) return 'tradera';
  if (url.includes('ebay.')) return 'ebay';
  return null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const { product_id, slug } = await req.json();
    if (!product_id && !slug) {
      return new Response(JSON.stringify({ error: 'product_id or slug required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let query = supabase.from('products').select('id, name, brand, slug, marketplace, affiliate_url, tradera_item_id, affiliate_auto_handling, status');
    if (product_id) query = query.eq('id', product_id);
    else query = query.eq('slug', slug);

    const { data: product, error: fetchErr } = await query.maybeSingle();
    if (fetchErr || !product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const marketplace = detectMarketplace(product);
    if (!marketplace) {
      return new Response(JSON.stringify({ error: 'Cannot determine marketplace', product_id: product.id }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract item ID
    let itemId: string | null = null;
    if (marketplace === 'tradera') {
      itemId = product.tradera_item_id || extractTraderaItemId(product.affiliate_url);
    } else {
      itemId = extractEbayItemId(product.affiliate_url);
    }

    // Guardrail: try to backfill tradera_item_id if missing
    if (marketplace === 'tradera' && !product.tradera_item_id && itemId) {
      await supabase.from('products').update({ tradera_item_id: itemId }).eq('id', product.id);
    }

    if (!itemId) {
      return new Response(JSON.stringify({
        error: 'Cannot extract item ID from affiliate_url',
        product_id: product.id,
        affiliate_url: product.affiliate_url,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Run the check
    const result = marketplace === 'tradera'
      ? await checkTradera(itemId)
      : await checkEbay(itemId);

    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      affiliate_status: result.status,
      affiliate_last_checked_at: now,
      affiliate_checked_via: marketplace,
      updated_at: now,
    };

    let autoUnpublished = false;
    if (result.status !== 'active' && result.status !== 'unknown' && product.affiliate_auto_handling !== false) {
      updateData.status = 'sold';
      updateData.unpublished_reason = 'affiliate_unavailable';
      autoUnpublished = true;
    }

    await supabase.from('products').update(updateData).eq('id', product.id);

    return new Response(JSON.stringify({
      product_id: product.id,
      product_name: `${product.brand} - ${product.name}`,
      marketplace,
      item_id: itemId,
      affiliate_status: result.status,
      reason: result.reason,
      auto_unpublished: autoUnpublished,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
