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

// Token cache for OAuth access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// ========================================
// RATE LIMITING: In-memory sliding window
// ========================================
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const GLOBAL_MAX_PER_MINUTE = 30;
const IP_MAX_PER_MINUTE = 10;
const SESSION_MAX_PER_MINUTE = 5;

interface RateBucket {
  timestamps: number[];
}

const globalBucket: RateBucket = { timestamps: [] };
const ipBuckets = new Map<string, RateBucket>();
const sessionBuckets = new Map<string, RateBucket>();

function pruneAndCount(bucket: RateBucket, now: number): number {
  bucket.timestamps = bucket.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  return bucket.timestamps.length;
}

function checkAndIncrement(bucket: RateBucket, limit: number, now: number): boolean {
  const count = pruneAndCount(bucket, now);
  if (count >= limit) return false;
  bucket.timestamps.push(now);
  return true;
}

function getOrCreateBucket(map: Map<string, RateBucket>, key: string): RateBucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    map.set(key, bucket);
  }
  return bucket;
}

// Clean up stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipBuckets) {
    if (pruneAndCount(bucket, now) === 0) ipBuckets.delete(key);
  }
  for (const [key, bucket] of sessionBuckets) {
    if (pruneAndCount(bucket, now) === 0) sessionBuckets.delete(key);
  }
}, 300_000);

// ========================================
// INPUT VALIDATION
// ========================================
const ALLOWED_CONDITION_IDS = new Set([
  '1000', '1500', '1750', '2000', '2500', '2750', '3000', '4000', '5000', '6000',
]);

function validateSearchInput(body: any): { valid: true; keywords: string; minPrice?: number; maxPrice?: number; condition?: string } | { valid: false; error: string } {
  const { keywords, minPrice, maxPrice, condition } = body;

  if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
    return { valid: false, error: 'Keywords are required and must be a non-empty string' };
  }

  // Sanitize keywords: max 200 chars, strip control characters
  const sanitizedKeywords = keywords.trim().slice(0, 200).replace(/[\x00-\x1f\x7f]/g, '');
  if (!sanitizedKeywords) {
    return { valid: false, error: 'Keywords contain only invalid characters' };
  }

  let validatedMinPrice: number | undefined;
  if (minPrice !== undefined && minPrice !== null) {
    validatedMinPrice = Number(minPrice);
    if (!Number.isFinite(validatedMinPrice) || validatedMinPrice < 0 || validatedMinPrice > 1_000_000) {
      return { valid: false, error: 'minPrice must be a number between 0 and 1,000,000' };
    }
  }

  let validatedMaxPrice: number | undefined;
  if (maxPrice !== undefined && maxPrice !== null) {
    validatedMaxPrice = Number(maxPrice);
    if (!Number.isFinite(validatedMaxPrice) || validatedMaxPrice < 0 || validatedMaxPrice > 1_000_000) {
      return { valid: false, error: 'maxPrice must be a number between 0 and 1,000,000' };
    }
  }

  if (validatedMinPrice !== undefined && validatedMaxPrice !== undefined && validatedMinPrice > validatedMaxPrice) {
    return { valid: false, error: 'minPrice cannot be greater than maxPrice' };
  }

  let validatedCondition: string | undefined;
  if (condition !== undefined && condition !== null) {
    const condStr = String(condition);
    if (!ALLOWED_CONDITION_IDS.has(condStr)) {
      return { valid: false, error: `Invalid condition ID. Allowed: ${[...ALLOWED_CONDITION_IDS].join(', ')}` };
    }
    validatedCondition = condStr;
  }

  return { valid: true, keywords: sanitizedKeywords, minPrice: validatedMinPrice, maxPrice: validatedMaxPrice, condition: validatedCondition };
}

