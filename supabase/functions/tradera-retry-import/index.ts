import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000; // Delay between Tradera API calls

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

    // Fetch all pending imports that are ready for retry
    const { data: pendingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, tradera_item_id, import_retry_count, name')
      .eq('status', 'pending_import')
      .lt('import_retry_count', MAX_RETRY_ATTEMPTS)
      .order('import_queued_at', { ascending: true })
      .limit(10); // Process in batches to avoid timeout

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

    console.log(`Processing ${pendingProducts.length} pending imports`);

    const results = {
      success: 0,
      rateLimited: 0,
      failed: 0,
      maxRetriesReached: 0,
    };

    for (const product of pendingProducts) {
      if (!product.tradera_item_id) {
        console.log(`Product ${product.id} has no tradera_item_id, skipping`);
        continue;
      }

      // Add delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

      try {
        const itemDetails = await fetchTraderaItem(product.tradera_item_id, appId, appKey);

        if (itemDetails.rateLimited) {
          // Still rate limited - increment retry count and continue
          await supabase
            .from('products')
            .update({
              import_retry_count: (product.import_retry_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', product.id);

          if ((product.import_retry_count || 0) + 1 >= MAX_RETRY_ATTEMPTS) {
            console.log(`Product ${product.id} reached max retries, marking as failed`);
            await supabase
              .from('products')
              .update({ status: 'draft' }) // Move to draft for manual handling
              .eq('id', product.id);
            results.maxRetriesReached++;
          } else {
            results.rateLimited++;
          }
          continue;
        }

        if (!itemDetails.item) {
          console.log(`Could not fetch item ${product.tradera_item_id}`);
          results.failed++;
          continue;
        }

        const item = itemDetails.item;

        // Deduplicate images
        const uniqueImages = deduplicateImages(item.imageLinks || []);

        if (uniqueImages.length === 0) {
          console.log(`No images found for item ${product.tradera_item_id}`);
          results.failed++;
          continue;
        }

        // Upload images to storage (Tradera URLs cannot be hotlinked)
        console.log(`Uploading ${uniqueImages.length} images to storage for ${product.name}...`);
        const storageUrls = await uploadImagesToStorage(
          supabase,
          uniqueImages,
          product.tradera_item_id!
        );

        if (storageUrls.length === 0) {
          console.log(`Failed to upload any images for ${product.name}`);
          // Increment retry count but don't mark as complete
          await supabase
            .from('products')
            .update({
              import_retry_count: (product.import_retry_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', product.id);
          results.failed++;
          continue;
        }

        console.log(`Successfully uploaded ${storageUrls.length} images to storage`);

        // Update product with full data (using storage URLs)
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
            import_retry_count: (product.import_retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          console.error(`Failed to update product ${product.id}:`, updateError);
          results.failed++;
        } else {
          console.log(`Successfully imported ${product.name} with ${storageUrls.length} images`);
          results.success++;
        }
      } catch (e) {
        console.error(`Error processing product ${product.id}:`, e);
        results.failed++;
      }
    }

    console.log('Retry import complete:', results);

    return new Response(
      JSON.stringify({
        message: 'Retry import complete',
        processed: pendingProducts.length,
        results,
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
 * Uploads images to Supabase storage.
 * Fetches each image from Tradera server-side and uploads to 'products' bucket.
 */
async function uploadImagesToStorage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  imageUrls: string[],
  traderaItemId: string
): Promise<string[]> {
  const folderName = `tradera-${traderaItemId}`;
  console.log(`Uploading ${imageUrls.length} images to folder: ${folderName}`);

  const storageUrls: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const originalUrl = imageUrls[i];

    try {
      console.log(`Fetching image ${i + 1}/${imageUrls.length}...`);

      // Fetch the image from Tradera
      const imageResponse = await fetch(originalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*',
          'Referer': 'https://www.tradera.com/',
        },
      });

      if (!imageResponse.ok) {
        console.error(`Failed to fetch image ${i + 1}: ${imageResponse.status}`);
        continue;
      }

      // Get the image data as ArrayBuffer
      const imageData = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

      // Determine file extension from content type
      let extension = 'jpg';
      if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('webp')) extension = 'webp';
      else if (contentType.includes('gif')) extension = 'gif';

      // Create a unique filename
      const filename = `${folderName}/image-${i + 1}-${Date.now()}.${extension}`;

      console.log(`Uploading to storage: ${filename} (${Math.round(imageData.byteLength / 1024)}KB)`);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filename, imageData, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`Failed to upload image ${i + 1}:`, uploadError);
        continue;
      }

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('products')
        .getPublicUrl(filename);

      console.log(`Successfully uploaded image ${i + 1}`);
      storageUrls.push(publicUrlData.publicUrl);

    } catch (e) {
      console.error(`Error processing image ${i + 1}:`, e);
      // Continue with next image
    }
  }

  console.log(`Upload complete: ${storageUrls.length} of ${imageUrls.length} images uploaded`);
  return storageUrls;
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
