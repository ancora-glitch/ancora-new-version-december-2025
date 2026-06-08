import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  image: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  userText: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are a fashion analyst for a curated second hand platform. Analyze the garment in the image and return ONLY a JSON object with these fields:
- keywords: array of 3-5 search terms in Swedish (e.g. ["marinblå", "blazer", "oversized", "strukturerad"])
- garment_type: single word in Swedish (e.g. "blazer")
- style_notes: one sentence in Swedish describing style and feel
Never include brand names in keywords unless clearly visible on the garment.
Return only valid JSON, no markdown, no preamble.`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY missing" });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return json(400, { error: parsed.error.flatten().fieldErrors });
  }
  const { image, mimeType, userText } = parsed.data;

  // Approx decoded size check (base64 → bytes)
  const approxBytes = Math.floor((image.length * 3) / 4);
  if (approxBytes > 5 * 1024 * 1024) {
    return json(413, { error: "Image too large (max 5MB)" });
  }

  const userPrompt =
    SYSTEM_PROMPT +
    (userText && userText.trim().length > 0
      ? `\n\nAnvändaren beskriver också: ${userText.trim()}`
      : "");

  try {
    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: image },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("Anthropic error", anthropicResp.status, errText);
      return json(502, { error: "Anthropic API call failed", status: anthropicResp.status });
    }

    const data = await anthropicResp.json();
    const text: string = data?.content?.[0]?.text ?? "";

    let result: { keywords: string[]; garment_type: string; style_notes: string };
    try {
      result = JSON.parse(text);
    } catch {
      try {
        result = JSON.parse(stripFences(text));
      } catch {
        console.error("Failed to parse Claude JSON:", text);
        return json(502, { error: "Invalid model response" });
      }
    }

    if (
      !Array.isArray(result?.keywords) ||
      typeof result?.garment_type !== "string" ||
      typeof result?.style_notes !== "string"
    ) {
      return json(502, { error: "Malformed model response" });
    }

    return json(200, {
      keywords: result.keywords.map((k) => String(k)),
      garment_type: result.garment_type,
      style_notes: result.style_notes,
    });
  } catch (err) {
    console.error("analyze-garment error", err);
    return json(500, { error: "Internal error" });
  }
});
