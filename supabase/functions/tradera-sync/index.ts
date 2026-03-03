import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_CHECKS_PER_RUN = 25;
const QUOTA_RESERVE_FOR_MANUAL = 30; // abort sync if remaining < this
const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = [5000, 10000]; // exponential backoff delays

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
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { authorized: true, userId: user.id };
}

// ── Helpers ──

async function runRetention(supabase: any) {
  try {
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
    await supabase.from('cron_runs').delete().lt('ran_at', cutoff);
  } catch (_) { /* never block */ }
}

async function logCronRun(supabase: any, payload: Record<string, any>) {
  try {
    await supabase.from('cron_runs').insert(payload);
  } catch (_) { /* non-blocking */ }
}

// ── Cursor helpers ──

async function getCursor(supabase: any, jobName: string): Promise<number> {
  const { data } = await supabase
    .from('cron_job_state')
    .select('cursor_value')
    .eq('job_name', jobName)
    .maybeSingle();
  return data?.cursor_value ?? 0;
}

async function setCursor(supabase: any, jobName: string, value: number) {
  await supabase
    .from('cron_job_state')
    .upsert({ job_name: jobName, cursor_value: value, updated_at: new Date().toISOString() });
}

// ── Tradera API ──

type AffiliateStatus = 'active' | 'sold' | 'unavailable' | 'unknown';

interface TraderaSyncResult {
  productId: string;
  productName: string;
  oldPrice: string;
  newPrice: string;
  status: 'updated' | 'ended' | 'unchanged' | 'error';
  affiliateStatus?: AffiliateStatus;
  autoUnpublished?: boolean;
  error?: string;
}

function extractItemId(url: string | null): string | null {
  if (!url) return null;
  const twoSegment = url.match(/\/item\/\d+\/(\d+)/i);
  if (twoSegment?.[1]) return twoSegment[1];
  const oneSegment = url.match(/\/item\/(\d+)/i);
  if (oneSegment?.[1]) return oneSegment[1];
  const queryParam = url.match(/[?&]itemId=(\d+)/i);
  if (queryParam?.[1]) return queryParam[1];
  return null;
}

interface TraderaItemDetails {
  price: number;
  hasEnded: boolean;
  rateLimited?: boolean;
}

