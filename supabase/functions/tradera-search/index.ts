import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

const DAILY_LIMIT = 75;

// ========================================
// INPUT VALIDATION
// ========================================
function validateSearchInput(body: any): { valid: true; keywords?: string; categoryId?: number; checkUsageOnly?: boolean } | { valid: false; error: string } {
  const { keywords, categoryId, checkUsageOnly } = body;

  if (checkUsageOnly === true) {
    return { valid: true, checkUsageOnly: true };
  }

  if (keywords !== undefined && keywords !== null) {
    if (typeof keywords !== 'string') {
      return { valid: false, error: 'Keywords must be a string' };
    }
    // Max 200 chars, strip control characters
    const sanitized = keywords.trim().slice(0, 200).replace(/[\x00-\x1f\x7f]/g, '');
    if (sanitized.length === 0 && !categoryId) {
      return { valid: false, error: 'Keywords or categoryId is required' };
    }
  }

  if (categoryId !== undefined && categoryId !== null) {
    const catNum = Number(categoryId);
    if (!Number.isFinite(catNum) || catNum < 0 || catNum > 999999 || !Number.isInteger(catNum)) {
      return { valid: false, error: 'categoryId must be a positive integer' };
    }
  }

  return {
    valid: true,
    keywords: keywords ? String(keywords).trim().slice(0, 200).replace(/[\x00-\x1f\x7f]/g, '') : undefined,
    categoryId: categoryId !== undefined && categoryId !== null ? Math.floor(Number(categoryId)) : undefined,
  };
}

// ========================================
// AUTH: Verify JWT via getClaims
// ========================================
async function verifyAdmin(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized: missing token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const userId = data.claims.sub as string;

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: roleData } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  return { authorized: true, userId };
}

interface TraderaSearchParams {
  keywords?: string;
  categoryId?: number;
  priceMin?: number;
  priceMax?: number;
}

interface TraderaItem {
  id: number;
  shortDescription: string;
  longDescription?: string;
  price: number;
  buyItNowPrice?: number;
  thumbnailLink?: string;
  imageLinks?: string[];
  itemLink: string;
  categoryId: number;
  sellerId: number;
  sellerAlias?: string;
  endDate?: string;
  bids?: number;
  condition?: string;
  brandName?: string;
}

interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  daily_limit: number;
  remaining?: number;
  message?: string;
}

interface UsageResult {
  current_count: number;
  daily_limit: number;
  remaining: number;
  limit_reached: boolean;
}

// Create Supabase client with service role for cache/usage tracking
function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey);
}

// Check cache for existing results
async function checkCache(supabase: ReturnType<typeof createClient>, cacheKey: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('tradera_cache')
    .select('raw_payload, fetched_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('Cache check error:', error);
    return null;
  }

  if (data) {
    console.log(`Cache HIT for ${cacheKey}`);
    return data.raw_payload;
  }

  console.log(`Cache MISS for ${cacheKey}`);
  return null;
}

// Store result in cache
async function storeCache(supabase: ReturnType<typeof createClient>, cacheKey: string, cacheType: string, payload: any) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { error } = await supabase
    .from('tradera_cache')
    .upsert({
      cache_key: cacheKey,
      cache_type: cacheType,
      raw_payload: payload,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'cache_key' });

  if (error) {
    console.error('Cache store error:', error);
  }
}

// Check and increment rate limit
async function checkRateLimit(supabase: ReturnType<typeof createClient>): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('tradera_increment_usage', { daily_limit: DAILY_LIMIT });

  if (error) {
    console.error('Rate limit check error:', error);
    return {
      allowed: false,
      current_count: 0,
      daily_limit: DAILY_LIMIT,
      message: 'Could not verify API quota'
    };
  }

  return data as RateLimitResult;
}

