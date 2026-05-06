# Plan: Uppdatera ANCORA_MASTER_SPEC.md med Inline product embeds

## Mål
Dokumentera dagens leverans (inbäddade produktkort i Stories) i master spec som ny feature **F-22**, samt lägga till render-invarianten i relevant befintlig sektion.

## Ändringar i `ANCORA_MASTER_SPEC.md`

### 1. Ny feature F-22 (efter F-21, runt rad 2457)
Lägga in en ny sektion:

```
F-22 Inline product embeds in Stories
Owner: Stories editor + StoryBody renderer

Touches: Story body rendering (public + preview), Admin Story editor

Key paths:

FE renderer: src/components/StoryBody.tsx (centralized body renderer)

FE consumers: src/pages/StyleGuide.tsx, src/pages/StoryPreview.tsx

Admin: src/pages/AdminPortal.tsx (Story editor "Insert Product" action)

Token format: [[product:<slug>]]
- slug matches /^[a-z0-9-]+$/
- Resolved at render time via single Supabase query on products(slug,brand,name,price,image)
- Missing/unpublished slug → silently omitted (no broken state)

Rendering invariant: Story body MUST be rendered through <StoryBody />.
No direct dangerouslySetInnerHTML on story body in any view.
StoryBody preserves existing markdown helpers (inline images ![cap](url),
**bold**, *italic*) and sanitizes via DOMPurify.

Admin UX: "Insert Product" button in Story editor opens product picker
(search by brand/name) and inserts the token at the caret. Manual entry of
the token is supported but discouraged.

Out of scope: no schema change (body remains text), no changes to cron,
quota, enums, or editorial-field protection.
```

### 2. Uppdatera Stories-sektionen (rad ~934, "5.2 Stories / Style Guides")
Lägga till en kort rad under befintlig beskrivning:
- "Body supports inline product embeds via `[[product:<slug>]]` tokens — see F-22."

### 3. Uppdatera F-19 (rad 2421) "Touches"
Lägga till: "Inline product embeds (F-22) rendered via StoryBody."

## Memory-uppdatering (separat)
Lägga till en ny minnesfil `mem://features/stories/inline-product-embeds` med token-format + render-invariant, och länka in den under "Pages & Sections" i `mem://index.md`.

## Inga kodändringar
Endast spec- och memory-dokumentation. Inga filer under `src/` eller `supabase/` rörs.
