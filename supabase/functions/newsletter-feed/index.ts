import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const FEED_URL = "https://theancoraedit.substack.com/feed";
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
});

interface NewsletterPost {
  title: string;
  excerpt: string;
  url: string;
  image: string | null;
  publishedAt: string | null;
}

// Substack post bodies start with the masthead banner, so prefer the SECOND
// image; fall back to the only image when there is just one.
function bodyImageFromHtml(html: string | undefined): string | null {
  if (!html) return null;
  const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
  if (matches.length === 0) return null;
  return matches[1] ?? matches[0];
}

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function clampLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

async function resolveLimit(req: Request): Promise<number> {
  const url = new URL(req.url);
  const qsLimit = url.searchParams.get("limit");
  if (qsLimit) return clampLimit(qsLimit);

  if (req.method === "POST") {
    try {
      const body = await req.clone().json();
      if (body?.limit) return clampLimit(body.limit);
    } catch {
      // no/invalid body, fall through to default
    }
  }
  return DEFAULT_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const limit = await resolveLimit(req);

    const feedRes = await fetch(FEED_URL, {
      headers: { "User-Agent": "AncoraEdit-NewsletterFeed/1.0" },
    });

    if (!feedRes.ok) {
      throw new Error(`Feed fetch failed with status ${feedRes.status}`);
    }

    const xml = await feedRes.text();
    const parsed = parser.parse(xml);
    const rawItems = parsed?.rss?.channel?.item ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const posts: NewsletterPost[] = items.slice(0, limit).map((item: any) => {
      const contentHtml: string | undefined =
        item?.["content:encoded"]?.__cdata ?? item?.["content:encoded"];
      const description: string = item?.description?.__cdata ?? item?.description ?? "";

      const image = firstImageFromHtml(contentHtml) ?? item?.enclosure?.["@_url"] ?? null;

      return {
        title: item?.title?.__cdata ?? item?.title ?? "",
        excerpt: truncate(stripHtml(description)),
        url: item?.link?.__cdata ?? item?.link ?? "",
        image,
        publishedAt: item?.pubDate ? new Date(item.pubDate).toISOString() : null,
      };
    });

    return new Response(JSON.stringify(posts), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("newsletter-feed error:", err);
    return new Response(JSON.stringify({ error: "Failed to load newsletter feed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
