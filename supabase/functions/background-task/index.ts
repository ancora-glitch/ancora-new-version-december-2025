import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background task that runs after the response is sent
async function backgroundTask(taskName: string) {
  console.log(`[Background Task] Starting: ${taskName}`);
  
  // Simulate some async work (e.g., database update, file processing, logging)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(`[Background Task] Completed: ${taskName}`);
  console.log("Hello from background");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskName = "default-task" } = await req.json().catch(() => ({}));
    
    console.log(`[Request] Received task request: ${taskName}`);

    // Start background task without blocking the response
    EdgeRuntime.waitUntil(backgroundTask(taskName));

    // Return immediate response while background task continues
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Task "${taskName}" started in background` 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Error]', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
