# Newsletter Feed (Substack) on Stories

Pull the public Substack RSS feed into the site as a read-only section at the top of `/stories`, above the existing style guides. Fully isolated: no database tables, no products/enum/editorial changes, no cron wiring.

## What gets built

1. **Edge function `newsletter-feed`** — fetches `https://theancoraedit.substack.com/feed` server-side, parses each item into `{ title, excerpt, url, image, publishedAt }`, returns JSON with open CORS and 1-hour caching. Fails quietly with a 502 JSON error instead of throwing.
2. **Hook `useNewsletterFeed(limit)`** — invokes the function, returns `{ posts, loading, error }`.
3. **Component `NewsletterStories`** — renders the posts in an editorial card grid matching the existing Stories look (Playfair headings, burgundy accents, `aspect-[4/5]` images, lazy loading, native `<a target="_blank" rel="noopener">` for outbound Substack links). Renders nothing on error.
4. **`/stories` page** — newsletter section first, existing style guide grid below it, unchanged.

Homepage is not touched.

## Technical details

- `supabase/functions/newsletter-feed/index.ts` uses `fast-xml-parser@4.5.0` via esm.sh, `ignoreAttributes: false`, `cdataPropName: "__cdata"`.
- Limit resolved from `?limit=` query string or JSON POST body; default 6, max 20.
- `image`: first `<img src>` inside `content:encoded`, falling back to `enclosure/@_url`, else `null`.
- `excerpt`: `<description>` with HTML stripped, collapsed whitespace, truncated at ~200 chars on a word boundary.
- `publishedAt`: ISO string from `pubDate`.
- Headers: `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600, stale-while-revalidate=3600`.
- `supabase/config.toml` gets `[functions.newsletter-feed] verify_jwt = false` in line with the other public functions.
- Hook imports the client from `@/integrations/supabase/client` (confirmed path).
- The provided component JSX arrived with its markup stripped by markdown, so the markup will be rewritten to match existing Stories card styling while keeping the same props (`limit`, `title`, `showTitle`) and behavior.

## Verification

- Call the deployed function directly and confirm it returns parsed posts (title, excerpt, image, date) and a clean 502 shape on failure.
- Load `/stories` and confirm newsletter cards render above the style guides, links open Substack in a new tab, and the page still renders if the feed is unavailable.
- `tsgo --noEmit`.

## Not touched

`products` table, editorial fields, status enum, `tradera-sync`, `ebay-availability`, `tradera-retry-import`, Tradera quota logic, homepage.
