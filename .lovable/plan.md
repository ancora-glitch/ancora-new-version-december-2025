# Plan: Visual garment analysis in Sourcing Tool

Adds an image upload flow to the admin Sourcing Tool. The image is sent to a new Supabase Edge Function that calls Anthropic Claude (vision) using the existing `ANTHROPIC_API_KEY` secret, then returns Swedish keywords + style notes that auto-fill the search field.

## 1. New Edge Function — `supabase/functions/analyze-garment/index.ts`

- POST endpoint, CORS-enabled (`OPTIONS` preflight + headers on all responses, including errors).
- Input validation with Zod:
  - `image`: base64 string (no data URL prefix)
  - `mimeType`: one of `image/jpeg`, `image/png`, `image/webp`
  - `userText`: optional string, max ~500 chars
  - Reject payloads where decoded image > 5MB.
- Reads `ANTHROPIC_API_KEY` from `Deno.env`; returns 500 if missing.
- Calls `https://api.anthropic.com/v1/messages` with model `claude-sonnet-4-20250514`, `max_tokens: 512`, a single user message containing:
  - an `image` block (`type: base64`, the mimeType, the base64 data)
  - a `text` block with the system instructions (the exact prompt in the request) plus, if provided, `Användaren beskriver också: {userText}`.
- Parses Claude's text output as JSON. If parsing fails, strip ```json fences and retry; on failure return 502 with a clean error.
- Returns `{ keywords: string[], garment_type: string, style_notes: string }` to the client.
- No `supabase/config.toml` edit needed — function deploys with default `verify_jwt = false` like the other Lovable-managed functions in this project. Function is only invoked from the admin tool but does not itself require auth (no DB writes, no secrets leaked).

No DB migration. No changes to other functions or cron.

## 2. `src/components/admin/SourcingTool.tsx` — image upload section

New section rendered **above** the existing "Sök" card (keeps filter panel order intact):

- Drag-and-drop area + click-to-upload button labeled **"Ladda upp plagg för visuell sökning"**.
- Accepts `image/jpeg`, `image/png`, `image/webp`, max 5MB. Client-side checks both type and size before upload.
- On file selected:
  - Show thumbnail (object URL) + spinner with **"Analyserar plagget…"**.
  - Read file as base64, strip the `data:...;base64,` prefix, call the edge function via `supabase.functions.invoke("analyze-garment", { body: { image, mimeType, userText: query || undefined } })`.
- On success:
  - Set `query` state to `keywords.join(" ")` (user can still edit).
  - Store `styleNotes` and render small italic muted text under the search input: **"Claude ser: {style_notes}"**.
  - Show a small "Ta bort bild" button to clear the preview + style notes.
- Error handling:
  - File > 5MB → toast **"Bilden är för stor, max 5MB"**.
  - Wrong mime → toast **"Endast jpg, png eller webp"**.
  - Edge function failure / invalid JSON → toast + inline notice **"Kunde inte analysera bilden — skriv sökord manuellt"**; user can continue as normal.
- Search button behavior unchanged (requires non-empty query + at least one brand selected). No changes to brand/size filters or URL generation.

Uses existing shadcn primitives (`Card`, `Button`, `Input`) and design tokens — no new colors. Matches the existing admin card look exactly.

## Out of scope

- No changes to brand list, sizes, URL patterns, or source cards.
- No changes to other admin tabs, imports, cron, or quotas (Anthropic is not part of the Tradera/eBay 75-call governance).
- No master spec / context doc updates in this round — happy to add a v1.10 changelog entry in a follow-up once the feature is verified.

## Open questions

1. Should the edge function require an authenticated admin caller (verify JWT + check `has_role(uid, 'admin')`), or stay open like the other Lovable-managed functions? It's only used from the admin tool, but leaving it open means anyone with the URL can spend Anthropic credits. **Recommendation: require auth + admin role check.**
2. OK to use `claude-sonnet-4-20250514` exactly as specified, or should I fall back to the latest Sonnet if Anthropic returns model-not-found?