// ========================================
// AUTH: Verify JWT via getUser + user_roles
// ========================================
async function verifyAdmin(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('ebay-search: auth failed — missing token');
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized: missing token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (token === serviceRoleKey) {
    console.log('ebay-search: auth via service-role key');
    return { authorized: true, userId: 'service-role' };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.log('ebay-search: auth failed — invalid token');
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const userId = user.id;

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey
  );
  const { data: roleData } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    console.log('ebay-search: auth failed — not admin');
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  console.log('ebay-search: auth via jwt (admin)');
  return { authorized: true, userId };
}

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
    '1500': 'new',
    '1750': 'new',
    '2000': 'excellent',
    '2500': 'excellent',
    '2750': 'excellent',
    '3000': 'good',
    '4000': 'good',
    '5000': 'fair',
    '6000': 'fair',
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
  
  console.log('Requesting new eBay OAuth token');
  
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
      
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error === 'invalid_client') {
          return { error: 'Invalid eBay credentials. Please verify your Client ID and Client Secret.' };
        }
        return { error: errorJson.error_description || errorJson.error || 'OAuth token generation failed' };
      } catch (_) {
        return { error: 'OAuth token generation failed' };
      }
    }

    const tokenData = JSON.parse(responseText);
    const expiresIn = tokenData.expires_in || 7200;
    
    // Cache the token
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (expiresIn * 1000),
    };
    
    console.log(`eBay OAuth token obtained (expires in ${expiresIn}s)`);
    return { token: tokenData.access_token };
  } catch (error: any) {
    console.error('eBay OAuth request error:', error.message);
    return { error: `OAuth request failed: ${error.message}` };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ========================================
  // AUTH CHECK: Require authenticated admin
  // ========================================
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ========================================
  // RATE LIMITING
  // ========================================
  const now = Date.now();
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const sessionId = authResult.userId;

  if (!checkAndIncrement(globalBucket, GLOBAL_MAX_PER_MINUTE, now)) {
    return new Response(
      JSON.stringify({ error: 'Global rate limit exceeded. Try again in a minute.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const ipBucket = getOrCreateBucket(ipBuckets, clientIp);
  if (!checkAndIncrement(ipBucket, IP_MAX_PER_MINUTE, now)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests from this IP. Try again in a minute.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const sessionBucket = getOrCreateBucket(sessionBuckets, sessionId);
  if (!checkAndIncrement(sessionBucket, SESSION_MAX_PER_MINUTE, now)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests from this session. Try again in a minute.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check credentials
  const EBAY_CLIENT_ID = Deno.env.get('EBAY_CLIENT_ID') || Deno.env.get('EBAY_APP_ID');
  const EBAY_CLIENT_SECRET = Deno.env.get('EBAY_CLIENT_SECRET') || Deno.env.get('EBAY_CERT_ID');

  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'eBay API credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();

    // ========================================
    // INPUT VALIDATION
    // ========================================
    const validation = validateSearchInput(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keywords, minPrice, maxPrice, condition } = validation;

    // Get OAuth access token (with caching)
    const tokenResult = await getAccessToken(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET);
    
    if ('error' in tokenResult) {
      return new Response(
        JSON.stringify({ error: tokenResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenResult.token;

    // Build search URL
    const searchParams = new URLSearchParams({
      q: keywords,
      limit: '20',
    });

    // Add price filter if provided
    if (minPrice !== undefined || maxPrice !== undefined) {
      if (minPrice !== undefined && maxPrice !== undefined) {
        searchParams.set('filter', `price:[${minPrice}..${maxPrice}],priceCurrency:USD`);
      } else if (minPrice !== undefined) {
        searchParams.set('filter', `price:[${minPrice}..],priceCurrency:USD`);
      } else if (maxPrice !== undefined) {
        searchParams.set('filter', `price:[..${maxPrice}],priceCurrency:USD`);
      }
    }

    // Add condition filter if provided (already validated)
    if (condition) {
      const conditionFilter = `conditionIds:{${condition}}`;
      const currentFilter = searchParams.get('filter') || '';
      searchParams.set('filter', currentFilter ? `${currentFilter},${conditionFilter}` : conditionFilter);
    }

    // Restrict to European item locations + delivery to SE + Fixed Price only
    const locationFilter = `itemLocationCountry:IT`;
    const deliveryFilter = `deliveryCountry:SE`;
    const buyingOptionsFilter = `buyingOptions:{FIXED_PRICE}`;
    const existingFilter = searchParams.get('filter') || '';
    const combinedFilter = [existingFilter, locationFilter, deliveryFilter, buyingOptionsFilter].filter(Boolean).join(',');
    searchParams.set('filter', combinedFilter);

    const baseUrl = getEbayBaseUrl();
    const searchUrl = `${baseUrl}/buy/browse/v1/item_summary/search?${searchParams.toString()}`;
    console.log('eBay search URL constructed (params count:', searchParams.toString().split('&').length, ')');

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB',
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('eBay search error:', searchResponse.status);
      return new Response(
        JSON.stringify({ error: 'eBay search failed', status: searchResponse.status }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.total || 0} items`);

    // Normalize eBay image URLs to high-resolution versions
    function normalizeImageUrl(url: string): string {
      if (!url) return url;
      if (!url.includes('i.ebayimg.com')) return url;
      return url.replace(/s-l(64|140|225|300|400|500)\b/gi, 's-l1600');
    }

    // Map eBay items to AIS format
    const items = (searchData.itemSummaries || []).map((item: any) => {
      const images: string[] = [];
      
      if (item.additionalImages && item.additionalImages.length > 0) {
        for (const img of item.additionalImages) {
          if (img.imageUrl) {
            images.push(normalizeImageUrl(img.imageUrl));
          }
        }
      }
      
      if (item.image?.imageUrl) {
        const mainImageUrl = normalizeImageUrl(item.image.imageUrl);
        if (!images.includes(mainImageUrl)) {
          images.unshift(mainImageUrl);
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
        affiliateUrl: item.itemWebUrl || null,
        keywords: extractKeywords(item.title),
      };
    });

    return new Response(
      JSON.stringify({ items, total: searchData.total || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('eBay search error:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});