## Goal
Allow editors to insert a link to an internal product inside a Story's body. The link renders as a small card with image and title (and price), placed inline in the article and clicking it opens the product detail page.

## UX

**Editor (Admin → Stories)**
- New toolbar button next to "Insert Image" called **"Insert Product"**.
- Opens a dialog with a search field that filters across all products (brand + name).
- Clicking a product inserts a token at the cursor position in the body, e.g.:

  ```
  [[product:product-slug-here]]
  ```

- Same insertion logic as inline images (handles surrounding newlines).

**Reader (public Story page)**
- The token is rendered as a small inline product card:

  ```text
  ┌──────────────────────────────────────┐
  │ [img]  Brand Name                    │
  │        Product name                  │
  │        Price         →               │
  └──────────────────────────────────────┘
  ```
- Whole card is a link to `/product/<slug>`.
- Styled with existing tokens (border, bg-card, hover state matching other interactive cards per memory).
- If product no longer exists / is unavailable → token is silently removed (no broken card).

## Technical Plan

**Files touched (frontend only, presentation layer):**
1. `src/pages/AdminPortal.tsx` — add "Insert Product" button + product picker dialog (mirrors existing inline-image dialog). Reuses `useAllProducts()`.
2. `src/pages/StyleGuide.tsx` — body renderer: detect `[[product:<slug>]]` tokens, fetch the referenced products once via Supabase, replace tokens with React-rendered cards.
3. `src/pages/StoryPreview.tsx` — same renderer change so preview matches public.

**Renderer approach**
- Currently body is rendered with `dangerouslySetInnerHTML`. To embed real React `<Link>` cards, switch to splitting the body into segments: HTML chunks (existing markdown/image processing) and product-card chunks. Render the array as: `<div dangerouslySetInnerHTML />` for HTML segments and `<ProductInlineCard slug=… />` for tokens.
- New small component `ProductInlineCard` (can live in `src/components/`) that accepts a slug + product object and renders the card.
- Fetch all referenced products in one query: `supabase.from('products').select('slug,brand,name,price,image').in('slug', slugs)`.

**No changes to:**
- Database schema (slug already lives in body text)
- Edge functions
- Data sync, intake, or any non-Stories component

## Out of scope
- Product picker for the homepage / weekly edit (already exists separately).
- Updating older stories — they continue to render exactly as today; only the new token is special.