async function fetchTraderaItem(itemId: string, appId: string, appKey: string): Promise<TraderaItemDetails | null> {
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
      <itemId>${itemId}</itemId>
    </GetItem>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://api.tradera.com/GetItem' },
      body: soapEnvelope,
    });
    if (response.status === 429) {
      console.warn(`[tradera-sync] 429 rate limited for item ${itemId}`);
      return { price: 0, hasEnded: false, rateLimited: true };
    }
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)');
      console.error(`[tradera-sync] HTTP ${response.status} for item ${itemId}: ${errorBody.slice(0, 500)}`);
      return null;
    }
    const xml = await response.text();
    const hasEnded = checkIfEnded(xml, itemId);
    const price = extractNumber(xml, 'MaxBid') || extractNumber(xml, 'NextBid') ||
                  extractNumber(xml, 'BuyItNowPrice') || extractNumber(xml, 'Price') || 0;
    return { price, hasEnded };
  } catch (e) {
    console.error(`[tradera-sync] Network error for item ${itemId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

interface AvailabilitySignals {
  itemStatus: string | null;
  endDate: Date | null;
  quantity: number | null;
  buyNowAvailable: boolean | null;
}

function extractAvailabilitySignals(xml: string): AvailabilitySignals {
  const statusMatch = xml.match(/<ItemStatus>(.*?)<\/ItemStatus>/i);
  const endDateMatch = xml.match(/<EndDate>(.*?)<\/EndDate>/i);
  const quantityMatch = xml.match(/<Quantity>(.*?)<\/Quantity>/i);
  const buyNowMatch = xml.match(/<BuyNowAvailable>(.*?)<\/BuyNowAvailable>/i);

  let endDate: Date | null = null;
  if (endDateMatch) {
    try { endDate = new Date(endDateMatch[1]); if (isNaN(endDate.getTime())) endDate = null; } catch { endDate = null; }
  }

  return {
    itemStatus: statusMatch?.[1] ?? null,
    endDate,
    quantity: quantityMatch ? parseInt(quantityMatch[1], 10) : null,
    buyNowAvailable: buyNowMatch ? buyNowMatch[1].toLowerCase() === 'true' : null,
  };
}

function checkIfEnded(xml: string, itemId?: string): boolean {
  const signals = extractAvailabilitySignals(xml);
  const now = new Date();

  const statusEnded = signals.itemStatus !== null &&
    ['ended', 'closed', 'sold'].includes(signals.itemStatus.toLowerCase());

  const pastEndDate = signals.endDate !== null && signals.endDate < now;

  const zeroQuantity = signals.quantity !== null && signals.quantity === 0;

  const buyNowGone = signals.buyNowAvailable === false && pastEndDate;

  const markedSold = statusEnded || pastEndDate || zeroQuantity || buyNowGone;

  console.log(
    `[TraderaAvailability] source_ref=${itemId ?? 'unknown'} status=${signals.itemStatus} endDate=${signals.endDate?.toISOString() ?? 'null'} quantity=${signals.quantity} buyNowAvailable=${signals.buyNowAvailable} -> marked_sold=${markedSold}`
  );

  return markedSold;
}

function extractNumber(xml: string, tag: string): number | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
  if (!match) return undefined;
  const num = parseFloat(match[1].trim());
  return isNaN(num) ? undefined : num;
}

// ── Main handler ──

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
    const appId = Deno.env.get('TRADERA_APP_ID');
    const appKey = Deno.env.get('TRADERA_APP_KEY');

    if (!appId || !appKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'tradera_sync', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0, batch_size: MAX_CHECKS_PER_RUN,
        error_message: 'Tradera API credentials not configured (TRADERA_APP_ID / TRADERA_APP_KEY)',
      });
      return new Response(JSON.stringify({ error: 'Tradera API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await runRetention(supabase);

    // ── Quota guard: abort if manual imports need headroom ──
    const { data: quotaData } = await supabase.rpc('tradera_get_usage');
    const remaining = quotaData?.remaining ?? 75;
    if (remaining < QUOTA_RESERVE_FOR_MANUAL) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'tradera_sync', status: 'skipped',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0, batch_size: MAX_CHECKS_PER_RUN,
        error_message: `Quota guard: ${remaining} remaining < ${QUOTA_RESERVE_FOR_MANUAL} reserve — skipped to preserve manual import budget`,
      });
      return new Response(JSON.stringify({
        message: 'Sync skipped — quota reserved for manual imports',
        remaining,
        reserve: QUOTA_RESERVE_FOR_MANUAL,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch ALL eligible Tradera products (guardrails applied in query)
    const { data: allProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, brand, price, affiliate_url, tradera_item_id, affiliate_auto_handling, affiliate_status')
      .ilike('marketplace', 'tradera')
      .in('status', ['active', 'published'])
      .not('affiliate_url', 'is', null)
      .order('id', { ascending: true });

    if (fetchError) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'tradera_sync', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0, batch_size: MAX_CHECKS_PER_RUN,
        error_message: fetchError.message,
      });
      return new Response(JSON.stringify({ error: 'Failed to fetch products', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!allProducts || allProducts.length === 0) {
      const finishedAt = new Date();
      await logCronRun(supabase, {
        job_name: 'tradera_sync', status: 'success',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0, batch_size: MAX_CHECKS_PER_RUN,
      });
      return new Response(JSON.stringify({ message: 'No active Tradera products to sync', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Round-robin cursor
    const cursorBefore = await getCursor(supabase, 'tradera_sync');
    const totalProducts = allProducts.length;
    const startIdx = cursorBefore % totalProducts;

    // Pick batch from cursor position, wrapping around
    const batch: typeof allProducts = [];
    for (let i = 0; i < Math.min(MAX_CHECKS_PER_RUN, totalProducts); i++) {
      batch.push(allProducts[(startIdx + i) % totalProducts]);
    }
    const cursorAfter = (startIdx + batch.length) % totalProducts;

    // Log skipped items without source_ref
    let skippedNoSource = 0;

    const THROTTLE_DELAY_MS = 2500;
    const results: TraderaSyncResult[] = [];

    for (const product of batch) {
      let itemId = product.tradera_item_id || extractItemId(product.affiliate_url);

      // Guardrail: backfill tradera_item_id if missing but parseable
      if (!product.tradera_item_id && itemId) {
        await supabase.from('products').update({ tradera_item_id: itemId }).eq('id', product.id);
      }

      if (!itemId) {
        skippedNoSource++;
        console.warn(`[tradera-sync] Skipping product ${product.id} — no source_ref/item_id`);
        results.push({
          productId: product.id, productName: `${product.brand} - ${product.name}`,
          oldPrice: product.price, newPrice: product.price,
          status: 'error', error: 'Could not extract Tradera item ID from URL',
        });
        continue;
      }

      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY_MS));
      }

      try {
        // Increment shared quota counter for this SOAP call
        const { data: quotaCheck } = await supabase.rpc('tradera_increment_usage');
        if (quotaCheck && !quotaCheck.allowed) {
          console.warn(`[tradera-sync] Quota exhausted mid-batch at item ${itemId} — stopping`);
          results.push({
            productId: product.id, productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price, newPrice: product.price,
            status: 'error', error: 'Quota exhausted mid-batch',
          });
          break;
        }

        let itemDetails = await fetchTraderaItem(itemId, appId, appKey);

        // Retry with backoff on rate limit
        if (itemDetails?.rateLimited) {
          for (let retry = 0; retry < MAX_RATE_LIMIT_RETRIES; retry++) {
            const delayMs = RATE_LIMIT_BACKOFF_MS[retry] ?? 10000;
            console.log(`[tradera-sync] Rate limited on item ${itemId}, retry ${retry + 1}/${MAX_RATE_LIMIT_RETRIES} after ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            itemDetails = await fetchTraderaItem(itemId, appId, appKey);
            if (!itemDetails?.rateLimited) break;
          }
        }

        if (itemDetails === null) {
          results.push({
            productId: product.id, productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price, newPrice: product.price,
            status: 'error', error: 'Could not fetch item from Tradera',
          });
          continue;
        }

        if (itemDetails.rateLimited) {
          console.warn(`[tradera-sync] Still rate limited after ${MAX_RATE_LIMIT_RETRIES} retries for item ${itemId} — skipping remaining batch`);
          results.push({
            productId: product.id, productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price, newPrice: product.price,
            status: 'error', error: `Tradera rate limited (429) after ${MAX_RATE_LIMIT_RETRIES} retries`,
          });
          break;
        }

        if (itemDetails.hasEnded) {
          const affiliateAutoHandling = product.affiliate_auto_handling !== false;
          // INVARIANT: Only update availability/status fields. Never overwrite editorial content
          // (name, description, name_en, description_en, images, brand, etc.)
          const updateData: Record<string, any> = {
            affiliate_status: 'sold',
            affiliate_last_checked_at: new Date().toISOString(),
            affiliate_checked_via: 'tradera',
            updated_at: new Date().toISOString(),
          };
          let autoUnpublished = false;
          if (affiliateAutoHandling) {
            updateData.status = 'sold';
            updateData.unpublished_reason = 'affiliate_unavailable';
            autoUnpublished = true;
          }
          await supabase.from('products').update(updateData).eq('id', product.id);
          results.push({
            productId: product.id, productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price, newPrice: product.price,
            status: 'ended', affiliateStatus: 'sold', autoUnpublished,
          });
          continue;
        }

        if (!itemDetails.price || itemDetails.price <= 0) {
          results.push({
            productId: product.id, productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price, newPrice: product.price,
            status: 'error', error: 'Invalid/missing price from Tradera response',
          });
          continue;
        }

        const newPrice = `${Math.round(itemDetails.price)} SEK`;
        const priceChanged = newPrice !== product.price;
        // INVARIANT: Only update availability/status/price fields. Never overwrite editorial content
        // (name, description, name_en, description_en, images, brand, etc.)
        const updateData: Record<string, any> = {
          affiliate_status: 'active',
          affiliate_last_checked_at: new Date().toISOString(),
          affiliate_checked_via: 'tradera',
          updated_at: new Date().toISOString(),
        };
        if (priceChanged) updateData.price = newPrice;
        await supabase.from('products').update(updateData).eq('id', product.id);

        results.push({
          productId: product.id, productName: `${product.brand} - ${product.name}`,
          oldPrice: product.price, newPrice: priceChanged ? newPrice : product.price,
          status: priceChanged ? 'updated' : 'unchanged', affiliateStatus: 'active',
        });
      } catch (e) {
        results.push({
          productId: product.id, productName: `${product.brand} - ${product.name}`,
          oldPrice: product.price, newPrice: product.price,
          status: 'error', error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    // Update cursor
    await setCursor(supabase, 'tradera_sync', cursorAfter);

    const updated = results.filter(r => r.status === 'updated').length;
    const ended = results.filter(r => r.status === 'ended').length;
    const unchanged = results.filter(r => r.status === 'unchanged').length;
    const errors = results.filter(r => r.status === 'error').length;
    const actuallyChecked = results.filter(r => r.status !== 'error').length;

    // Zero-coverage guard: if we processed a batch but checked nothing successfully
    const zeroCoverage = actuallyChecked === 0 && totalProducts > 0;

    const finishedAt = new Date();
    await logCronRun(supabase, {
      job_name: 'tradera_sync', status: zeroCoverage ? 'error' : 'success',
      started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - _startTime,
      items_processed: totalProducts, checked_count: results.length, sold_marked: ended,
      batch_size: MAX_CHECKS_PER_RUN, cursor_before: cursorBefore, cursor_after: cursorAfter,
      ...(zeroCoverage ? { error_message: `zero coverage: ${results.length} attempted, 0 successful (${errors} errors, ${totalProducts} total active)` } : {}),
    });

    return new Response(JSON.stringify({
      message: `Synced ${results.length}/${totalProducts} products (batch ${MAX_CHECKS_PER_RUN})`,
      summary: { total: totalProducts, checked: results.length, updated, ended, unchanged, errors, skippedNoSource },
      cursor: { before: cursorBefore, after: cursorAfter },
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const finishedAt = new Date();
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logCronRun(supabase, {
        job_name: 'tradera_sync', status: 'error',
        started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - _startTime,
        items_processed: 0, checked_count: 0, sold_marked: 0, batch_size: MAX_CHECKS_PER_RUN,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (_) { /* non-blocking */ }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
