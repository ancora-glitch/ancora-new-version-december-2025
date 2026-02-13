import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token cache for OAuth access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get eBay API base URL based on environment
function getEbayBaseUrl(): string {
  const env = Deno.env.get('EBAY_ENV') || 'production';
  return env === 'sandbox' 
    ? 'https://api.sandbox.ebay.com' 
    : 'https://api.ebay.com';
}

// eBay condition ID to AIS condition mapping
function mapCondition(conditionId: string | undefined): string {
  const map: Record<string, string> = {
    '1000': 'new',
    '1500': 'new', // New other
    '1750': 'new', // New with defects
    '2000': 'excellent', // Certified refurbished
    '2500': 'excellent', // Seller refurbished
    '2750': 'excellent', // Like new
    '3000': 'good', // Used
    '4000': 'good', // Very good
    '5000': 'fair', // Good
    '6000': 'fair', // Acceptable
  };
  return map[conditionId || ''] || 'unknown';
}

// Extract keywords from title
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where',
    'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now',
    'size', 'new', 'used', 'vintage', 'pre', 'owned'
  ]);
  
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10);
}

// Get OAuth access token with caching
async function getAccessToken(clientId: string, clientSecret: string): Promise<{ token: string } | { error: string }> {
  const now = Date.now();
  
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    console.log('Using cached eBay OAuth token');
    return { token: cachedToken.token };
  }

  const baseUrl = getEbayBaseUrl();
  const tokenUrl = `${baseUrl}/identity/v1/oauth2/token`;
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  console.log(`Requesting eBay OAuth token from ${tokenUrl}`);
  console.log('Scope: https://api.ebay.com/oauth/api_scope');
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('eBay OAuth token generation failed:', response.status);
      console.error('Response:', responseText);
      
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error === 'invalid_client') {
          console.error('CRITICAL: Invalid eBay credentials. Verify EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are from Production keyset.');
          return { error: 'Invalid eBay credentials. Please verify your Client ID and Client Secret from the eBay Developer Portal (Production keyset).' };
        }
        return { error: errorJson.error_description || errorJson.error || 'OAuth token generation failed' };
      } catch (_) {
        return { error: 'OAuth token generation failed' };
      }
    }

    const tokenData = JSON.parse(responseText);
    const expiresIn = tokenData.expires_in || 7200; // Default 2 hours
    
    // Cache the token
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (expiresIn * 1000),
    };
    
    console.log(`Successfully obtained eBay OAuth token (expires in ${expiresIn}s)`);
    return { token: tokenData.access_token };
  } catch (error: any) {
    console.error('eBay OAuth token request error:', error.message);
    return { error: `OAuth request failed: ${error.message}` };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check credentials on every request (fail fast)
  const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID') || Deno.env.get('EBAY_APP_ID');
  const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET') || Deno.env.get('EBAY_CERT_ID');
  const EBAY_ENV = Deno.env.get('EBAY_ENV') || 'production';

  console.log(`eBay environment: ${EBAY_ENV}`);

  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    console.error('eBay credentials missing – search disabled');
    return new Response(
      JSON.stringify({ error: 'eBay API credentials not configured. Please add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { keywords, minPrice, maxPrice, condition } = await req.json();

    if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
      return new Response(
        JSON.stringify({ error: 'Keywords are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth access token (with caching)
    const tokenResult = await getAccessToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);
    
    if ('error' in tokenResult) {
      console.error('eBay OAuth token generation failed – aborting search');
      return new Response(
        JSON.stringify({ error: tokenResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenResult.token;

    // Build search URL
    const searchParams = new URLSearchParams({
      q: keywords.trim(),
      limit: '20',
    });

    // Add price filter if provided
    if (minPrice || maxPrice) {
      const priceFilter = [];
      if (minPrice) priceFilter.push(`price:[${minPrice}]`);
      if (maxPrice) priceFilter.push(`price:[..${maxPrice}]`);
      if (minPrice && maxPrice) {
        searchParams.set('filter', `price:[${minPrice}..${maxPrice}],priceCurrency:USD`);
      } else if (minPrice) {
        searchParams.set('filter', `price:[${minPrice}..],priceCurrency:USD`);
      } else if (maxPrice) {
        searchParams.set('filter', `price:[..${maxPrice}],priceCurrency:USD`);
      }
    }

    // Add condition filter if provided
    if (condition) {
      const conditionFilter = `conditionIds:{${condition}}`;
      const currentFilter = searchParams.get('filter') || '';
      searchParams.set('filter', currentFilter ? `${currentFilter},${conditionFilter}` : conditionFilter);
    }

    // Restrict to European item locations
    const euroCountries = 'DE,GB,FR,IT,ES,SE,NL,AT,BE,DK,FI,IE,PL,PT,CZ,GR,HU,RO,NO,CH';
    const locationFilter = `itemLocationCountry:{${euroCountries}}`;
    const existingFilter = searchParams.get('filter') || '';
    searchParams.set('filter', existingFilter ? `${existingFilter},${locationFilter}` : locationFilter);

    const baseUrl = getEbayBaseUrl();
    const searchUrl = `${baseUrl}/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
    console.log('Searching eBay:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE',
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('eBay search error:', searchResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'eBay search failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.total || 0} items`);

    // Normalize eBay image URLs to high-resolution versions
    // eBay uses size params like s-l64, s-l140, s-l225 for thumbnails
    // Replace with s-l1600 for high-res images
    function normalizeImageUrl(url: string): string {
      if (!url) return url;
      // Only normalize eBay image URLs (i.ebayimg.com domain)
      if (!url.includes('i.ebayimg.com')) return url;
      // Replace common eBay thumbnail size patterns with high-res version
      return url.replace(/s-l(64|140|225|300|400|500)\b/gi, 's-l1600');
    }

    // Map eBay items to AIS format
    const items = (searchData.itemSummaries || []).map((item: any) => {
      // Collect all images - prefer additionalImages (usually higher quality)
      const images: string[] = [];
      
      // First add additionalImages if available (often better quality)
      if (item.additionalImages && item.additionalImages.length > 0) {
        for (const img of item.additionalImages) {
          if (img.imageUrl) {
            images.push(normalizeImageUrl(img.imageUrl));
          }
        }
      }
      
      // Then add main image (may be the same or a thumbnail)
      if (item.image?.imageUrl) {
        const mainImageUrl = normalizeImageUrl(item.image.imageUrl);
        // Only add if not already in the list
        if (!images.includes(mainImageUrl)) {
          images.unshift(mainImageUrl); // Put main image first
        }
      }

      return {
        itemId: item.itemId,
        title: item.title,
        images,
        price: item.price?.value ? parseFloat(item.price.value) : null,
        currency: item.price?.currency || 'USD',
        condition: mapCondition(item.conditionId),
        conditionText: item.condition || null,
        seller: item.seller?.username || null,
        itemUrl: item.itemWebUrl || null,
        affiliateUrl: item.itemWebUrl || null, // For purchase link
        keywords: extractKeywords(item.title),
      };
    });

    return new Response(
      JSON.stringify({ items, total: searchData.total || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('eBay search error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
