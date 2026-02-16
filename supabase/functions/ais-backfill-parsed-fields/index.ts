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

// ── Inline listing parser (mirrors src/lib/listingParser.ts) ──

const KNOWN_BRANDS = [
  "Filippa K Soft Sport", "Filippa K", "Acne Studios", "Acne", "Totême", "Toteme",
  "COS", "Arket", "By Malene Birger", "Tiger of Sweden", "J.Lindeberg",
  "Rodebjer", "Our Legacy", "Ganni", "Samsøe Samsøe", "Samsoe Samsoe",
  "Holzweiler", "Wood Wood", "Norse Projects", "House of Dagmar", "Carin Wester",
  "Chanel", "Louis Vuitton", "Gucci", "Prada", "Hermès", "Hermes", "Dior",
  "Céline", "Celine", "Saint Laurent", "Yves Saint Laurent", "YSL",
  "Bottega Veneta", "Loewe", "Balenciaga", "Valentino", "Fendi", "Burberry",
  "Max Mara", "Jil Sander", "Loro Piana", "Brunello Cucinelli", "Marni",
  "Sandro", "Maje", "Zadig & Voltaire", "Theory", "Vince", "AllSaints",
  "Reiss", "Massimo Dutti", "A.P.C.", "Anine Bing", "Reformation",
  "Ralph Lauren", "Calvin Klein", "Hugo Boss", "Tommy Hilfiger",
  "Levi's", "Levis", "Diesel", "Zara", "H&M", "Mango", "Uniqlo",
  "Nike", "Adidas", "New Balance", "Converse", "Vans",
  "Lexington", "Gant", "Peak Performance", "Fjällräven", "Fjallraven",
  "Vagabond", "Dr. Martens", "Birkenstock", "Golden Goose", "Veja",
].sort((a, b) => b.length - a.length);

function extractBrand(title: string): { brand: string; cleanedName: string } {
  const lower = title.toLowerCase().trim();
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) {
      const idx = lower.indexOf(b.toLowerCase());
      const cleaned = (title.substring(0, idx) + title.substring(idx + b.length))
        .replace(/^[\s\-–—,.:]+/, '').replace(/[\s\-–—,.:]+$/, '').replace(/\s+/g, ' ').trim();
      return { brand: b, cleanedName: cleaned || title };
    }
  }
  return { brand: '', cleanedName: title };
}

const SIZE_PATTERNS = [
  /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL)\b/i,
  /\bstorlek\s*(\d{2})\b/i, /\bsize\s*(\d{2})\b/i,
  /\b(?:EU|EUR)\s*(\d{2}(?:[.,]\d)?)\b/i,
  /\b(one\s*size|OS)\b/i, /\b(en\s*storlek)\b/i,
];

function parseSize(text: string): string | null {
  for (const p of SIZE_PATTERNS) { const m = text.match(p); if (m) return m[1] || m[0]; }
  return null;
}

const COLOR_MAP: Record<string, string> = {
  black:'Black',white:'White',red:'Red',blue:'Blue',navy:'Navy',green:'Green',
  brown:'Brown',beige:'Beige',grey:'Grey',gray:'Grey',pink:'Pink',purple:'Purple',
  orange:'Orange',yellow:'Yellow',cream:'Cream',burgundy:'Burgundy',olive:'Olive',
  camel:'Camel',silver:'Silver',gold:'Gold',
  svart:'Black',vit:'White',röd:'Red',blå:'Blue',grön:'Green',brun:'Brown',
  grå:'Grey',rosa:'Pink',lila:'Purple',gul:'Yellow',mörkblå:'Navy',vinröd:'Burgundy',
};

function parseColor(text: string): string | null {
  const lower = text.toLowerCase();
  const found: string[] = []; const seen = new Set<string>();
  for (const [w, c] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower) && !seen.has(c)) { found.push(c); seen.add(c); }
  }
  return found.length > 0 ? found.join(', ') : null;
}

