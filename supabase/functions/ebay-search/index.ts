import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { keywords, minPrice, maxPrice, condition } = await req.json();

    if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
      return new Response(
        JSON.stringify({ error: 'Keywords are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const EBAY_APP_ID = Deno.env.get('EBAY_APP_ID');
    const EBAY_CERT_ID = Deno.env.get('EBAY_CERT_ID');

    if (!EBAY_APP_ID || !EBAY_CERT_ID) {
      console.error('Missing eBay credentials');
      return new Response(
        JSON.stringify({ error: 'eBay API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth token using client credentials
    console.log('Requesting eBay OAuth token...');
    const credentials = btoa(`${EBAY_APP_ID}:${EBAY_CERT_ID}`);
    const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('eBay token error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with eBay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Got eBay access token');

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
      const currentFilter = searchParams.get('filter') || '';
      const conditionFilter = `conditionIds:{${condition}}`;
      searchParams.set('filter', currentFilter ? `${currentFilter},${conditionFilter}` : conditionFilter);
    }

    const searchUrl = `https://api.ebay.com/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
    console.log('Searching eBay:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
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

    // Map eBay items to AIS format
    const items = (searchData.itemSummaries || []).map((item: any) => {
      // Collect all images
      const images: string[] = [];
      if (item.image?.imageUrl) {
        images.push(item.image.imageUrl);
      }
      if (item.additionalImages) {
        for (const img of item.additionalImages) {
          if (img.imageUrl) {
            images.push(img.imageUrl);
          }
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
