import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  imageUrls: string[];
  productId?: string; // Optional: if provided, uses this as folder name
  traderaItemId: string; // Used as folder name if productId not provided
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
    console.log(`Uploading ${imageUrls.length} images to folder: ${folderName}`);

    const results: UploadResult[] = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const originalUrl = imageUrls[i];
      
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

        // Create a unique filename
        const filename = `${folderName}/image-${i + 1}-${Date.now()}.${extension}`;
        
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

    return new Response(
      JSON.stringify({
        success: successful.length > 0,
        uploaded: successful.length,
        failed: failed.length,
        results,
        // Return just the storage URLs in order for easy access
        storageUrls: results.map(r => r.storageUrl).filter(Boolean) as string[],
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
