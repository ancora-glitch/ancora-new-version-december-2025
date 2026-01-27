import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Provided by the edge runtime; declare for type-checking.
declare const EdgeRuntime: {
  waitUntil: (promise: PromiseLike<unknown>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AnalyticsBeaconPayload = {
  event_type: string;
  page_path: string;
  metadata?: unknown;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // sendBeacon commonly uses text/plain, so parse from text.
    const raw = await req.text();
    const payload = JSON.parse(raw) as AnalyticsBeaconPayload;

    if (!isNonEmptyString(payload?.event_type) || !isNonEmptyString(payload?.page_path)) {
      return new Response(
        JSON.stringify({ error: "event_type and page_path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Don't block the response.
    EdgeRuntime.waitUntil(
      supabase
        .from("site_analytics")
        .insert([
          {
            event_type: payload.event_type,
            page_path: payload.page_path,
            metadata: payload.metadata ?? {},
          },
        ])
        .then(({ error }) => {
          if (error) console.error("analytics-beacon insert error:", error);
        }),
    );

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error("analytics-beacon error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
