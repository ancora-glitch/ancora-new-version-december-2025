import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { keywords, categoryId } = await req.json() as TraderaSearchParams;

    console.log('=== TRADERA SEARCH V4 ===');
    console.log('Params:', { keywords, categoryId });

    // Use the Search method with correct enum orderBy value
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
    console.log('First 2000 chars:', xmlText.substring(0, 2000));

    if (!response.ok) {
      console.error('API error');
      return new Response(
        JSON.stringify({ error: 'Tradera API error', details: xmlText.substring(0, 500) }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for errors in response
    if (xmlText.includes('<Errors>')) {
      const errorCode = extractText(xmlText, 'Code');
      const errorMessage = extractText(xmlText, 'Message');
      console.error('API error:', errorCode, errorMessage);
      return new Response(
        JSON.stringify({ error: errorMessage || 'Tradera API error', code: errorCode }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the XML response
    const items = parseTraderaResponse(xmlText);
    
    console.log(`Parsed ${items.length} items`);

    return new Response(
      JSON.stringify({ 
        items, 
        total: items.length,
        debug: xmlText.substring(0, 1000)
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

/**
 * Extracts a base identifier from an image URL for deduplication.
 * Tradera provides the same image in multiple resolutions (minithumb, thumb, medium, images/normal).
 */
function extractImageIdentifier(url: string): string {
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove Tradera's resolution prefixes: /minithumb/, /thumbs/, /medium/, /images/
    // Keep the unique image ID that follows
    const cleanPath = pathname
      .replace(/^\/(minithumb|thumbs|thumb|medium|images|normal)\//gi, "/img/")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
    
    return cleanPath.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Determines if a URL is a high-resolution version
 */
function isHighResVersion(url: string): boolean {
  // Tradera's URL patterns: /images/ = highest res, /medium/ = medium, /thumbs/ or /minithumb/ = low
  if (url.includes('/images/') || url.includes('/normal/')) return true;
  if (url.includes('/medium/')) return false; // Medium is okay but not best
  if (url.includes('/thumbs/') || url.includes('/minithumb/')) return false;
  return true;
}

/**
 * Deduplicates images by base identifier and keeps the highest resolution version
 */
function deduplicateAndSelectBest(urls: string[]): string[] {
  if (urls.length === 0) return [];
  
  // Group by base identifier
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    const id = extractImageIdentifier(url);
    const existing = groups.get(id) || [];
    existing.push(url);
    groups.set(id, existing);
  }
  
  // Select best from each group, preserving original order
  const result: string[] = [];
  const processed = new Set<string>();
  
  for (const url of urls) {
    const id = extractImageIdentifier(url);
    if (processed.has(id)) continue;
    
    const group = groups.get(id) || [url];
    // Sort: high-res first, then by URL length (longer = more specific)
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
  
  // Split by <Items> to get each item block
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

      // Extract ALL image URLs from multiple sources
      const rawImageUrls: string[] = [];
      
      // 1. Extract from <ImageLinks> section
      const imageLinksMatch = itemXml.match(/<ImageLinks>([\s\S]*?)<\/ImageLinks>/i);
      if (imageLinksMatch) {
        const imageLinksXml = imageLinksMatch[1];
        const urlMatches = imageLinksXml.matchAll(/<Url>([^<]+)<\/Url>/gi);
        for (const match of urlMatches) {
          const url = match[1].trim();
          if (url) rawImageUrls.push(url.replace(/^http:\/\//i, 'https://'));
        }
      }
      
      // 2. Extract <ThumbnailLink>
      const thumbnailLink = extractText(itemXml, 'ThumbnailLink');
      if (thumbnailLink) {
        rawImageUrls.push(thumbnailLink.replace(/^http:\/\//i, 'https://'));
      }
      
      // 3. Extract any standalone <Url> elements with image patterns
      const standaloneUrls = itemXml.matchAll(/<Url>([^<]+)<\/Url>/gi);
      for (const match of standaloneUrls) {
        const url = match[1].trim();
        if (url && url.includes('tradera.net') && !rawImageUrls.includes(url)) {
          rawImageUrls.push(url.replace(/^http:\/\//i, 'https://'));
        }
      }
      
      // Deduplicate and select highest resolution versions
      const deduplicatedImages = deduplicateAndSelectBest(rawImageUrls);
      
      console.log(`Item ${id} - Raw images: ${rawImageUrls.length}, Deduplicated: ${deduplicatedImages.length}`);

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
