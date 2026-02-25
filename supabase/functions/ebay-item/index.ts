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

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function verifyAdmin(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
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

function getEbayBaseUrl(): string {
  const env = Deno.env.get('EBAY_ENV') || 'production';
  return env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<{ token: string } | { error: string }> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return { token: cachedToken.token };
  }
  const baseUrl = getEbayBaseUrl();
  const credentials = btoa(`${clientId}:${clientSecret}`);
  try {
    const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
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
    const expiresIn = tokenData.expires_in || 7200;
    cachedToken = { token: tokenData.access_token, expiresAt: now + (expiresIn * 1000) };
    return { token: tokenData.access_token };
  } catch (error: any) {
    return { error: `OAuth request failed: ${error.message}` };
  }
}

function normalizeImageUrl(url: string): string {
  if (!url) return url;
  if (!url.includes('i.ebayimg.com')) return url;
  return url.replace(/s-l(64|140|225|300|400|500)\b/gi, 's-l1600');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID') || Deno.env.get('EBAY_APP_ID');
  const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET') || Deno.env.get('EBAY_CERT_ID');
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'eBay API credentials not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { itemId } = await req.json();
    if (!itemId || typeof itemId !== 'string') {
      return new Response(JSON.stringify({ error: 'itemId is required (string)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tokenResult = await getAccessToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);
    if ('error' in tokenResult) {
      return new Response(JSON.stringify({ error: tokenResult.error }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseUrl = getEbayBaseUrl();
    // Use Browse API getItem - encode the itemId (format: v1|xxxx|0)
    const encodedId = encodeURIComponent(itemId);
    const itemUrl = `${baseUrl}/buy/browse/v1/item/${encodedId}`;
    
    console.log(`ebay-item: fetching ${itemId}`);

    const response = await fetch(itemUrl, {
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`ebay-item: API error ${response.status}:`, errText.substring(0, 200));
      return new Response(JSON.stringify({ 
        item: null, 
        error: `eBay API error: ${response.status}` 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();

    // Extract images
    const images: string[] = [];
    if (data.image?.imageUrl) {
      images.push(normalizeImageUrl(data.image.imageUrl));
    }
    if (data.additionalImages) {
      for (const img of data.additionalImages) {
        if (img.imageUrl) {
          const url = normalizeImageUrl(img.imageUrl);
          if (!images.includes(url)) images.push(url);
        }
      }
    }

    // Extract description - try multiple fields
    const description = data.description || data.shortDescription || null;
    
    // Strip HTML from description if present
    let cleanDescription = description;
    if (cleanDescription) {
      cleanDescription = cleanDescription
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }

    const item = {
      itemId: data.itemId,
      title: data.title,
      description: cleanDescription,
      shortDescription: data.shortDescription || null,
      price: data.price?.value ? parseFloat(data.price.value) : null,
      currency: data.price?.currency || 'USD',
      condition: data.conditionId,
      conditionText: data.condition || null,
      brand: data.brand || null,
      color: data.color || null,
      size: data.size || null,
      material: data.material || null,
      seller: data.seller?.username || null,
      itemUrl: data.itemWebUrl || null,
      affiliateUrl: data.itemAffiliateWebUrl || data.itemWebUrl || null,
      images,
      categoryPath: data.categoryPath || null,
      itemLocation: data.itemLocation ? `${data.itemLocation.city || ''}, ${data.itemLocation.country || ''}`.replace(/^, |, $/, '') : null,
    };

    console.log(`ebay-item: got ${item.title?.substring(0, 50)}, desc=${!!item.description}, images=${images.length}`);

    return new Response(
      JSON.stringify({ item }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('ebay-item error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
