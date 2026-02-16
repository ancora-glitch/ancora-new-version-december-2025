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

async function verifyAdmin(req: Request): Promise<{ authorized: true; userId: string } | { authorized: false; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const userId = data.claims.sub as string;
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { authorized: true, userId };
}

const MAX_IMAGES_PER_PRODUCT = 10;

interface UploadRequest {
  imageUrls: string[];
  productId?: string;
  traderaItemId: string;
}

interface UploadResult {
  originalUrl: string;
  storageUrl: string | null;
  error?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { imageUrls, productId, traderaItemId }: UploadRequest = await req.json();

    if (!imageUrls || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No image URLs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!traderaItemId && !productId) {
      return new Response(
        JSON.stringify({ error: 'Either traderaItemId or productId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const folderName = productId || `tradera-${traderaItemId}`;
    
    // Limit to max images per product
    const imagesToUpload = imageUrls.slice(0, MAX_IMAGES_PER_PRODUCT);
    if (imageUrls.length > MAX_IMAGES_PER_PRODUCT) {
      console.log(`Limiting from ${imageUrls.length} to ${MAX_IMAGES_PER_PRODUCT} images`);
    }
    
    console.log(`Uploading ${imagesToUpload.length} images to folder: ${folderName}`);

    const results: UploadResult[] = [];
    
    for (let i = 0; i < imagesToUpload.length; i++) {
      const originalUrl = imagesToUpload[i];
      
      
      try {
        console.log(`Fetching image ${i + 1}/${imageUrls.length}: ${originalUrl.substring(0, 80)}...`);
        
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
          results.push({
            originalUrl,
            storageUrl: null,
            error: `Failed to fetch: HTTP ${imageResponse.status}`,
          });
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

        // Create a consistent filename (no timestamp = upsert will overwrite on re-import)
        const filename = `${folderName}/image-${String(i + 1).padStart(2, '0')}.${extension}`;
        
        console.log(`Uploading to storage: ${filename} (${Math.round(imageData.byteLength / 1024)}KB)`);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('products')
          .upload(filename, imageData, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Failed to upload image ${i + 1}:`, uploadError);
          results.push({
            originalUrl,
            storageUrl: null,
            error: uploadError.message,
          });
          continue;
        }

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('products')
          .getPublicUrl(filename);

        console.log(`Successfully uploaded image ${i + 1}: ${publicUrlData.publicUrl}`);

        results.push({
          originalUrl,
          storageUrl: publicUrlData.publicUrl,
        });

      } catch (e) {
        console.error(`Error processing image ${i + 1}:`, e);
        results.push({
          originalUrl,
          storageUrl: null,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.storageUrl !== null);
    const failed = results.filter(r => r.storageUrl === null);

    console.log(`Upload complete: ${successful.length} successful, ${failed.length} failed`);

    // Deduplicate storage URLs before returning (ensures no duplicates in response)
    const allStorageUrls = results.map(r => r.storageUrl).filter(Boolean) as string[];
    const uniqueStorageUrls = [...new Set(allStorageUrls)];
    
    if (uniqueStorageUrls.length < allStorageUrls.length) {
      console.log(`Deduplicated storage URLs: ${allStorageUrls.length} -> ${uniqueStorageUrls.length}`);
    }

    return new Response(
      JSON.stringify({
        success: successful.length > 0,
        uploaded: successful.length,
        failed: failed.length,
        results,
        // Return deduplicated storage URLs in order for easy access
        storageUrls: uniqueStorageUrls,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tradera-upload-images:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
