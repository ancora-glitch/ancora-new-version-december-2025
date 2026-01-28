import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const response = await fetch('https://api.tradera.com/v3/PublicService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/GetItem',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tradera API error:', response.status, errorText);
      
      // Handle 429 rate limiting as a non-fatal, partial-success case
      if (response.status === 429) {
        console.warn('Tradera API rate limited (429) - returning partial success');
        return new Response(
          JSON.stringify({ 
            item: null, 
            rateLimited: true,
            message: 'Tradera API rate limited. Item details unavailable but import can continue.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Tradera API error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xmlText = await response.text();
    console.log('Received item details XML');

    // Parse the item details
    const item = parseItemDetails(xmlText);
    
    if (!item) {
      return new Response(
        JSON.stringify({ error: 'Item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed item:', item.id, item.shortDescription);

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

// Filter out thumbnail/low-res image URLs and keep only originals
function filterHighResImages(urls: string[]): string[] {
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
  ];

  const filtered = urls.filter(url => {
    // Check if URL contains any low-res patterns
    const isLowRes = lowResPatterns.some(pattern => pattern.test(url));
    if (isLowRes) {
      console.log('Filtering out low-res image:', url);
    }
    return !isLowRes;
  });

  // Deduplicate by normalizing URLs (remove query params for comparison)
  const seen = new Set<string>();
  const unique: string[] = [];
  
  for (const url of filtered) {
    const normalized = url.split('?')[0].toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url);
    }
  }

  console.log(`Filtered images: ${urls.length} -> ${unique.length}`);
  return unique;
}

function parseItemDetails(xml: string): TraderaItemDetail | null {
  try {
    const id = extractNumber(xml, 'Id');
    if (!id) return null;

    // Extract all image URLs
    const rawImageLinks: string[] = [];
    const imageMatches = xml.match(/<Url>(.*?)<\/Url>/g);
    if (imageMatches) {
      for (const match of imageMatches) {
        const url = match.replace(/<\/?Url>/g, '');
        if (url && url.startsWith('http')) {
          rawImageLinks.push(url);
        }
      }
    }

    // Also check for ImageLink elements
    const imageLinkMatches = xml.match(/<ImageLink>(.*?)<\/ImageLink>/g);
    if (imageLinkMatches) {
      for (const match of imageLinkMatches) {
        const url = match.replace(/<\/?ImageLink>/g, '');
        if (url && url.startsWith('http') && !rawImageLinks.includes(url)) {
          rawImageLinks.push(url);
        }
      }
    }

    // Filter to only keep high-res/original images
    const imageLinks = filterHighResImages(rawImageLinks);

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