const MAT_MAP: Record<string, string> = {
  wool:'Wool',leather:'Leather',cotton:'Cotton',silk:'Silk',denim:'Denim',
  cashmere:'Cashmere',linen:'Linen',polyester:'Polyester',suede:'Suede',
  velvet:'Velvet',tweed:'Tweed',viscose:'Viscose',mohair:'Mohair',alpaca:'Alpaca',
  ull:'Wool',läder:'Leather',skinn:'Leather',bomull:'Cotton',siden:'Silk',
  linne:'Linen',sammet:'Velvet',mocka:'Suede',kashmir:'Cashmere',
};

function parseMaterial(text: string): string | null {
  const lower = text.toLowerCase();
  const found: string[] = []; const seen = new Set<string>();
  for (const [w, c] of Object.entries(MAT_MAP)) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower) && !seen.has(c)) { found.push(c); seen.add(c); }
  }
  return found.length > 0 ? found.join(', ') : null;
}

const COND_KW = [
  { p: /\b(new with tags|NWT|oanvänd|ny med etikett)\b/i, l: 'New with tags' },
  { p: /\b(brand new|helt ny|nyskick)\b/i, l: 'New' },
  { p: /\b(like new|som ny)\b/i, l: 'Like new' },
  { p: /\b(excellent|utmärkt|mycket gott skick)\b/i, l: 'Excellent' },
  { p: /\b(very good|mycket bra)\b/i, l: 'Very good' },
  { p: /\b(good|gott skick|bra skick)\b/i, l: 'Good' },
  { p: /\b(fair|hyfsad|ok skick)\b/i, l: 'Fair' },
];
const COND_ENUM: Record<string, string> = { new:'New', excellent:'Excellent', good:'Good', fair:'Fair' };

function parseCondition(enumVal: string | null, desc: string): string | null {
  if (enumVal && enumVal !== 'unknown' && COND_ENUM[enumVal]) return COND_ENUM[enumVal];
  for (const { p, l } of COND_KW) { if (p.test(desc)) return l; }
  return enumVal ? COND_ENUM[enumVal] || null : null;
}

// ── Main handler ──

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth: admin or service role
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token === serviceRoleKey) {
    // ok
  } else if (token) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      const sc = createClient(supabaseUrl, serviceRoleKey);
      const { data: roleData } = await sc.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (!roleData) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // Select items where any structured field is NULL
  const { data: items, error: fetchErr } = await serviceClient
    .from('ancora_import_items')
    .select('id, title, title_original, title_en, description, description_original, description_en, images, condition, brand_text, size_text, color_text, material_text, condition_text, primary_image, marketplace, source_type')
    .or('brand_text.is.null,size_text.is.null,color_text.is.null,material_text.is.null,condition_text.is.null,primary_image.is.null,marketplace.is.null')
    .limit(200);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }

  let processed = 0, updated = 0, skippedNoText = 0, skippedNoImages = 0, errors = 0;

  for (const item of items || []) {
    processed++;

    const title = item.title_original || item.title_en || item.title || '';
    const desc = item.description_original || item.description_en || item.description || '';

    if (!title && !desc) { skippedNoText++; continue; }

    const combined = `${title} ${desc}`;
    const brandResult = extractBrand(title);
    const size = parseSize(combined);
    const color = parseColor(combined);
    const material = parseMaterial(combined);
    const condition = parseCondition(item.condition, desc);
    const images: string[] = item.images || [];

    // Build update payload — only fill NULL fields
    const patch: Record<string, unknown> = {};

    if (!item.brand_text && brandResult.brand) patch.brand_text = brandResult.brand;
    if (!item.size_text && size) patch.size_text = size;
    if (!item.color_text && color) patch.color_text = color;
    if (!item.material_text && material) patch.material_text = material;
    if (!item.condition_text && condition) patch.condition_text = condition;
    if (!item.primary_image && images.length > 0) patch.primary_image = images[0];
    if (!item.marketplace && item.source_type) patch.marketplace = item.source_type;

    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await serviceClient
      .from('ancora_import_items')
      .update(patch)
      .eq('id', item.id);

    if (upErr) { errors++; } else { updated++; }
  }

  console.log(`[ais-backfill] processed=${processed} updated=${updated} skippedNoText=${skippedNoText} errors=${errors}`);

  return new Response(JSON.stringify({ processed, updated, skipped_no_text: skippedNoText, skipped_no_images: skippedNoImages, errors }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