// Get current usage without incrementing
async function getCurrentUsage(supabase: ReturnType<typeof createClient>): Promise<UsageResult> {
  const { data, error } = await supabase.rpc('tradera_get_usage');

  if (error) {
    console.error('Usage check error:', error);
    return { current_count: 0, daily_limit: DAILY_LIMIT, remaining: DAILY_LIMIT, limit_reached: false };
  }

  return data as UsageResult;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // AUTH CHECK: Require authenticated admin
  // ========================================
  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const supabase = getSupabaseClient();

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

    // If just checking usage, return without incrementing
    if (validation.checkUsageOnly) {
      const usage = await getCurrentUsage(supabase);
      return new Response(
        JSON.stringify({ usage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keywords, categoryId } = validation;

    const appId = Deno.env.get('TRADERA_APP_ID');
    const appKey = Deno.env.get('TRADERA_APP_KEY');

    if (!appId || !appKey) {
      return new Response(
        JSON.stringify({ error: 'Tradera API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== TRADERA SEARCH (RATE LIMITED) ===');

    // Generate cache key
    const cacheKey = `search:${keywords || ''}:${categoryId || 0}`;

    // Check cache first
    const cachedResult = await checkCache(supabase, cacheKey);
    if (cachedResult) {
      const usage = await getCurrentUsage(supabase);
      return new Response(
        JSON.stringify({ 
          ...cachedResult,
          fromCache: true,
          usage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit BEFORE making API call
    const rateLimitResult = await checkRateLimit(supabase);
    
    if (!rateLimitResult.allowed) {
      console.log('RATE LIMIT EXCEEDED:', rateLimitResult.current_count);
      return new Response(
        JSON.stringify({ 
          error: 'rate_limit_exceeded',
          message: rateLimitResult.message || 'Tradera API quota reached for today.',
          usage: {
            current_count: rateLimitResult.current_count,
            daily_limit: rateLimitResult.daily_limit,
            remaining: 0,
            limit_reached: true
          }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Rate limit OK: ${rateLimitResult.current_count}/${rateLimitResult.daily_limit}`);

    // Make the actual API call
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
    <Search xmlns="http://api.tradera.com">
      <query>${escapeXml(keywords || '')}</query>
      <categoryId>${categoryId || 0}</categoryId>
      <pageNumber>1</pageNumber>
      <orderBy>Relevance</orderBy>
    </Search>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch('https://api.tradera.com/v3/SearchService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/Search',
      },
      body: soapEnvelope,
    });

    const xmlText = await response.text();

    if (!response.ok) {
      console.error('Tradera API error:', response.status);
      return new Response(
        JSON.stringify({ 
          error: 'Tradera API error',
          usage: {
            current_count: rateLimitResult.current_count,
            daily_limit: rateLimitResult.daily_limit,
            remaining: rateLimitResult.remaining,
            limit_reached: false
          }
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for SOAP errors
    if (xmlText.includes('<Errors>')) {
      const errorCode = extractText(xmlText, 'Code');
      const errorMessage = extractText(xmlText, 'Message');
      console.error('SOAP error:', errorCode);
      return new Response(
        JSON.stringify({ 
          error: errorMessage || 'Tradera API error', 
          code: errorCode,
          usage: {
            current_count: rateLimitResult.current_count,
            daily_limit: rateLimitResult.daily_limit,
            remaining: rateLimitResult.remaining,
            limit_reached: false
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the XML response
    const allItems = parseTraderaResponse(xmlText);
    
    // Filter: only keep listings with a Buy It Now price (includes auction+BIN combos)
    const items = allItems.filter(item => item.buyItNowPrice && item.buyItNowPrice > 0);
    
    console.log(`Parsed ${allItems.length} items, ${items.length} with Buy It Now`);

    const result = { 
      items, 
      total: items.length,
    };

    // Cache the successful result
    await storeCache(supabase, cacheKey, 'search', result);

    // Get updated usage for response
    const usage = await getCurrentUsage(supabase);

    return new Response(
      JSON.stringify({ 
        ...result,
        fromCache: false,
        usage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractImageIdentifier(url: string): string {
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const cleanPath = pathname
      .replace(/^\/(minithumb|thumbs|thumb|medium|images|normal)\//gi, "/img/")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
    return cleanPath.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isHighResVersion(url: string): boolean {
  if (url.includes('/images/') || url.includes('/normal/')) return true;
  if (url.includes('/medium/')) return false;
  if (url.includes('/thumbs/') || url.includes('/minithumb/')) return false;
  return true;
}

function deduplicateAndSelectBest(urls: string[]): string[] {
  if (urls.length === 0) return [];
  
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    const id = extractImageIdentifier(url);
    const existing = groups.get(id) || [];
    existing.push(url);
    groups.set(id, existing);
  }
  
  const result: string[] = [];
  const processed = new Set<string>();
  
  for (const url of urls) {
    const id = extractImageIdentifier(url);
    if (processed.has(id)) continue;
    
    const group = groups.get(id) || [url];
    const sorted = [...group].sort((a, b) => {
      const aHigh = isHighResVersion(a);
      const bHigh = isHighResVersion(b);
      if (aHigh && !bHigh) return -1;
      if (!aHigh && bHigh) return 1;
      return b.length - a.length;
    });
    
    result.push(sorted[0]);
    processed.add(id);
  }
  
  return result;
}

function parseTraderaResponse(xml: string): TraderaItem[] {
  const items: TraderaItem[] = [];
  
  const parts = xml.split('<Items>').slice(1);
  
  for (const part of parts) {
    const endIdx = part.indexOf('</Items>');
    if (endIdx === -1) continue;
    const itemXml = part.substring(0, endIdx);
    
    try {
      const id = extractNumber(itemXml, 'Id') || 0;
      const shortDesc = extractText(itemXml, 'ShortDescription') || '';
      
      if (!id || !shortDesc) continue;

      const rawImageUrls: string[] = [];
      
      const imageLinksMatch = itemXml.match(/<ImageLinks>([\s\S]*?)<\/ImageLinks>/i);
      if (imageLinksMatch) {
        const imageLinksXml = imageLinksMatch[1];
        const urlMatches = imageLinksXml.matchAll(/<Url>([^<]+)<\/Url>/gi);
        for (const match of urlMatches) {
          const url = match[1].trim();
          if (url) rawImageUrls.push(url.replace(/^http:\/\//i, 'https://'));
        }
      }
      
      const thumbnailLink = extractText(itemXml, 'ThumbnailLink');
      if (thumbnailLink) {
        rawImageUrls.push(thumbnailLink.replace(/^http:\/\//i, 'https://'));
      }
      
      const standaloneUrls = itemXml.matchAll(/<Url>([^<]+)<\/Url>/gi);
      for (const match of standaloneUrls) {
        const url = match[1].trim();
        if (url && url.includes('tradera.net') && !rawImageUrls.includes(url)) {
          rawImageUrls.push(url.replace(/^http:\/\//i, 'https://'));
        }
      }
      
      const deduplicatedImages = deduplicateAndSelectBest(rawImageUrls);

      const item: TraderaItem = {
        id,
        shortDescription: shortDesc,
        longDescription: extractText(itemXml, 'LongDescription'),
        price: extractNumber(itemXml, 'MaxBid') || 
               extractNumber(itemXml, 'NextBid') ||
               extractNumber(itemXml, 'BuyItNowPrice') || 0,
        buyItNowPrice: extractNumber(itemXml, 'BuyItNowPrice'),
        thumbnailLink: deduplicatedImages[0] || thumbnailLink,
        imageLinks: deduplicatedImages.length > 0 ? deduplicatedImages : undefined,
        itemLink: `https://www.tradera.com/item/${id}`,
        categoryId: extractNumber(itemXml, 'CategoryId') || 0,
        sellerId: extractNumber(itemXml, 'SellerId') || 0,
        sellerAlias: extractText(itemXml, 'SellerAlias'),
        endDate: extractText(itemXml, 'EndDate'),
        bids: extractNumber(itemXml, 'TotalBids'),
        condition: extractText(itemXml, 'ItemCondition'),
        brandName: extractText(itemXml, 'Brand'),
      };

      items.push(item);
    } catch (e) {
      console.error('Error parsing item:', e instanceof Error ? e.message : 'Unknown');
    }
  }

  return items;
}

function extractText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : undefined;
}

function extractNumber(xml: string, tag: string): number | undefined {
  const text = extractText(xml, tag);
  if (!text) return undefined;
  const num = parseFloat(text);
  return isNaN(num) ? undefined : num;
}
