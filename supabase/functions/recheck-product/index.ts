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

// ── Tradera check (SOAP API) ──

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

async function checkTradera(itemId: string): Promise<{ status: 'active' | 'sold' | 'unavailable' | 'unknown' | 'review_required'; reason: string }> {
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

    const statusMatch = xml.match(/<ItemStatus>(.*?)<\/ItemStatus>/i);
    if (statusMatch) {
      const s = statusMatch[1].toLowerCase();
      if (s === 'ended' || s === 'sold' || s === 'closed') return { status: 'sold', reason: `ItemStatus=${statusMatch[1]}` };
    }
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

// ── HTML fallback check for Tradera ──

const SOLD_PHRASES_SV = [
  'vann auktionen',
  'auktionen är avslutad',
  'såld',
  'köpt',
  'annonsen är avslutad',
  'annonsen har avslutats',
  'detta objekt är slutsålt',
];
const SOLD_PHRASES_EN = [
  'listing ended',
  'auction closed',
  'this item has been sold',
  'bidding has ended',
];
const ALL_SOLD_PHRASES = [...SOLD_PHRASES_SV, ...SOLD_PHRASES_EN];

async function checkTraderaHtml(affiliateUrl: string): Promise<{ status: 'active' | 'sold' | 'review_required' | 'unknown'; reason: string }> {
  try {
    const res = await fetch(affiliateUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AncoraBot/1.0)' },
      redirect: 'follow',
    });

    if (res.status === 404 || res.status === 410) {
      return { status: 'sold', reason: `HTML check: HTTP ${res.status}` };
    }
    if (!res.ok) {
      return { status: 'unknown', reason: `HTML check: HTTP ${res.status}` };
    }

    const html = await res.text();
    const lower = html.toLowerCase();

    // Check for sold/ended phrases
    for (const phrase of ALL_SOLD_PHRASES) {
      if (lower.includes(phrase)) {
        return { status: 'sold', reason: `Detected phrase: "${phrase}"` };
      }
    }

    // Check for missing buy/bid elements
    const hasBuyButton = lower.includes('köp nu') || lower.includes('buy now') || lower.includes('buyitnowprice');
    const hasBidButton = lower.includes('lägg bud') || lower.includes('place bid') || lower.includes('bidbutton');
    const hasActivePrice = lower.includes('itemprice') || lower.includes('currentprice');

    if (!hasBuyButton && !hasBidButton && !hasActivePrice) {
      return { status: 'review_required', reason: 'HTML check: no buy/bid/price elements found' };
    }

    return { status: 'active', reason: 'HTML check: listing appears active' };
  } catch (e: any) {
    return { status: 'unknown', reason: `HTML fetch error: ${e.message}` };
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
  const url = product.affiliate_url || '';
  if (url.includes('tradera.com')) return 'tradera';
  if (url.includes('ebay.')) return 'ebay';
  return null;
}

// ── Batch scan handler ──

