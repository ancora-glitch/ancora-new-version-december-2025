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
    console.log('translate-swedish: auth failed — missing token');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (token === serviceRoleKey) {
    console.log('translate-swedish: auth via service-role key');
    return { authorized: true, userId: 'service-role' };
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    console.log('translate-swedish: auth failed — invalid token');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const userId = user.id;
  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
  const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (!roleData) {
    console.log('translate-swedish: auth failed — not admin');
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  console.log('translate-swedish: auth via jwt (admin)');
  return { authorized: true, userId };
}

interface TranslationRequest {
  name: string;
  description?: string;
  condition?: string;
  material?: string;
  size?: string;
  brand?: string;
}

interface TranslationResponse {
  name: string;
  description: string;
  condition: string;
  material: string;
  size: string;
  original: {
    name: string;
    description: string;
    condition: string;
    material: string;
    size: string;
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAdmin(req);
  if (!authResult.authorized) return authResult.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const data: TranslationRequest = await req.json();
    const { name, description, condition, material, size, brand } = data;

    console.log('Translating Swedish content for:', name);

    const systemPrompt = `You are a professional translator specializing in luxury fashion and resale. Translate Swedish text to natural, editorial English suitable for a high-end fashion resale platform.

Guidelines:
- Use elegant, sophisticated language appropriate for luxury fashion
- Keep brand names, proper nouns, measurements (cm, EU sizes), and condition grades unchanged
- Translate descriptive terms naturally, not literally
- For condition terms: "Nytt/Nyskick" = "New/Like New", "Mycket bra skick" = "Excellent", "Bra skick" = "Very Good", "Acceptabelt skick" = "Good"
- For materials: translate fabric names naturally (e.g., "ull" = "wool", "siden" = "silk", "bomull" = "cotton")
- Size notes should retain any numeric values but translate descriptive terms
- If text appears to already be in English, return it as-is
- Never add information that wasn't in the original

Return a JSON object with these exact keys: name, description, condition, material, size`;

    const userPrompt = `Translate the following Swedish product listing to editorial English. The brand is "${brand || 'Unknown'}" (keep brand name unchanged).

Title: ${name || ''}
Description: ${description || ''}
Condition: ${condition || ''}
Material: ${material || ''}
Size notes: ${size || ''}

Return JSON with keys: name, description, condition, material, size`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse the JSON response from the AI
    let translated: { name?: string; description?: string; condition?: string; material?: string; size?: string };
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translated = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fall back to original values if parsing fails
      translated = {
        name: name || '',
        description: description || '',
        condition: condition || '',
        material: material || '',
        size: size || '',
      };
    }

    const result: TranslationResponse = {
      name: translated.name || name || '',
      description: translated.description || description || '',
      condition: translated.condition || condition || '',
      material: translated.material || material || '',
      size: translated.size || size || '',
      original: {
        name: name || '',
        description: description || '',
        condition: condition || '',
        material: material || '',
        size: size || '',
      },
    };

    console.log('Translation complete:', result.name);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
