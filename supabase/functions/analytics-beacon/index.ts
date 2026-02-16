import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Provided by the edge runtime; declare for type-checking.
declare const EdgeRuntime: {
  waitUntil: (promise: PromiseLike<unknown>) => void;
};

const ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = origin.endsWith('.lovable.app') ? origin : 'https://ancoraedit.lovable.app';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  };
}

type AnalyticsBeaconPayload = {
  event_type: string;
  page_path: string;
  metadata?: Record<string, unknown>;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let payload: AnalyticsBeaconPayload;

    if (req.method === "GET") {
      // Handle anchor ping via query params
      const url = new URL(req.url);
      const event_type = url.searchParams.get("event_type") || "";
      const page_path = url.searchParams.get("page_path") || "/buy-now";
      
      // Build metadata from query params
      const metadata: Record<string, string> = {};
      const metaKeys = ["product_id", "product_name", "brand", "price", "destination", "type"];
      for (const key of metaKeys) {
        const val = url.searchParams.get(key);
        if (val) metadata[key] = val;
      }
      
      payload = { event_type, page_path, metadata };
    } else if (req.method === "POST") {
      // Handle sendBeacon POST (text/plain or application/json)
      const raw = await req.text();
      payload = JSON.parse(raw) as AnalyticsBeaconPayload;
    } else {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    if (!isNonEmptyString(payload?.event_type)) {
      console.log("analytics-beacon: missing event_type, ignoring");
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("analytics-beacon: inserting", payload.event_type, payload.page_path);

    // Don't block the response - insert in background
    EdgeRuntime.waitUntil(
      supabase
        .from("site_analytics")
        .insert([
          {
            event_type: payload.event_type,
            page_path: payload.page_path || "/buy-now",
            metadata: payload.metadata ?? {},
          },
        ])
        .then(({ error }) => {
          if (error) console.error("analytics-beacon insert error:", error);
          else console.log("analytics-beacon: insert success");
        }),
    );

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error("analytics-beacon error:", error);
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});
