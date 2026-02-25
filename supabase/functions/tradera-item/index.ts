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

function truncateForLog(input: string, max = 800): string {
  if (!input) return '';
  const cleaned = input.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

// Create Supabase client with service role for cache/usage tracking
function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey);
}

interface RateLimitResult {
  allowed: boolean;
  current_count: number;
  daily_limit: number;
  remaining?: number;
  message?: string;
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  try {
    const appId = Deno.env.get('TRADERA_APP_ID');
    const appKey = Deno.env.get('TRADERA_APP_KEY');

    if (!appId || !appKey) {
      console.error('Missing Tradera credentials');
      return new Response(
        JSON.stringify({ error: 'Tradera API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { itemId } = await req.json();

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'itemId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== TRADERA ITEM (RATE LIMITED) ===');
    console.log('Fetching Tradera item details for:', itemId);

    // Generate cache key
    const cacheKey = `item:${itemId}`;

    // Check cache first
    const cachedResult = await checkCache(supabase, cacheKey);
    if (cachedResult) {
      return new Response(
        JSON.stringify({ 
          ...cachedResult,
          fromCache: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit BEFORE making API call
    const rateLimitResult = await checkRateLimit(supabase);
    
    if (!rateLimitResult.allowed) {
      // INVARIANT: Rate limits must never crash the edge function or break the import pipeline.
      console.warn('RATE LIMIT EXCEEDED (quota):', rateLimitResult);
      return new Response(
        JSON.stringify({ 
          item: null,
          rateLimited: true,
          retryAfter: null,
          message: rateLimitResult.message || 'Tradera API quota reached for today. Please try again later.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Rate limit OK: ${rateLimitResult.current_count}/${rateLimitResult.daily_limit} calls used`);

    // Build the SOAP request for GetItem
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
    
    const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/GetItem',
      },
      body: soapEnvelope,
    });

    // INVARIANT: Rate limits must never crash the edge function or break the import pipeline.
    // Return structured response on 429 — never throw, never return HTTP error status.
    if (response.status === 429) {
      const errorBody = await response.text();
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
      console.warn(
        `Tradera GetItem returned 429. retry-after=${retryAfterHeader ?? 'n/a'}. bodySnippet=${truncateForLog(errorBody)}`,
      );
      
      return new Response(
        JSON.stringify({ 
          item: null, 
          rateLimited: true,
          retryAfter: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
          message: 'Tradera API rate limited. Please try again later.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Other errors - fail immediately
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tradera API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Tradera API error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xmlText = await response.text();
    console.log('Received item details XML, length:', xmlText.length);
    
    // Log a snippet to help debug image extraction
    const imageLinksStart = xmlText.indexOf('<ImageLinks>');
    const imageLinksEnd = xmlText.indexOf('</ImageLinks>');
    if (imageLinksStart > -1 && imageLinksEnd > -1) {
      console.log('ImageLinks section found:', xmlText.substring(imageLinksStart, imageLinksEnd + 13).substring(0, 500));
    }

    // Parse the item details
    const item = parseItemDetails(xmlText);
    
    if (!item) {
      return new Response(
        JSON.stringify({ error: 'Item not found or failed to parse' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed item:', item.id, '- Images:', item.imageLinks.length);

    const result = { item };

    // Cache the successful result
    await storeCache(supabase, cacheKey, 'item', result);

    return new Response(
      JSON.stringify({ 
        ...result,
        fromCache: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tradera-item:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface TraderaItemDetail {
  id: number;
  shortDescription: string;
  longDescription?: string;
  price: number;
  buyItNowPrice?: number;
  imageLinks: string[];
  itemLink: string;
  sellerId: number;
  sellerAlias?: string;
  endDate?: string;
  condition?: string;
  brand?: string;
  size?: string;
  material?: string;
  attributes: Record<string, string>;
}

/**
 * Normalizes a Tradera image URL to get the highest resolution version.
 * Tradera uses URL patterns like:
 * - /minithumb/... (smallest)
 * - /thumbs/... or /thumb/...
 * - /medium/...
 * - /images/... (largest/original)
 */
function normalizeToHighRes(url: string): string {
  if (!url) return url;
  
  try {
    // Replace resolution path segments with /images/ for highest res
    let normalized = url
      .replace(/^http:\/\//i, 'https://') // Force HTTPS
      .replace(/\/(minithumb|thumbs|thumb|medium|normal|small|tiny|mini|preview|xs|s|m)\//gi, '/images/')
      .replace(/[_-](thumb|thumbnail|small|medium|large|xl|xxl|xs|s|m|l)(\.[a-z]+)$/gi, '$2') // Remove size suffixes
      .replace(/\?.*$/, ''); // Remove query params that might force size
    
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Extracts a base identifier from an image URL for deduplication.
 * This helps detect when the same image appears in different resolutions/sizes.
 */
function extractImageIdentifier(url: string): string {
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove all resolution/size indicators to get the base image ID
    const cleanPath = pathname
      .replace(/\/(minithumb|thumbs|thumb|medium|images|normal|small|tiny|mini|preview|xs|s|m|l)\//gi, '/img/')
      .replace(/[_-](thumb|thumbnail|small|medium|large|xl|xxl|original|hires|lowres|preview|tiny|mini|xs|s|m|l)\b/gi, "")
      .replace(/\/\d+x\d+\//g, "/")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
    
    return cleanPath.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Determines if a URL is likely a high-resolution version
 */
function isHighResVersion(url: string): boolean {
  const lowResPatterns = [
    /\/minithumb\//i,
    /\/thumbs?\//i,
    /\/small\//i,
    /\/tiny\//i,
    /\/mini\//i,
    /\/preview\//i,
    /\/xs\//i,
    /\/s\//i,
    /\/m\//i,
    /_thumb\./i,
    /_small\./i,
    /_xs\./i,
    /_s\./i,
    /_t\./i,
    /size=small/i,
    /size=thumb/i,
    /\/\d{2,3}x\d{2,3}\//,
  ];

  const highResPatterns = [
    /\/images\//i,
    /\/large\//i,
    /\/original\//i,
    /\/hires\//i,
    /\/full\//i,
    /_l\./i,
    /_xl\./i,
    /_large\./i,
    /_original\./i,
  ];

  const urlLower = url.toLowerCase();
  
  // Check high-res patterns first (they take priority)
  if (highResPatterns.some(pattern => pattern.test(urlLower))) {
    return true;
  }
  
  if (lowResPatterns.some(pattern => pattern.test(urlLower))) {
    return false;
  }
  
  return true; // Default: assume okay quality
}

/**
 * Selects the best quality URL from a group of similar images
 */
function selectBestQuality(urls: string[]): string {
  if (urls.length === 1) return urls[0];
  
  const sorted = [...urls].sort((a, b) => {
    const aIsHigh = isHighResVersion(a);
    const bIsHigh = isHighResVersion(b);
    
    if (aIsHigh && !bIsHigh) return -1;
    if (!aIsHigh && bIsHigh) return 1;
    
    // Prefer /images/ path (Tradera's highest res)
    const aHasImages = /\/images\//i.test(a);
    const bHasImages = /\/images\//i.test(b);
    if (aHasImages && !bHasImages) return -1;
    if (!aHasImages && bHasImages) return 1;
    
    // Prefer longer URLs (often more specific/full resolution)
    return b.length - a.length;
  });
  
  return sorted[0];
}

/**
 * Deduplicates images by extracting base identifiers and keeping best quality versions.
 * This handles cases where the same image appears as thumbnail + full-res.
 */
function deduplicateImages(urls: string[]): string[] {
  if (urls.length === 0) return [];
  
  // First, normalize all URLs to high-res versions
  const normalizedUrls = urls.map(normalizeToHighRes);
  
  // Group images by their base identifier
  const imageGroups = new Map<string, string[]>();
  
  for (const url of normalizedUrls) {
    const identifier = extractImageIdentifier(url);
    const existing = imageGroups.get(identifier) || [];
    existing.push(url);
    imageGroups.set(identifier, existing);
  }
  
  // For each group, select the highest quality version
  const uniqueImages: string[] = [];
  const processedIdentifiers = new Set<string>();
  
  // Process in original order to preserve ordering
  for (const url of normalizedUrls) {
    const identifier = extractImageIdentifier(url);
    if (processedIdentifiers.has(identifier)) continue;
    
    const group = imageGroups.get(identifier) || [url];
    const bestUrl = selectBestQuality(group);
    uniqueImages.push(bestUrl);
    processedIdentifiers.add(identifier);
  }
  
  console.log(`Deduplicated images: ${urls.length} -> ${uniqueImages.length}`);
  return uniqueImages;
}

function parseItemDetails(xml: string): TraderaItemDetail | null {
  try {
    const id = extractNumber(xml, 'Id');
    if (!id) return null;

    // Collect images from ALL available fields in the Tradera payload
    const rawImageLinks: string[] = [];
    const seenUrls = new Set<string>();
    
    const addImageUrl = (url: string | undefined) => {
      if (!url || !url.startsWith('http')) return;
      // Normalize to HTTPS and high-res
      const normalizedUrl = normalizeToHighRes(url);
      const lowerUrl = normalizedUrl.toLowerCase();
      if (!seenUrls.has(lowerUrl)) {
        seenUrls.add(lowerUrl);
        rawImageLinks.push(normalizedUrl);
      }
    };

    // 1. Prioritize high-res fields first
    const largeImageMatches = xml.match(/<(?:LargeImageLink|OriginalImageLink|FullImageLink|HighResImageLink)>([^<]+)<\/(?:LargeImageLink|OriginalImageLink|FullImageLink|HighResImageLink)>/gi);
    if (largeImageMatches) {
      for (const match of largeImageMatches) {
        const url = match.replace(/<\/?(?:LargeImageLink|OriginalImageLink|FullImageLink|HighResImageLink)>/gi, '').trim();
        addImageUrl(url);
      }
    }

    // 2. Extract from <ImageLinks> section (contains multiple <Url> elements)
    const imageLinksSection = xml.match(/<ImageLinks>([\s\S]*?)<\/ImageLinks>/gi);
    if (imageLinksSection) {
      for (const section of imageLinksSection) {
        const urlMatches = section.match(/<Url>([^<]+)<\/Url>/gi);
        if (urlMatches) {
          for (const match of urlMatches) {
            const url = match.replace(/<\/?Url>/gi, '').trim();
            addImageUrl(url);
          }
        }
      }
    }

    // 3. Extract standalone <Url> elements outside ImageLinks
    const allUrlMatches = xml.match(/<Url>([^<]+)<\/Url>/gi);
    if (allUrlMatches) {
      for (const match of allUrlMatches) {
        const url = match.replace(/<\/?Url>/gi, '').trim();
        // Only add if it looks like an image URL
        if (url.includes('tradera.net') || /\.(jpg|jpeg|png|webp|gif)/i.test(url)) {
          addImageUrl(url);
        }
      }
    }

    // 4. Extract from <ImageLink> elements
    const imageLinkMatches = xml.match(/<ImageLink>([^<]+)<\/ImageLink>/gi);
    if (imageLinkMatches) {
      for (const match of imageLinkMatches) {
        const url = match.replace(/<\/?ImageLink>/gi, '').trim();
        addImageUrl(url);
      }
    }

    // 5. Extract from <ItemImage> or <MainImage> elements
    const itemImageMatches = xml.match(/<(?:ItemImage|MainImage)>([^<]+)<\/(?:ItemImage|MainImage)>/gi);
    if (itemImageMatches) {
      for (const match of itemImageMatches) {
        const url = match.replace(/<\/?(?:ItemImage|MainImage)>/gi, '').trim();
        addImageUrl(url);
      }
    }

    // 6. Extract from <Image> elements (generic)
    const genericImageMatches = xml.match(/<Image>([^<]+)<\/Image>/gi);
    if (genericImageMatches) {
      for (const match of genericImageMatches) {
        const url = match.replace(/<\/?Image>/gi, '').trim();
        addImageUrl(url);
      }
    }

    // 7. Extract from <ThumbnailLink> elements (lowest priority, only if no other images)
    if (rawImageLinks.length === 0) {
      const thumbnailMatches = xml.match(/<ThumbnailLink>([^<]+)<\/ThumbnailLink>/gi);
      if (thumbnailMatches) {
        for (const match of thumbnailMatches) {
          const url = match.replace(/<\/?ThumbnailLink>/gi, '').trim();
          addImageUrl(url);
        }
      }
    }

    console.log(`Collected ${rawImageLinks.length} raw images from all fields`);

    // Deduplicate by normalizing URLs and keeping best quality versions
    const imageLinks = deduplicateImages(rawImageLinks);

    // Extract attributes from Tradera's actual XML structure:
    // <TermAttributeValues><TermAttributeValue><Values><string>VALUE</string></Values></TermAttributeValue></TermAttributeValues>
    // Also try legacy <Attribute><Name>/<Value> format as fallback
    const attributes: Record<string, string> = {};

    // NEW: Parse TermAttributeValue elements (actual Tradera GetItem format)
    const termAttrSection = xml.match(/<TermAttributeValues>([\s\S]*?)<\/TermAttributeValues>/);
    if (termAttrSection) {
      const termAttrMatches = termAttrSection[1].match(/<TermAttributeValue>([\s\S]*?)<\/TermAttributeValue>/g);
      if (termAttrMatches) {
        console.info('[TraderaRawTermAttrCount]', termAttrMatches.length);
        for (const tav of termAttrMatches) {
          // Extract the Id (attribute type ID) and Values
          const attrId = extractText(tav, 'Id');
          const valuesSection = tav.match(/<Values>([\s\S]*?)<\/Values>/);
          const valueStrings = valuesSection
            ? (valuesSection[1].match(/<string>([^<]*)<\/string>/g) || []).map(s => s.replace(/<\/?string>/g, '').trim())
            : [];
          if (attrId && valueStrings.length > 0) {
            attributes[`term_${attrId}`] = valueStrings.join(', ');
          }
        }
      }
    }

    // Also extract from ItemAttributes (numbered attribute IDs)
    const itemAttrSection = xml.match(/<ItemAttributes>([\s\S]*?)<\/ItemAttributes>/);
    if (itemAttrSection) {
      const intMatches = itemAttrSection[1].match(/<int>(\d+)<\/int>/g);
      if (intMatches) {
        const attrIds = intMatches.map(m => m.replace(/<\/?int>/g, ''));
        console.info('[TraderaRawItemAttributeIds]', JSON.stringify(attrIds));
      }
    }

    // Legacy: Parse <Attribute> elements (older format, fallback)
    const attrMatches = xml.match(/<Attribute>([\s\S]*?)<\/Attribute>/g);
    if (attrMatches) {
      for (const attrXml of attrMatches) {
        const name = extractText(attrXml, 'Name');
        const value = extractText(attrXml, 'Value');
        if (name && value) {
          attributes[name.toLowerCase()] = value;
        }
      }
    }

    // Known Tradera TermAttributeValue IDs:
    // term_121 = Skick (condition), term_105 = Material, term_3 = Märke (brand),
    // term_102 = Färg (color), term_97 = Kön (gender), term_100 = Storlek (size)
    const condition_raw = extractText(xml, 'ItemCondition')
      || attributes['term_121']  // Tradera condition attribute
      || attributes['skick'] || attributes['condition'] || null;
    const material_raw = attributes['term_105']  // Tradera material attribute
      || attributes['material'] || attributes['materiel'] || null;

    // ── DEBUG: attribute mapping trace ──
    console.info('[TraderaGetItemFields]', JSON.stringify({
      itemId: id,
      condition_raw,
      material_raw,
      has_attributes: Object.keys(attributes).length > 0,
      attribute_keys: Object.keys(attributes),
    }));

    const item: TraderaItemDetail = {
      id,
      shortDescription: extractText(xml, 'ShortDescription') || extractText(xml, 'Title') || '',
      longDescription: extractText(xml, 'LongDescription') || extractText(xml, 'Body') || extractText(xml, 'Description'),
      price: extractNumber(xml, 'MaxBid') || extractNumber(xml, 'Price') || extractNumber(xml, 'NextBid') || 0,
      buyItNowPrice: extractNumber(xml, 'BuyItNowPrice'),
      imageLinks,
      itemLink: `https://www.tradera.com/item/${id}`,
      sellerId: extractNumber(xml, 'SellerId') || 0,
      sellerAlias: extractText(xml, 'SellerAlias'),
      endDate: extractText(xml, 'EndDate'),
      condition: condition_raw || undefined,
      brand: extractText(xml, 'Brand') || attributes['märke'] || attributes['brand'],
      size: attributes['storlek'] || attributes['size'],
      material: material_raw || undefined,
      attributes,
    };

    return item;
  } catch (e) {
    console.error('Error parsing item details:', e);
    return null;
  }
}

function extractText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
  return match ? match[1].trim() : undefined;
}

function extractNumber(xml: string, tag: string): number | undefined {
  const text = extractText(xml, tag);
  if (!text) return undefined;
  const num = parseFloat(text);
  return isNaN(num) ? undefined : num;
}
