import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_LIMIT = 75;

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
    console.log(`Cache HIT for ${cacheKey}, fetched at ${data.fetched_at}`);
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
  } else {
    console.log(`Cached result for ${cacheKey}`);
  }
}

// Check and increment rate limit
async function checkRateLimit(supabase: ReturnType<typeof createClient>): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('tradera_increment_usage', { daily_limit: DAILY_LIMIT });

  if (error) {
    console.error('Rate limit check error:', error);
    // Fail-safe: deny if we can't check
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  try {
    const { keywords, categoryId, checkUsageOnly } = await req.json();

    // If just checking usage, return without incrementing
    if (checkUsageOnly) {
      const usage = await getCurrentUsage(supabase);
      return new Response(
        JSON.stringify({ usage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appId = Deno.env.get('TRADERA_APP_ID');
    const appKey = Deno.env.get('TRADERA_APP_KEY');

    if (!appId || !appKey) {
      console.error('Missing Tradera credentials');
      return new Response(
        JSON.stringify({ error: 'Tradera API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== TRADERA SEARCH (RATE LIMITED) ===');
    console.log('Params:', { keywords, categoryId });

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
      console.log('RATE LIMIT EXCEEDED:', rateLimitResult);
      return new Response(
        JSON.stringify({ 
          error: 'rate_limit_exceeded',
          message: rateLimitResult.message || 'Tradera API quota reached for today. Please try again later.',
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

    console.log(`Rate limit OK: ${rateLimitResult.current_count}/${rateLimitResult.daily_limit} calls used`);

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

    console.log('Making SOAP request to Search...');

    const response = await fetch('https://api.tradera.com/v3/SearchService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/Search',
      },
      body: soapEnvelope,
    });

    const xmlText = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response length:', xmlText.length);

    // NO RETRIES - fail fast on any error
    if (!response.ok) {
      console.error('Tradera API error - NO RETRY');
      return new Response(
        JSON.stringify({ 
          error: 'Tradera API error', 
          details: xmlText.substring(0, 500),
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
      console.error('SOAP error - NO RETRY:', errorCode, errorMessage);
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
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
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
  
  const totalItems = extractText(xml, 'TotalNumberOfItems');
  console.log('TotalNumberOfItems:', totalItems);
  
  const parts = xml.split('<Items>').slice(1);
  console.log(`Found ${parts.length} items via split`);
  
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
      console.error('Error parsing item:', e);
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
