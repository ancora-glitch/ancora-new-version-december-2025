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
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Allow service-role key directly (used by pg_cron)
  if (token === serviceRoleKey) {
    console.log('Auth: service-role key accepted (cron job)');
    return { authorized: true, userId: 'service-role' };
  }

  // Otherwise, verify as admin user JWT
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const userId = data.claims.sub as string;
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { authorized: true, userId };
}

type AffiliateStatus = 'active' | 'sold' | 'unavailable' | 'unknown';

interface AvailabilityResult {
  productId: string;
  productName: string;
  affiliateStatus: AffiliateStatus;
  autoUnpublished: boolean;
  error?: string;
}

// Token cache for OAuth access token
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
      const errorText = await response.text();
      console.error('eBay OAuth failed:', response.status, errorText);
      return { error: 'OAuth token generation failed' };
    }

    const tokenData = await response.json();
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + ((tokenData.expires_in || 7200) * 1000),
    };
    
    return { token: tokenData.access_token };
  } catch (error: any) {
    console.error('eBay OAuth error:', error.message);
    return { error: error.message };
  }
}

// Extract eBay item ID from various URL formats
function extractEbayItemId(url: string | null): string | null {
  if (!url) return null;
  
  // Pattern: /itm/123456789 or /itm/title/123456789
  const itmMatch = url.match(/\/itm\/(?:[^/]+\/)?(\d{10,15})/i);
  if (itmMatch?.[1]) return itmMatch[1];
  
  // Pattern: ?item=123456789 or itemId=123456789
  const queryMatch = url.match(/[?&](?:item|itemId)=(\d{10,15})/i);
  if (queryMatch?.[1]) return queryMatch[1];
  
  return null;
}

// Check item availability using eBay Browse API
async function checkEbayItemAvailability(
  itemId: string, 
  accessToken: string
): Promise<{ status: AffiliateStatus; error?: string }> {
  const baseUrl = getEbayBaseUrl();
  // Use the getItem endpoint for full item details
  const itemUrl = `${baseUrl}/buy/browse/v1/item/v1|${itemId}|0`;
  
  try {
    console.log(`Checking eBay item: ${itemId}`);
    
    const response = await fetch(itemUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    });

    // 404 = item not found / removed
    if (response.status === 404) {
      console.log(`eBay item ${itemId} not found (404)`);
      return { status: 'unavailable' };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`eBay getItem error for ${itemId}:`, response.status, errorText);
      return { status: 'unknown', error: `API error: ${response.status}` };
    }

    const item = await response.json();
    
    // Check item state indicators
    // itemEndDate in the past = ended
    if (item.itemEndDate) {
      const endDate = new Date(item.itemEndDate);
      if (endDate < new Date()) {
        console.log(`eBay item ${itemId} has ended (past endDate)`);
        return { status: 'sold' };
      }
    }
    
    // Check availability status
    // estimatedAvailabilities array can indicate out of stock
    if (item.estimatedAvailabilities) {
      for (const avail of item.estimatedAvailabilities) {
        if (avail.availabilityStatus === 'OUT_OF_STOCK') {
          console.log(`eBay item ${itemId} is out of stock`);
          return { status: 'sold' };
        }
        if (avail.estimatedAvailableQuantity === 0) {
          console.log(`eBay item ${itemId} has 0 quantity`);
          return { status: 'sold' };
        }
      }
    }
    
    // Check bidding info for auctions
    if (item.currentBidPrice && item.biddingInfo?.auctionStatus === 'ENDED') {
      console.log(`eBay auction ${itemId} has ended`);
      return { status: 'sold' };
    }
    
    // Item appears active
    console.log(`eBay item ${itemId} is active`);
    return { status: 'active' };
    
  } catch (error: any) {
    console.error(`Error checking eBay item ${itemId}:`, error.message);
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID') || Deno.env.get('EBAY_APP_ID');
    const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET') || Deno.env.get('EBAY_CERT_ID');

    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
      console.error('Missing eBay credentials');
      return new Response(
        JSON.stringify({ error: 'eBay API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OAuth token first
    const tokenResult = await getAccessToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);
    if ('error' in tokenResult) {
      return new Response(
        JSON.stringify({ error: tokenResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const accessToken = tokenResult.token;

    // Fetch all active eBay products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, brand, affiliate_url, affiliate_auto_handling, affiliate_status')
      .ilike('marketplace', '%ebay%')
      .in('status', ['active', 'published']);

    if (fetchError) {
      console.error('Error fetching products:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!products || products.length === 0) {
      console.log('No active eBay products found');
      return new Response(
        JSON.stringify({ message: 'No active eBay products to check', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${products.length} active eBay products to check`);
    
    const THROTTLE_DELAY_MS = 500; // eBay has higher rate limits than Tradera
    const results: AvailabilityResult[] = [];

    for (const product of products) {
      const itemId = extractEbayItemId(product.affiliate_url);
      
      if (!itemId) {
        console.log(`Could not extract eBay item ID for product ${product.id}`);
        results.push({
          productId: product.id,
          productName: `${product.brand} - ${product.name}`,
          affiliateStatus: 'unknown',
          autoUnpublished: false,
          error: 'Could not extract eBay item ID from URL',
        });
        continue;
      }

      // Throttle requests
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
      
      // Auto-unpublish if status is not active and auto-handling is enabled
      if (availability.status !== 'active' && availability.status !== 'unknown' && affiliateAutoHandling) {
        updateData.status = 'sold';
        updateData.unpublished_reason = 'affiliate_unavailable';
        autoUnpublished = true;
        console.log(`Auto-unpublishing product ${product.id} (eBay item ${itemId} is ${availability.status})`);
      }
      
      await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);
      
      results.push({
        productId: product.id,
        productName: `${product.brand} - ${product.name}`,
        affiliateStatus: availability.status,
        autoUnpublished,
        error: availability.error,
      });
    }

    const active = results.filter(r => r.affiliateStatus === 'active').length;
    const sold = results.filter(r => r.affiliateStatus === 'sold').length;
    const unavailable = results.filter(r => r.affiliateStatus === 'unavailable').length;
    const unknown = results.filter(r => r.affiliateStatus === 'unknown').length;
    const unpublished = results.filter(r => r.autoUnpublished).length;

    console.log(`eBay check complete: ${active} active, ${sold} sold, ${unavailable} unavailable, ${unknown} unknown, ${unpublished} auto-unpublished`);

    return new Response(
      JSON.stringify({
        message: `Checked ${products.length} eBay products`,
        summary: { active, sold, unavailable, unknown, unpublished },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ebay-availability:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
