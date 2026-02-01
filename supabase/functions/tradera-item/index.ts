import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function truncateForLog(input: string, max = 800): string {
  if (!input) return '';
  const cleaned = input.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log('Fetching Tradera item details for:', itemId);

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

    // Retry configuration for rate limiting
    const maxRetries = 3;
    const baseDelayMs = 1500; // Start with 1.5 second delay
    
    let lastError: string | null = null;
    let lastStatus: number | null = null;
    let lastRetryAfter: string | null = null;
    let response: Response | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Attempt ${attempt}/${maxRetries} to fetch item ${itemId}`);
      
      response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://api.tradera.com/GetItem',
        },
        body: soapEnvelope,
      });

      if (response.ok) {
        console.log(`Success on attempt ${attempt}`);
        break;
      }

      // Capture status for diagnostics
      lastStatus = response.status;
      lastRetryAfter = response.headers.get('retry-after');
      
      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        lastError = await response.text();
        console.warn(
          `Tradera GetItem returned 429. retry-after=${lastRetryAfter ?? 'n/a'}. bodySnippet=${truncateForLog(lastError)}`,
        );
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1.5s, 3s, 6s
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`Rate limited (429), waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // All retries exhausted
        console.warn('Tradera API rate limited after all retries - returning partial success');
        return new Response(
          JSON.stringify({ 
            item: null, 
            rateLimited: true,
            message: 'Tradera API rate limited after retries.',
            tradera: {
              status: lastStatus,
              retryAfter: lastRetryAfter,
              bodySnippet: truncateForLog(lastError ?? ''),
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Other errors - don't retry
      const errorText = await response.text();
      console.error('Tradera API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Tradera API error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response || !response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch item after retries', details: lastError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    return new Response(
      JSON.stringify({ item }),
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
 * Extracts a base identifier from an image URL for deduplication.
 * This helps detect when the same image appears in different resolutions/sizes.
 */
function extractImageIdentifier(url: string): string {
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove common size suffixes and thumbnail patterns to get base identifier
    const cleanPath = pathname
      .replace(/[_-](thumb|thumbnail|small|medium|large|xl|xxl|original|hires|lowres|preview|tiny|mini|xs|s|m|l)\b/gi, "")
      .replace(/\/\d+x\d+\//g, "/")  // Remove dimension paths like /400x300/
      .replace(/\/[stm]\//gi, "/")    // Remove single-letter size paths like /s/ /t/ /m/
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");  // Remove extension for comparison
    
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
    /thumb/i,
    /thumbnail/i,
    /small/i,
    /tiny/i,
    /mini/i,
    /preview/i,
    /_s\./i,
    /_t\./i,
    /_xs\./i,
    /_m\./i,
    /\/s\//i,
    /\/t\//i,
    /size=small/i,
    /size=thumb/i,
    /\/\d{2,3}x\d{2,3}\//,  // Small dimensions like /100x100/
  ];

  const highResPatterns = [
    /large/i,
    /original/i,
    /hires/i,
    /full/i,
    /_l\./i,
    /_xl\./i,
  ];

  const urlLower = url.toLowerCase();
  
  if (lowResPatterns.some(pattern => pattern.test(urlLower))) {
    return false;
  }
  
  if (highResPatterns.some(pattern => pattern.test(urlLower))) {
    return true;
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
  
  // Group images by their base identifier
  const imageGroups = new Map<string, string[]>();
  
  for (const url of urls) {
    const identifier = extractImageIdentifier(url);
    const existing = imageGroups.get(identifier) || [];
    existing.push(url);
    imageGroups.set(identifier, existing);
  }
  
  // For each group, select the highest quality version
  const uniqueImages: string[] = [];
  const processedIdentifiers = new Set<string>();
  
  // Process in original order to preserve ordering
  for (const url of urls) {
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
      // Normalize to HTTPS
      const normalizedUrl = url.replace(/^http:\/\//i, 'https://');
      if (!seenUrls.has(normalizedUrl.toLowerCase())) {
        seenUrls.add(normalizedUrl.toLowerCase());
        rawImageLinks.push(normalizedUrl);
      }
    };

    // 1. Extract from <ImageLinks> section (contains multiple <Url> elements)
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

    // 2. Extract standalone <Url> elements outside ImageLinks
    const allUrlMatches = xml.match(/<Url>([^<]+)<\/Url>/gi);
    if (allUrlMatches) {
      for (const match of allUrlMatches) {
        const url = match.replace(/<\/?Url>/gi, '').trim();
        addImageUrl(url);
      }
    }

    // 3. Extract from <ImageLink> elements
    const imageLinkMatches = xml.match(/<ImageLink>([^<]+)<\/ImageLink>/gi);
    if (imageLinkMatches) {
      for (const match of imageLinkMatches) {
        const url = match.replace(/<\/?ImageLink>/gi, '').trim();
        addImageUrl(url);
      }
    }

    // 4. Extract from <ThumbnailLink> elements
    const thumbnailMatches = xml.match(/<ThumbnailLink>([^<]+)<\/ThumbnailLink>/gi);
    if (thumbnailMatches) {
      for (const match of thumbnailMatches) {
        const url = match.replace(/<\/?ThumbnailLink>/gi, '').trim();
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

    // 7. Extract from <LargeImageLink> or similar high-res fields
    const largeImageMatches = xml.match(/<(?:LargeImageLink|OriginalImageLink|FullImageLink)>([^<]+)<\/(?:LargeImageLink|OriginalImageLink|FullImageLink)>/gi);
    if (largeImageMatches) {
      for (const match of largeImageMatches) {
        const url = match.replace(/<\/?(?:LargeImageLink|OriginalImageLink|FullImageLink)>/gi, '').trim();
        addImageUrl(url);
      }
    }

    console.log(`Collected ${rawImageLinks.length} raw images from all fields`);

    // Deduplicate by normalizing URLs and keeping best quality versions
    const imageLinks = deduplicateImages(rawImageLinks);

    // Extract attributes
    const attributes: Record<string, string> = {};
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
      condition: extractText(xml, 'ItemCondition') || attributes['skick'] || attributes['condition'],
      brand: extractText(xml, 'Brand') || attributes['märke'] || attributes['brand'],
      size: attributes['storlek'] || attributes['size'],
      material: attributes['material'],
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
