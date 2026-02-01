import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000; // Delay between Tradera API calls
const MAX_IMAGES_PER_PRODUCT = 10;

interface UploadImagesResponse {
  success: boolean;
  uploaded: number;
  failed: number;
  storageUrls: string[];
}

interface TraderaItemDetail {
  id: number;
  shortDescription: string;
  longDescription?: string;
  price: number;
  imageLinks: string[];
  itemLink: string;
  condition?: string;
  brand?: string;
  size?: string;
  material?: string;
}

interface UploadResult {
  originalUrl: string;
  storageUrl: string | null;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // IMPORTS PAUSED: Retry job disabled
  // Remove this block when rate limiting is resolved
  // ========================================
  console.log('tradera-retry-import: PAUSED - rate limiting active, skipping all retries');
  return new Response(
    JSON.stringify({ 
      message: 'Tradera imports paused due to rate limiting. Retry job disabled.',
      paused: true,
      processed: 0,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

/**
 * Calls the shared tradera-upload-images edge function.
 * This is the single source of truth for Tradera image handling.
 */
async function callUploadImagesFunction(
  supabaseUrl: string,
  imageUrls: string[],
  traderaItemId: string
): Promise<string[]> {
  try {
    const uploadFunctionUrl = `${supabaseUrl}/functions/v1/tradera-upload-images`;
    
    console.log(`Calling tradera-upload-images for item ${traderaItemId} with ${imageUrls.length} images`);
    
    const response = await fetch(uploadFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        imageUrls,
        traderaItemId,
      }),
    });

    if (!response.ok) {
      console.error(`tradera-upload-images returned ${response.status}`);
      return [];
    }

    const result: UploadImagesResponse = await response.json();
    
    console.log(`tradera-upload-images result: ${result.uploaded} uploaded, ${result.failed} failed`);
    
    return result.storageUrls || [];
  } catch (e) {
    console.error('Error calling tradera-upload-images:', e);
    return [];
  }
}

interface FetchResult {
  item: TraderaItemDetail | null;
  rateLimited: boolean;
}

async function fetchTraderaItem(itemId: string, appId: string, appKey: string): Promise<FetchResult> {
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

  const maxRetries = 3;
  const baseDelayMs = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Attempt ${attempt}/${maxRetries} to fetch item ${itemId}`);

    const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/GetItem',
      },
      body: soapEnvelope,
    });

    if (response.ok) {
      const xml = await response.text();
      const item = parseItemDetails(xml);
      return { item, rateLimited: false };
    }

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`Rate limited (429), waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      return { item: null, rateLimited: true };
    }

    // Other errors - don't retry
    console.error(`API error for item ${itemId}:`, response.status);
    return { item: null, rateLimited: false };
  }

  return { item: null, rateLimited: false };
}

function parseItemDetails(xml: string): TraderaItemDetail | null {
  try {
    const id = extractNumber(xml, 'Id');
    if (!id) return null;

    // Extract all image URLs
    const imageLinks: string[] = [];
    const seenUrls = new Set<string>();

    const addImageUrl = (url: string | undefined) => {
      if (!url || !url.startsWith('http')) return;
      const normalized = url.replace(/^http:\/\//i, 'https://');
      if (!seenUrls.has(normalized.toLowerCase())) {
        seenUrls.add(normalized.toLowerCase());
        imageLinks.push(normalized);
      }
    };

    // Extract from <ImageLinks> section
    const imageLinksSection = xml.match(/<ImageLinks>([\s\S]*?)<\/ImageLinks>/gi);
    if (imageLinksSection) {
      for (const section of imageLinksSection) {
        const urlMatches = section.match(/<Url>([^<]+)<\/Url>/gi);
        if (urlMatches) {
          for (const match of urlMatches) {
            addImageUrl(match.replace(/<\/?Url>/gi, '').trim());
          }
        }
      }
    }

    // Extract standalone URLs
    const allUrlMatches = xml.match(/<Url>([^<]+)<\/Url>/gi);
    if (allUrlMatches) {
      for (const match of allUrlMatches) {
        addImageUrl(match.replace(/<\/?Url>/gi, '').trim());
      }
    }

    // Extract thumbnail
    const thumbnail = extractText(xml, 'ThumbnailLink');
    addImageUrl(thumbnail);

    return {
      id,
      shortDescription: extractText(xml, 'ShortDescription') || '',
      longDescription: extractText(xml, 'LongDescription'),
      price: extractNumber(xml, 'MaxBid') || extractNumber(xml, 'Price') || 0,
      imageLinks,
      itemLink: `https://www.tradera.com/item/${id}`,
      condition: extractText(xml, 'ItemCondition'),
      brand: extractText(xml, 'Brand'),
      size: extractText(xml, 'Size'),
      material: extractText(xml, 'Material'),
    };
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

function extractImageIdentifier(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname
      .replace(/^(\/(minithumb|thumbs|thumb|medium|images|normal)\/)/gi, "/img/")
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "")
      .toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isHighResVersion(url: string): boolean {
  if (url.includes('/images/') || url.includes('/normal/')) return true;
  if (url.includes('/thumbs/') || url.includes('/minithumb/')) return false;
  return true;
}

function deduplicateImages(urls: string[]): string[] {
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
