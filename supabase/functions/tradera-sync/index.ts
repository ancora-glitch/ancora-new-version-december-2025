import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TraderaSyncResult {
  productId: string;
  productName: string;
  oldPrice: string;
  newPrice: string;
  status: 'updated' | 'ended' | 'unchanged' | 'error';
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Fetch all active Tradera products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, brand, price, affiliate_url, tradera_item_id')
      .eq('marketplace', 'Tradera')
      .eq('status', 'active');

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
          console.log(`Auction ended for item ${itemId}, marking as sold`);
          await supabase
            .from('products')
            .update({ status: 'sold', updated_at: new Date().toISOString() })
            .eq('id', product.id);
          
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: product.price,
            status: 'ended',
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
        if (newPrice !== product.price) {
          console.log(`Price changed for ${product.id}: ${product.price} -> ${newPrice}`);
          await supabase
            .from('products')
            .update({ price: newPrice, updated_at: new Date().toISOString() })
            .eq('id', product.id);
          
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: newPrice,
            status: 'updated',
          });
        } else {
          results.push({
            productId: product.id,
            productName: `${product.brand} - ${product.name}`,
            oldPrice: product.price,
            newPrice: newPrice,
            status: 'unchanged',
          });
        }
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
