import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// STRICT SERIALIZATION QUEUE
// - Max 1 request at a time (NO parallelization)
// - 3 second delay between calls (NO batching)
// - Fail-fast on 429 (NO retries)
// - Correctness > throughput
// ========================================

const THROTTLE_DELAY_MS = 3000; // 3 seconds between API calls
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

interface FetchResult {
  item: TraderaItemDetail | null;
  rateLimited: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appId = Deno.env.get('TRADERA_APP_ID');
    const appKey = Deno.env.get('TRADERA_APP_KEY');

    if (!appId || !appKey) {
      return new Response(
        JSON.stringify({ error: 'Tradera API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending imports - process ONE at a time (strict serialization)
    const { data: pendingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, tradera_item_id, name')
      .eq('status', 'pending_import')
      .order('import_queued_at', { ascending: true })
      .limit(1); // ONLY ONE - strict serialization

    if (fetchError) {
      console.error('Error fetching pending products:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending products' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingProducts || pendingProducts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending imports to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const product = pendingProducts[0];
    console.log(`Processing single item: ${product.name} (${product.tradera_item_id})`);

    if (!product.tradera_item_id) {
      console.log(`Product ${product.id} has no tradera_item_id, marking as failed`);
      await supabase
        .from('products')
        .update({ status: 'draft' })
        .eq('id', product.id);
      
      return new Response(
        JSON.stringify({ 
          message: 'Product has no Tradera item ID',
          processed: 1,
          result: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single API call - NO retries on 429
    const itemDetails = await fetchTraderaItem(product.tradera_item_id, appId, appKey);

    // FAIL-FAST on 429 - stop immediately, do not continue
    if (itemDetails.rateLimited) {
      console.warn(`Rate limited on ${product.tradera_item_id} - stopping immediately (no retry)`);
      return new Response(
        JSON.stringify({ 
          message: 'Tradera rate limited (429) - stopped immediately',
          processed: 0,
          rateLimited: true,
          productId: product.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!itemDetails.item) {
      console.log(`Could not fetch item ${product.tradera_item_id}, marking as draft`);
      await supabase
        .from('products')
        .update({ status: 'draft' })
        .eq('id', product.id);
      
      return new Response(
        JSON.stringify({ 
          message: 'Could not fetch item from Tradera',
          processed: 1,
          result: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const item = itemDetails.item;

    // Deduplicate images and limit
    const allImages = deduplicateImages(item.imageLinks || []);
    const uniqueImages = allImages.slice(0, MAX_IMAGES_PER_PRODUCT);

    if (uniqueImages.length === 0) {
      console.log(`No images found for item ${product.tradera_item_id}`);
      await supabase
        .from('products')
        .update({ status: 'draft' })
        .eq('id', product.id);
      
      return new Response(
        JSON.stringify({ 
          message: 'No images found',
          processed: 1,
          result: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload images to storage
    console.log(`Uploading ${uniqueImages.length} images for ${product.name}...`);
    const storageUrls = await callUploadImagesFunction(
      supabaseUrl,
      uniqueImages,
      product.tradera_item_id
    );

    if (storageUrls.length === 0) {
      console.log(`Failed to upload images for ${product.name}`);
      await supabase
        .from('products')
        .update({ status: 'draft' })
        .eq('id', product.id);
      
      return new Response(
        JSON.stringify({ 
          message: 'Failed to upload images',
          processed: 1,
          result: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update product with full data
    const { error: updateError } = await supabase
      .from('products')
      .update({
        image: storageUrls[0],
        additional_images: storageUrls.slice(1),
        description: item.longDescription || null,
        description_sv: item.longDescription || null,
        condition_sv: item.condition || null,
        material_sv: item.material || null,
        size_sv: item.size || null,
        status: 'draft', // Move to draft for manual review
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);

    if (updateError) {
      console.error(`Failed to update product ${product.id}:`, updateError);
      return new Response(
        JSON.stringify({ 
          message: 'Failed to update product',
          processed: 1,
          result: 'failed',
          error: updateError.message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully imported ${product.name} with ${storageUrls.length} images`);

    return new Response(
      JSON.stringify({
        message: 'Import complete',
        processed: 1,
        result: 'success',
        product: {
          id: product.id,
          name: product.name,
          images: storageUrls.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tradera-retry-import:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Calls the shared tradera-upload-images edge function.
 */
async function callUploadImagesFunction(
  supabaseUrl: string,
  imageUrls: string[],
  traderaItemId: string
): Promise<string[]> {
  try {
    const uploadFunctionUrl = `${supabaseUrl}/functions/v1/tradera-upload-images`;
    
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
    return result.storageUrls || [];
  } catch (e) {
    console.error('Error calling tradera-upload-images:', e);
    return [];
  }
}

/**
 * Fetch item from Tradera - SINGLE request, NO retries on 429
 */
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

  console.log(`Fetching item ${itemId} (single request, NO retries)`);

  const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://api.tradera.com/GetItem',
    },
    body: soapEnvelope,
  });

  // FAIL-FAST on 429 - no retries
  if (response.status === 429) {
    console.warn(`Tradera returned 429 for item ${itemId} - fail fast`);
    return { item: null, rateLimited: true };
  }

  if (!response.ok) {
    console.error(`API error for item ${itemId}:`, response.status);
    return { item: null, rateLimited: false };
  }

  const xml = await response.text();
  const item = parseItemDetails(xml);
  return { item, rateLimited: false };
}

function parseItemDetails(xml: string): TraderaItemDetail | null {
  try {
    const id = extractNumber(xml, 'Id');
    if (!id) return null;

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
