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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { story_slug } = await req.json();

    if (!story_slug || typeof story_slug !== "string") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up story by slug — must be published
    const { data: story, error: storyError } = await supabase
      .from("style_guides")
      .select("id, status")
      .eq("slug", story_slug)
      .maybeSingle();

    if (storyError || !story || story.status !== "published") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Hash IP and user-agent
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const ipHash = await sha256(clientIp);
    const uaHash = await sha256(userAgent);

    // Anti-spam: check for existing view from same IP within 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: existing } = await supabase
      .from("story_views")
      .select("id")
      .eq("story_id", story.id)
      .eq("ip_hash", ipHash)
      .gte("viewed_at", sixHoursAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already viewed recently
      return new Response(JSON.stringify({ success: true, deduplicated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert view
    const { error: insertError } = await supabase
      .from("story_views")
      .insert({
        story_id: story.id,
        ip_hash: ipHash,
        user_agent_hash: uaHash,
      });

    if (insertError) {
      console.error("register-story-view insert error:", insertError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("register-story-view error:", error);
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});