async function handleBatchScan(req: Request, supabase: any, corsHeaders: Record<string, string>) {
  // Fetch all published products with affiliate URLs
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, slug, marketplace, affiliate_url, tradera_item_id, affiliate_auto_handling, status, affiliate_status')
    .in('status', ['active', 'published'])
    .not('affiliate_url', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const totalProducts = (products || []).length;
  const results: any[] = [];
  let checked = 0;
  let rateLimitHits = 0;
  let unknownCount = 0;
  let errorCount = 0;
  const pendingSoldUpdates: { id: string; updateData: Record<string, any>; result: any }[] = [];
  let reviewFlagged = 0;

  const THROTTLE_MS = 500; // slower than before to avoid rate limits

  for (const product of (products || [])) {
    const marketplace = detectMarketplace(product);
    if (!marketplace) continue;

    let itemId: string | null = null;
    if (marketplace === 'tradera') {
      itemId = product.tradera_item_id || extractTraderaItemId(product.affiliate_url);
    } else {
      itemId = extractEbayItemId(product.affiliate_url);
    }
    if (!itemId) continue;

    // Primary API check
    let result = marketplace === 'tradera'
      ? await checkTradera(itemId)
      : await checkEbay(itemId);

    // Track rate limits — do NOT use HTML fallback when rate limited
    if (result.status === 'unknown' && result.reason.includes('429')) {
      rateLimitHits++;
      console.warn(`[recheck-scan] Rate limited on ${marketplace} item ${itemId} (hit #${rateLimitHits})`);
      // If we hit 3+ rate limits, abort scan entirely
      if (rateLimitHits >= 3) {
        console.error(`[recheck-scan] Aborting: ${rateLimitHits} rate limit hits`);
        break;
      }
      results.push({
        product_id: product.id,
        product_name: `${product.brand} - ${product.name}`,
        affiliate_status: 'unknown',
        reason: result.reason,
        action: 'skipped_rate_limited',
      });
      await new Promise(r => setTimeout(r, THROTTLE_MS * 3)); // extra backoff
      continue;
    }

    // HTML fallback for Tradera ONLY when API returns unknown for non-rate-limit reasons
    if (marketplace === 'tradera' && result.status === 'unknown' && product.affiliate_url) {
      unknownCount++;
      // Skip HTML fallback in batch mode — too unreliable for mass operations
      results.push({
        product_id: product.id,
        product_name: `${product.brand} - ${product.name}`,
        affiliate_status: 'unknown',
        reason: result.reason,
        action: 'skipped_unknown',
      });
      continue;
    }

    checked++;
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      affiliate_status: result.status,
      affiliate_last_checked_at: now,
      affiliate_checked_via: marketplace,
      updated_at: now,
    };

    let autoAction: string | null = null;

    if (result.status === 'review_required') {
      updateData.status = 'review_required';
      reviewFlagged++;
      autoAction = 'flagged_review';
      // Review flags are safe to apply immediately
      await supabase.from('products').update(updateData).eq('id', product.id);
    } else if (result.status !== 'active' && result.status !== 'unknown' && product.affiliate_auto_handling !== false) {
      // DEFER sold updates — only apply if scan completes successfully
      autoAction = 'pending_sold';
      pendingSoldUpdates.push({
        id: product.id,
        updateData: { ...updateData, status: 'sold', unpublished_reason: 'affiliate_unavailable' },
        result: { product_id: product.id, product_name: `${product.brand} - ${product.name}` },
      });
    } else {
      // Active or unknown — safe to update status fields
      await supabase.from('products').update(updateData).eq('id', product.id);
    }

    results.push({
      product_id: product.id,
      product_name: `${product.brand} - ${product.name}`,
      affiliate_status: result.status,
      reason: result.reason,
      action: autoAction,
    });

    await new Promise(r => setTimeout(r, THROTTLE_MS));
  }

  // ── Completion guard ──
  // Only apply sold updates if the scan was healthy:
  // - No rate limit aborts
  // - Error rate < 50% of total
  const scanAborted = rateLimitHits >= 3;
  const errorRate = totalProducts > 0 ? (rateLimitHits + unknownCount) / totalProducts : 0;
  const scanHealthy = !scanAborted && errorRate < 0.5;

  let soldMarked = 0;

  if (scanHealthy && pendingSoldUpdates.length > 0) {
    console.log(`[recheck-scan] Scan healthy — applying ${pendingSoldUpdates.length} sold updates`);
    for (const pending of pendingSoldUpdates) {
      await supabase.from('products').update(pending.updateData).eq('id', pending.id);
      soldMarked++;
      // Update the action in results
      const resultEntry = results.find(r => r.product_id === pending.id);
      if (resultEntry) resultEntry.action = 'marked_sold';
    }
  } else if (pendingSoldUpdates.length > 0) {
    console.warn(`[recheck-scan] Scan unhealthy (aborted=${scanAborted}, errorRate=${(errorRate * 100).toFixed(1)}%) — skipping ${pendingSoldUpdates.length} sold updates to prevent false deactivations`);
    for (const pending of pendingSoldUpdates) {
      const resultEntry = results.find(r => r.product_id === pending.id);
      if (resultEntry) resultEntry.action = 'deferred_unhealthy_scan';
    }
  }

  return new Response(JSON.stringify({
    scan_complete: !scanAborted,
    scan_healthy: scanHealthy,
    total_products: totalProducts,
    total_checked: checked,
    sold_marked: soldMarked,
    sold_deferred: pendingSoldUpdates.length - soldMarked,
    review_flagged: reviewFlagged,
    rate_limit_hits: rateLimitHits,
    unknown_skipped: unknownCount,
    results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── Main handler ──

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await req.json();
    const { product_id, slug, scan_all } = body;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Batch scan mode
    if (scan_all) {
      return handleBatchScan(req, supabase, corsHeaders);
    }

    // Single product mode
    if (!product_id && !slug) {
      return new Response(JSON.stringify({ error: 'product_id, slug, or scan_all required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let query = supabase.from('products').select('id, name, brand, slug, marketplace, affiliate_url, tradera_item_id, affiliate_auto_handling, status, affiliate_status');
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

    let itemId: string | null = null;
    if (marketplace === 'tradera') {
      itemId = product.tradera_item_id || extractTraderaItemId(product.affiliate_url);
    } else {
      itemId = extractEbayItemId(product.affiliate_url);
    }

    // Backfill tradera_item_id if missing
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

    // Primary API check
    let result = marketplace === 'tradera'
      ? await checkTradera(itemId)
      : await checkEbay(itemId);

    // HTML fallback for Tradera when API returns unknown
    if (marketplace === 'tradera' && result.status === 'unknown' && product.affiliate_url) {
      console.log(`[recheck] API returned unknown for ${product.id}, trying HTML fallback`);
      const htmlResult = await checkTraderaHtml(product.affiliate_url);
      if (htmlResult.status !== 'unknown') {
        result = htmlResult;
        console.log(`[recheck] HTML fallback result: ${htmlResult.status} — ${htmlResult.reason}`);
      }
    }

    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      affiliate_status: result.status,
      affiliate_last_checked_at: now,
      affiliate_checked_via: marketplace,
      updated_at: now,
    };

    let autoUnpublished = false;
    let autoReviewFlagged = false;

    if (result.status === 'review_required' && product.affiliate_auto_handling !== false) {
      updateData.status = 'review_required';
      autoReviewFlagged = true;
    } else if (result.status !== 'active' && result.status !== 'unknown' && result.status !== 'review_required' && product.affiliate_auto_handling !== false) {
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
      auto_review_flagged: autoReviewFlagged,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
