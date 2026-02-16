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
    console.log('tradera-sync: auth failed — missing token');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Allow service-role key directly (used by pg_cron)
  if (token === serviceRoleKey) {
    console.log('tradera-sync: auth via service-role key');
    return { authorized: true, userId: 'service-role' };
  }

  // Otherwise, verify as admin user JWT via getUser
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.log('tradera-sync: auth failed — invalid token');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const userId = user.id;
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    console.log('tradera-sync: auth failed — not admin');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  console.log('tradera-sync: auth via jwt (admin)');
  return { authorized: true, userId };
}

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdminOrServiceRole(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appId = Deno.env.get('TRADERA_APP_ID');
    const appKey = Deno.env.get('TRADERA_APP_KEY');

    if (!appId || !appKey) {
      console.error('Missing Tradera credentials');
      return new Response(
        JSON.stringify({ error: 'Tradera API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active Tradera products (include new affiliate fields)
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, brand, price, affiliate_url, tradera_item_id, affiliate_auto_handling, affiliate_status')
      .eq('marketplace', 'Tradera')
      .in('status', ['active', 'published']);

    if (fetchError) {
      console.error('Error fetching products:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!products || products.length === 0) {
      console.log('No active Tradera products found');
      return new Response(
        JSON.stringify({ message: 'No active Tradera products to sync', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${products.length} active Tradera products to sync`);
    
    // ========================================
    // THROTTLING: Max 1 request at a time, 2.5s delay between calls
    // Fail-fast on 429 (no retries)
    // ========================================
    const THROTTLE_DELAY_MS = 2500;

    const results: TraderaSyncResult[] = [];

    for (const product of products) {
      // Prefer explicit tradera_item_id when present; fall back to parsing affiliate_url.
      const itemId = product.tradera_item_id || extractItemId(product.affiliate_url);
      
      if (!itemId) {
        console.log(`Could not extract item ID for product ${product.id}`);
        results.push({
          productId: product.id,
          productName: `${product.brand} - ${product.name}`,
          oldPrice: product.price,
          newPrice: product.price,
          status: 'error',
          error: 'Could not extract Tradera item ID from URL',
        });
        continue;
      }

      // Throttle: wait before each API call (except first)
      if (results.length > 0) {
        console.log(`Throttling: waiting ${THROTTLE_DELAY_MS}ms before next call...`);
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY_MS));
      }

      try {
        // Fetch item details from Tradera API (fail-fast on 429)
        const itemDetails = await fetchTraderaItem(itemId, appId, appKey);
        
        if (itemDetails === null) {
          console.log(`Item ${itemId} not found or error`);
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: product.price,
            status: 'error',
            error: 'Could not fetch item from Tradera',
          });
          continue;
        }
        
        // Check if rate limited - stop processing entirely
        if (itemDetails.rateLimited) {
          console.warn(`Rate limited on item ${itemId} - stopping sync to avoid further 429s`);
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: product.price,
            status: 'error',
            error: 'Tradera rate limited (429) - sync stopped',
          });
          // Stop processing more items when rate limited
          break;
        }

        // Check if auction has ended
        if (itemDetails.hasEnded) {
          console.log(`Auction ended for item ${itemId}, updating affiliate status to 'sold'`);
          
          const affiliateAutoHandling = product.affiliate_auto_handling !== false; // default true
          const updateData: Record<string, any> = {
            affiliate_status: 'sold',
            affiliate_last_checked_at: new Date().toISOString(),
            affiliate_checked_via: 'tradera',
            updated_at: new Date().toISOString(),
          };
          
          // Auto-unpublish if enabled
          let autoUnpublished = false;
          if (affiliateAutoHandling) {
            updateData.status = 'sold';
            updateData.unpublished_reason = 'affiliate_unavailable';
            autoUnpublished = true;
          }
          
          await supabase
            .from('products')
            .update(updateData)
            .eq('id', product.id);
          
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: product.price,
            status: 'ended',
            affiliateStatus: 'sold',
            autoUnpublished,
          });
          continue;
        }

        // If we couldn't parse a valid price, do NOT overwrite the existing price.
        // This prevents accidentally resetting manually set prices to "0 SEK".
        if (!itemDetails.price || itemDetails.price <= 0) {
          console.warn(
            `Invalid price from Tradera for item ${itemId} (product ${product.id}) - skipping price update`,
          );
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: product.price,
            status: 'error',
            error: 'Invalid/missing price from Tradera response (skipped to avoid overwriting with 0 SEK)',
          });
          continue;
        }

        // Format new price
        const newPrice = `${Math.round(itemDetails.price)} SEK`;
        const priceChanged = newPrice !== product.price;
        
        // Update product with affiliate status and optionally price
        const updateData: Record<string, any> = {
          affiliate_status: 'active',
          affiliate_last_checked_at: new Date().toISOString(),
          affiliate_checked_via: 'tradera',
          updated_at: new Date().toISOString(),
        };
        
        if (priceChanged) {
          console.log(`Price changed for ${product.id}: ${product.price} -> ${newPrice}`);
          updateData.price = newPrice;
        }
        
        await supabase
          .from('products')
          .update(updateData)
          .eq('id', product.id);
        
        results.push({
          productId: product.id,
          productName: `${product.brand} - ${product.name}`,
          oldPrice: product.price,
          newPrice: priceChanged ? newPrice : product.price,
          status: priceChanged ? 'updated' : 'unchanged',
          affiliateStatus: 'active',
        });
      } catch (e) {
        console.error(`Error processing item ${itemId}:`, e);
        results.push({
          productId: product.id,
          productName: `${product.brand} - ${product.name}`,
          oldPrice: product.price,
          newPrice: product.price,
          status: 'error',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const ended = results.filter(r => r.status === 'ended').length;
    const unchanged = results.filter(r => r.status === 'unchanged').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`Sync complete: ${updated} updated, ${ended} ended, ${unchanged} unchanged, ${errors} errors`);

    // Log cron run
    try {
      await supabase.from('cron_runs').insert({ job_name: 'tradera_sync', status: 'success' });
    } catch (_) { /* non-blocking */ }

    return new Response(
      JSON.stringify({
        message: `Synced ${products.length} products`,
        summary: { updated, ended, unchanged, errors },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tradera-sync:', error);
    // Log cron failure
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await supabase.from('cron_runs').insert({ job_name: 'tradera_sync', status: 'error', error_message: error instanceof Error ? error.message : 'Unknown error' });
    } catch (_) { /* non-blocking */ }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractItemId(url: string | null): string | null {
  if (!url) return null;

  // Tradera commonly uses URLs like:
  // - https://www.tradera.com/item/<categoryId>/<itemId>/<slug>
  // - https://www.tradera.com/item/<itemId>
  // Our old regex accidentally captured <categoryId>, leading to bad lookups and "0 SEK" overwrites.
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
    console.log(`Fetching item ${itemId} (single request, no retries)`);
    
    const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/GetItem',
      },
      body: soapEnvelope,
    });

    // Fail-fast on 429 - no retries
    if (response.status === 429) {
      console.warn(`Tradera GetItem returned 429 for item ${itemId} - fail fast, no retry`);
      return { price: 0, hasEnded: false, rateLimited: true };
    }

    if (!response.ok) {
      console.error(`Tradera API error for item ${itemId}:`, response.status);
      return null;
    }

    const xml = await response.text();
    
    // Check if item has ended
    const hasEnded = checkIfEnded(xml);
    
    // Extract current price (MaxBid for auctions, BuyItNowPrice for fixed price)
    const price = extractNumber(xml, 'MaxBid') || 
                  extractNumber(xml, 'NextBid') ||
                  extractNumber(xml, 'BuyItNowPrice') || 
                  extractNumber(xml, 'Price') || 0;

    return { price, hasEnded };
  } catch (e) {
    console.error(`Error fetching Tradera item ${itemId}:`, e);
    return null;
  }
}

function checkIfEnded(xml: string): boolean {
  // Check for ItemStatus or EndDate
  const statusMatch = xml.match(/<ItemStatus>(.*?)<\/ItemStatus>/i);
  if (statusMatch) {
    const status = statusMatch[1].toLowerCase();
    if (status === 'ended' || status === 'sold' || status === 'closed') {
      return true;
    }
  }
  
  // Check EndDate against current time
  const endDateMatch = xml.match(/<EndDate>(.*?)<\/EndDate>/i);
  if (endDateMatch) {
    try {
      const endDate = new Date(endDateMatch[1]);
      if (endDate < new Date()) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  return false;
}

function extractNumber(xml: string, tag: string): number | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
  if (!match) return undefined;
  const num = parseFloat(match[1].trim());
  return isNaN(num) ? undefined : num;
}
