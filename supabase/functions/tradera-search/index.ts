import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TraderaSearchParams {
  keywords?: string;
  categoryId?: number;
  brandId?: number;
  itemStatus?: number;
  priceMin?: number;
  priceMax?: number;
  orderBy?: number;
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

    const { keywords, categoryId, priceMin, priceMax } = await req.json() as TraderaSearchParams;

    console.log('Searching Tradera with params:', { keywords, categoryId, priceMin, priceMax });

    // Build the SOAP request for SearchAdvanced
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
    <SearchAdvanced xmlns="http://api.tradera.com">
      <request>
        <SearchWords>${keywords || ''}</SearchWords>
        ${categoryId ? `<CategoryId>${categoryId}</CategoryId>` : '<CategoryId>0</CategoryId>'}
        <ItemStatus>1</ItemStatus>
        <ItemType>0</ItemType>
        ${priceMin ? `<PriceMinimum>${priceMin}</PriceMinimum>` : ''}
        ${priceMax ? `<PriceMaximum>${priceMax}</PriceMaximum>` : ''}
        <OrderBy>1</OrderBy>
        <PageNumber>1</PageNumber>
        <PageSize>50</PageSize>
      </request>
    </SearchAdvanced>
  </soap:Body>
</soap:Envelope>`;

    console.log('Making SOAP request to Tradera SearchService');

    const response = await fetch('https://api.tradera.com/v3/SearchService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://api.tradera.com/SearchAdvanced',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tradera API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Tradera API error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xmlText = await response.text();
    console.log('Received XML response, parsing...');

    // Parse the XML response
    const items = parseTraderaResponse(xmlText);
    
    console.log(`Parsed ${items.length} items from Tradera`);

    return new Response(
      JSON.stringify({ items, total: items.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tradera-search:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseTraderaResponse(xml: string): TraderaItem[] {
  const items: TraderaItem[] = [];
  
  // Extract all Item elements
  const itemMatches = xml.match(/<Item>([\s\S]*?)<\/Item>/g);
  
  if (!itemMatches) {
    console.log('No items found in response');
    return items;
  }

  for (const itemXml of itemMatches) {
    try {
      const item: TraderaItem = {
        id: extractNumber(itemXml, 'Id') || 0,
        shortDescription: extractText(itemXml, 'ShortDescription') || '',
        longDescription: extractText(itemXml, 'LongDescription'),
        price: extractNumber(itemXml, 'MaxBid') || extractNumber(itemXml, 'Price') || 0,
        buyItNowPrice: extractNumber(itemXml, 'BuyItNowPrice'),
        thumbnailLink: extractText(itemXml, 'ThumbnailLink') || extractText(itemXml, 'ImageLink'),
        itemLink: `https://www.tradera.com/item/${extractNumber(itemXml, 'Id')}`,
        categoryId: extractNumber(itemXml, 'CategoryId') || 0,
        sellerId: extractNumber(itemXml, 'SellerId') || 0,
        sellerAlias: extractText(itemXml, 'SellerAlias'),
        endDate: extractText(itemXml, 'EndDate'),
        bids: extractNumber(itemXml, 'TotalBids'),
        condition: extractText(itemXml, 'ItemCondition'),
        brandName: extractText(itemXml, 'Brand'),
      };

      // Try to extract multiple images
      const imageMatches = itemXml.match(/<ImageLink>(.*?)<\/ImageLink>/g);
      if (imageMatches) {
        item.imageLinks = imageMatches.map(m => m.replace(/<\/?ImageLink>/g, ''));
      }

      if (item.id && item.shortDescription) {
        items.push(item);
      }
    } catch (e) {
      console.error('Error parsing item:', e);
    }
  }

  return items;
}

function extractText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's'));
  return match ? match[1].trim() : undefined;
}

function extractNumber(xml: string, tag: string): number | undefined {
  const text = extractText(xml, tag);
  if (!text) return undefined;
  const num = parseFloat(text);
  return isNaN(num) ? undefined : num;
}
