# ANCORA — MASTER PROJECT SPECIFICATION

**Version:** 1.0
**Status:** Production MVP
**Purpose:** System blueprint for AI-assisted regeneration and extension

---

## 1. PRODUCT PURPOSE

### 1.1 Vision

Ancora är ett redaktionellt lager ovanpå second hand-marknaden.

Det är:
- Inte en marketplace
- Inte ett lagerhållande bolag
- Inte ett checkout-system

Det är:
→ Ett kuraterat gränssnitt
→ En trafikmotor
→ En redaktionell shopping-upplevelse
→ Ett API-agnostiskt importlager

### 1.2 Problem

Second hand-marknaden är:
- Fragmenterad
- Sökdriven
- Tidskrävande
- Datamässigt ostrukturerad

Ancora löser detta genom:
- Standardiserad datamodell
- Redaktionsstyrd selektion
- Strukturerade produktfält
- Affiliate-trafik istället för transaktion

---

## 2. SYSTEM OVERVIEW

Ancora består av 5 huvudlager:
- Import Layer (Adapter-based)
- Product Layer (Canonical Product Model)
- Editorial Layer (Stories / Guides)
- Availability Layer (Sold detection + cron)
- Analytics Layer (Views + cron telemetry)

---

## 3. DATA MODEL

### 3.1 Canonical Product Model (Products Table)

Products är systemets sanning.

**Core Fields**
- id
- name
- name_en
- name_original
- description
- description_en
- description_original
- brand
- brand_original
- color
- color_original
- size
- material
- material_original
- condition
- condition_original
- price
- currency
- image (primary)
- additional_images[]
- affiliate_url
- marketplace (tradera | ebay | manual)
- tradera_item_id (nullable)
- status (draft | published | sold | archived)
- unpublished_reason
- translated_at
- created_at
- updated_at

### 3.2 Import Log (AIS)

AIS är nu ett logglager.
- source_type
- source_ref
- raw payload reference
- mapped fields snapshot
- product_id
- status (promoted)

AIS är ej längre redaktionens arbetsyta.

---

## 4. IMPORT SYSTEM

### 4.1 Design Principle

Adapter Pattern.

Varje källa mappar till Product Model direkt.

Current Adapters:
- Tradera
- eBay

### 4.2 Tradera Import

**Data Source:**
SOAP GetItem

**Structured Term IDs:**
- term_121 → Skick
- term_105 → Material
- term_3 → Brand
- term_102 → Color

**Flow:**
1. Search Tradera
2. Fetch GetItem
3. Parse TermAttributeValues
4. Normalize SV → EN
5. Create Product draft

**Normalization Layer:**
SV → EN mapping for:
- condition
- material
- color

**Brand:**
- Clean formatting only
- Original SV stored in *_original

### 4.3 eBay Import

**Data Source:**
Browse API

**Flow:**
1. Search (GB marketplace)
2. Filter:
   - deliveryCountry=SE
   - buyingOptions=FIXED_PRICE
3. Fetch getItem endpoint for description enrichment
4. Create Product draft

Fallback description built from structured fields if missing.

---

## 5. EDITORIAL WORKFLOW

### 5.1 Products

**States:**
- draft
- published
- sold
- archived

Import → draft
Editor edits → publish

Cron never modifies editorial fields.

### 5.2 Stories / Style Guides

**Fields:**
- title
- body
- image
- status (draft/published)
- published_at

Only published visible publicly.

---

## 6. AVAILABILITY SYSTEM

### 6.1 Tradera Sold Detection

Mark sold if ANY:
- ItemStatus in ["Ended", "Closed", "Sold"]
- EndDate < now
- Quantity === 0
- BuyNowAvailable === false AND EndDate < now

**Cron:**
- Every 2 hours
- Batch size 25
- Round-robin cursor

### 6.2 eBay Sold Detection

Mark sold if:
- HTTP 404
- OUT_OF_STOCK
- quantity = 0
- endDate passed

Cron every 2 hours.

---

## 7. TRANSLATION SYSTEM

Only for Tradera.

**On import:**
- translate-swedish
- skip if likely English
- budget: 200 items/day
- concurrency-safe

**Stores:**
- *_original
- *_en

Frontend prioritizes *_en

---

## 8. ADMIN UI

**Tabs:**
- Products
- Imports
- Stories
- Statistics

**Imports:**
- Search Tradera
- Search eBay
- Backfill buttons
- Cron status
- Translation budget

---

## 9. SECURITY MODEL

- All admin functions require JWT + admin role
- Service role for cron
- CORS dynamic origin validation
- Input validation on all API params
- Rate limiting on eBay
- Tradera daily quota enforcement

---

## 10. COST OPTIMIZATION

- Cron every 2h
- Batch 25/run
- Cache versioning (v2)
- Fresh backfill optional

---

## 11. DESIGN PRINCIPLES

- API-agnostic core
- Editorial control over automation
- Never auto-overwrite human edits
- Defensive availability detection
- Normalized English surface
- Preserve original data

---

## 12. REBUILD INSTRUCTIONS (AI REGENERATION MODE)

To recreate system from scratch:
1. Create Product schema exactly as defined
2. Build adapter interface:
   transformExternalItem() → CanonicalProduct
3. Implement Tradera adapter with TermAttributeValue parsing
4. Implement eBay adapter with description enrichment
5. Implement normalization layer
6. Implement availability cron with signal detection
7. Implement draft → publish editorial workflow
8. Implement story CMS
9. Add admin analytics + view tracking
10. Apply security constraints

---

## 13. EXTENSION PROTOCOL

Future features must:
- Not mutate existing Product schema without migration note
- Not override manual edits
- Respect availability invariants
- Add new adapters via adapter pattern

---

## 14. CODE MAPPING SECTION

### 14.1 Repository Map (High-level)

**Frontend (Public site)**
- Visar produkter, stories, shop, product detail
- Får aldrig göra externa API-anrop mot partners (endast visar DB-data)

**Admin Portal**
- Import UI (Tradera/eBay) → skapar Products i draft
- Edit UI för Products / Stories
- Statistics UI (views, cron health, etc.)

**Edge Functions (Supabase functions)**
- Partner API calls (Tradera/eBay)
- Availability checks (cron)
- Retry/backfill utilities
- Translation utilities
- Health endpoints

**Database (Supabase/Postgres)**
- Canonical model: products
- Editorial: style_guides
- Import logs: ancora_import_items (AIS)
- Telemetry: cron_runs, cron_job_state
- Views: story_views, site_analytics
- Quota/cache: tradera_cache, tradera_usage, translation_usage, tradera_retry_jobs

### 14.2 Canonical Ownership Rules (What owns what)

Products table is canonical.
All import flows must end in products drafts.
AIS is logging/tracing only.

**Edge Functions own:**
- External partner API calls
- Auth checks for admin-only actions
- Rate limiting / quota logic
- Backfill jobs (batch operations)

**Frontend owns:**
- Rendering only
- No writes except analytics beacons / view tracking

**Admin UI owns:**
- Editor actions (publish/unpublish, edit fields)
- Triggering backfills / retries / health checks

### 14.3 Key Files and Modules (by responsibility)

#### A) Import UI (Admin)

**Tradera search/import UI**
- `src/components/admin/TraderaSearchDrawer.tsx`
- Responsibilities:
  - search Tradera (via edge function)
  - fetch GetItem details (via edge function) before creating draft
  - mapping → Product draft payload
  - translation trigger (Tradera → English)
  - logs mapping and guardrails
- Invariants:
  - If GetItem is rate-limited/fails → abort import (no partial draft)
  - Must use HD images (/images/ paths)
  - Must set primary image via hero selection

**eBay search/import UI**
- `src/components/admin/EbaySearchDrawer.tsx`
- Responsibilities:
  - search eBay via edge function (GB marketplace, EU location filter, shipping to SE, FIXED_PRICE)
  - enrich item via ebay-item for description
  - mapping → Product draft payload
- Invariants:
  - Always set affiliate_url
  - Ensure description non-empty via enrichment/fallback builder

**Import-to-Product hook**
- `src/hooks/useImportToProduct.ts`
- Responsibilities:
  - single entry-point to create Product drafts from adapter payload
  - dedupe: Tradera by tradera_item_id, eBay by affiliate_url
  - writes canonical fields to products
  - creates AIS "log record" linked by product_id (if enabled)

#### B) Parsing / Normalization (Shared libs)

**Listing parser**
- `src/lib/listingParser.ts`
- Responsibilities:
  - parse brand/size/color/material/condition from raw title+description
  - used as fallback if API doesn't provide structured values
- Invariants:
  - Parser must never override partner API-provided values

**Hero image selection**
- `src/lib/heroImageSelector.ts`
- Responsibilities:
  - choose best hero image from images array
- Invariants:
  - primary_image must be included in images[]
  - must prefer high-res, avoid detail closeups if possible

**Tradera normalization**
- `src/lib/traderaNormalization.ts`
- Responsibilities:
  - normalize SV → EN for Tradera-only fields:
    - condition/material/color/brand (brand mostly cleanup)
  - detect Swedish vs English heuristic
- Invariants:
  - Only applies when marketplace === 'tradera'
  - Store original values in *_original

#### C) Product Editing (Admin)

**Product form / save logic**
- (Likely) `src/components/admin/ProductForm.tsx` (name may vary)
- Responsibilities:
  - editor sees and edits display text fields
  - save must persist both base + _en fields to keep them in sync
- Invariants:
  - Editing in admin must not revert to imported text on save
  - Cron must never overwrite editorial fields

#### D) Public Site Rendering

**Product detail**
- `src/components/ProductDetail.tsx`
- Responsibilities:
  - render product fields
  - render image carousel from image + additional_images
  - render badge logic (marketplace / editorial override)
  - show English fields first: name_en || name, description_en || description
- Invariants:
  - Must not call partner APIs at runtime
  - Must gracefully handle additional_images being string/array/null

**Shop / listings**
- `src/pages/Shop.tsx` (or equivalent)
- Responsibilities:
  - display products based on status
  - use name_en where available

**Stories**
- `src/pages/stories/...` (varies)
- Responsibilities:
  - show only status='published'
  - trigger view registration

#### E) Stories workflow + view count

**Stories model / admin**
- Table: style_guides (stories)
- Admin list + filters: likely in `src/components/admin/StoriesTab.tsx`
- Public story pages filter by published

**Story views**
- Edge function: register-story-view
- DB: story_views
- Admin Statistics table shows totals + unique (7d/30d)

### 14.4 Edge Functions Map (Supabase functions)

Folder path depends on setup, but logically: `supabase/functions/<fn>/index.ts`

**Admin-only functions (JWT + admin role, plus service-role bypass for cron)**

- **tradera-search**
  Search endpoint for Tradera (and optionally quota check)

- **ebay-search**
  Search endpoint for eBay

- **ebay-item**
  Fetch full item details for description enrichment

- **tradera-sync** (cron)
  Availability check for Tradera products (batching + cursor)

- **ebay-availability** (cron)
  Availability check for eBay products (batching + cursor)

- **tradera-retry-import** (cron)
  Processes queued retry jobs for rate limited imports

- **translate-swedish**
  Translates SV → EN with heuristics/budget

- **translate-backfill** (if still present)
  Batch translate missing *_en fields

- **ais-backfill-parsed-fields** (if present)
  Batch parse structured fields into AIS (logging layer)

- **tradera-backfill-condition-material** (now includes brand/color too)
  Backfill missing Tradera fields (cached/fresh)

- **recheck-product**
  On-demand availability recheck for a single product

- **admin-health**
  DB ping + secrets present + queue readable + cron telemetry summary

**Public functions**
- analytics-beacon
- tradera-item (if left public by design)

NOTE: if used by admin only, consider making it admin-protected too

### 14.5 Database Map (Tables + ownership)

**Canonical**
- products — canonical inventory and editorial state

**Import/Operations**
- ancora_import_items — import log (AIS)
- tradera_cache — cached partner payloads (versioned)
- tradera_retry_jobs — rate-limit retry queue
- tradera_usage — daily quota counters
- translation_usage — translation budget counters

**Editorial**
- style_guides — stories with draft/published

**Telemetry / Health**
- cron_runs — cron execution logs
- cron_job_state — cursor for batching

**Analytics**
- site_analytics
- story_views

### 14.6 Invariants Checklist (must never regress)

**Import invariants**
- Tradera import must use GetItem images (/images/ HD) and import >= 3 images when available
- Hero image must be in images[]
- Imports create Products as draft (never auto-publish)
- Adapter priority: API values > parser fallback

**Editorial invariants**
- Cron jobs may only update:
  - status / unpublished_reason / ended metadata
- Cron must never overwrite:
  - name/description (any language fields)
  - brand/color/material/condition edited by humans

**Availability invariants**
- Tradera ended detection uses signals:
  ItemStatus, EndDate, Quantity, BuyNowAvailable
- eBay ended detection uses:
  404, OUT_OF_STOCK, quantity=0, endDate passed

**Translation invariants**
- Tradera only
- Store originals in *_original
- Display uses *_en fallback to base

**Security invariants**
- Admin functions require JWT + admin role
- Service role bypass allowed only for cron
- CORS allows preview origins (.lovable.app, .lovableproject.com)

### 14.7 "AI Sync Protocol" (how to update code safely)

When asked to add a feature, the AI must:
1. Identify which layer owns it (Admin UI, Edge, DB, Frontend, Cron)
2. Update spec first (this document), including:
   - new fields/tables
   - new edge functions
   - new invariants
   - updated mapping section
3. Generate a change plan:
   - migrations (if needed)
   - affected files
   - tests/guardrails
4. Implement minimal change set
5. Verify against invariants checklist
6. Add/adjust guard test(s) (e.g. forbidden pattern scan)

---

## 15. FEATURE INDEX

Syfte: En AI ska kunna slå upp en feature → se var den bor i kodbas/DB/edge functions → ändra utan att bryta invariants.

**Legend**
- **Owner:** Primär "source of truth" (var ändring ska börja)
- **Touches:** Vanliga sekundära beröringsytor
- **Key paths:** Viktigaste filer/edge functions/tabeller (namn kan variera något, men ska hållas synkade)

---

### F-01 Products: Draft/Published/Sold lifecycle

- **Owner:** Database + Admin UI
- **Touches:** Cron (availability), Frontend rendering
- **Key paths:**
  - DB: products
  - Cron: tradera-sync, ebay-availability
  - UI: Product list/filter + Product form (admin)
  - FE: ProductDetail + Shop

### F-02 Import: Tradera → Products (Draft)

- **Owner:** Admin UI (Tradera drawer) + Edge functions
- **Touches:** Normalization, Translation, Hero image selection
- **Key paths:**
  - UI: `src/components/admin/TraderaSearchDrawer.tsx`
  - Hook: `src/hooks/useImportToProduct.ts`
  - Edge: tradera-search, tradera-item
  - Lib: `src/lib/heroImageSelector.ts`, `src/lib/traderaNormalization.ts`
  - DB: products, (log) ancora_import_items

### F-03 Import: eBay → Products (Draft)

- **Owner:** Admin UI (eBay drawer) + Edge functions
- **Touches:** Description enrichment, shipping/location filters
- **Key paths:**
  - UI: `src/components/admin/EbaySearchDrawer.tsx`
  - Hook: `src/hooks/useImportToProduct.ts`
  - Edge: ebay-search, ebay-item
  - DB: products

### F-04 Import: Deduplication

- **Owner:** Import hook
- **Touches:** DB constraints/indexes (optional)
- **Key paths:**
  - Hook: `src/hooks/useImportToProduct.ts`
  - Logic: Tradera by tradera_item_id, eBay by affiliate_url

### F-05 Marketplace badge ("Tradera", "eBay", "Ancora selects from …")

- **Owner:** Frontend ProductDetail
- **Touches:** Product fields mapping
- **Key paths:**
  - FE: `src/components/ProductDetail.tsx`
  - DB fields: products.marketplace, products.ancora_select_source (if used)

### F-06 Image pipeline (HD + carousel + hero selection)

- **Owner:** Import adapters + ProductDetail rendering
- **Touches:** Backfill, invariants/logging
- **Key paths:**
  - Lib: `src/lib/heroImageSelector.ts`
  - FE: ProductDetail carousel logic
  - Import: Tradera/eBay drawers + mapping
  - DB: products.image, products.additional_images

### F-07 Tradera rate-limit resilience (quota + retry jobs)

- **Owner:** Edge functions + DB
- **Touches:** Admin UI retry queue panel
- **Key paths:**
  - Edge: tradera-search, tradera-item, tradera-retry-import
  - DB: tradera_usage, tradera_cache, tradera_retry_jobs
  - UI: Imports header/queue panel

### F-08 Availability checks: Auto-unpublish sold/ended listings

- **Owner:** Cron edge functions
- **Touches:** Product status logic, admin "Recheck now"
- **Key paths:**
  - Edge cron: tradera-sync, ebay-availability
  - Edge manual: recheck-product
  - DB: products.status, unpublished_reason, marketplace, tradera_item_id, affiliate_url

### F-09 Tradera ended-detection logic (the "ended but still visible" bug class)

- **Owner:** tradera-sync + Tradera parsing
- **Touches:** tradera-item GetItem parsing
- **Key paths:**
  - Edge: tradera-sync, tradera-item
  - Logic: signals from ItemStatus, EndDate, Quantity, BuyNowAvailable

### F-10 Tradera cache/versioning

- **Owner:** Edge functions + DB
- **Touches:** Backfill jobs
- **Key paths:**
  - DB: tradera_cache.cache_version
  - Edge: tradera-item, tradera-backfill-condition-material (fresh/cached modes)

### F-11 Translation: Tradera SV → EN

- **Owner:** Translation edge + Import adapters
- **Touches:** Products edit form, Frontend render fallback
- **Key paths:**
  - Edge: translate-swedish, translate-backfill (if present)
  - UI: Tradera drawer import translation call
  - Admin: Product form loads/saves *_en
  - FE: uses name_en || name, description_en || description
  - DB: products.name_en, products.description_en, *_original, translated_at, language
  - DB budgets: translation_usage

### F-12 Normalization: Tradera condition/material/color/brand SV → EN (standardized)

- **Owner:** `src/lib/traderaNormalization.ts` + import mapping
- **Touches:** Backfill
- **Key paths:**
  - Lib: `src/lib/traderaNormalization.ts`
  - Edge: tradera-backfill-condition-material (now includes brand/color too)
  - DB: products.condition/material/color/brand + *_original

### F-13 Structured field extraction (parser fallback)

- **Owner:** `src/lib/listingParser.ts`
- **Touches:** Import adapters
- **Key paths:**
  - Lib: `src/lib/listingParser.ts`
  - Adapters: Tradera/eBay drawers (priority: API > parser)

### F-14 AIS (Ancora Import Spec) as import log

- **Owner:** Database + Imports UI
- **Touches:** Backfill parsed fields
- **Key paths:**
  - DB: ancora_import_items
  - UI: Imports tab ("Import log")
  - Edge: ais-backfill-parsed-fields (if present)

### F-15 Admin health checks (system visibility)

- **Owner:** admin-health edge function + Imports header UI
- **Touches:** cron_runs, retry queue, secrets presence
- **Key paths:**
  - Edge: admin-health
  - UI: Imports header health row

### F-16 Cron telemetry + batching/cursor state

- **Owner:** Cron edge functions + DB
- **Touches:** Admin UI display
- **Key paths:**
  - DB: cron_runs, cron_job_state
  - Edge: tradera-sync, ebay-availability, tradera-retry-import

### F-17 Security: Admin-only edge function auth

- **Owner:** Edge function auth wrapper
- **Touches:** user_roles table, CORS
- **Key paths:**
  - Edge: verify via getUser() + user_roles lookup + service-role bypass
  - DB: user_roles

### F-18 CORS for preview environments

- **Owner:** Shared CORS helper in edge functions
- **Touches:** all edge functions
- **Key paths:**
  - Edge: getCorsHeaders(req) allows .lovable.app + .lovableproject.com, sets Vary: Origin

### F-19 Stories workflow (draft/published/archived)

- **Owner:** DB + Admin Stories UI
- **Touches:** Public stories routes
- **Key paths:**
  - DB: style_guides.status, published_at, unpublished_at
  - Admin: Stories list/filter + publish/unpublish buttons
  - FE: /stories only shows published

### F-20 Story views (total + unique 7d/30d)

- **Owner:** story view edge + statistics UI
- **Touches:** anti-spam dedup
- **Key paths:**
  - Edge: register-story-view
  - DB: story_views (ip_hash + dedup window)
  - Admin: Statistics "Story Views" table

### F-21 Statistics: product clicks / intent rate / unique visitors

- **Owner:** Analytics pipeline
- **Touches:** admin exclusion, date filters
- **Key paths:**
  - DB: site_analytics (+ visitor_id)
  - Admin: Statistics UI, intent rate formula

---

### 15.1 How to reference features in future prompts

When you ask an AI to change something, use:
- Feature ID (e.g. F-08)
- Desired behavior
- Constraints/invariants
- Acceptance criteria
- Files to touch (if known)

**Example:**

> "Update F-08 Availability checks: Tradera ended detection must also treat BuyNowAvailable=false as ended even if ItemStatus is blank. Keep invariant: cron never overwrites editorial fields."

---

## 15.3 Naming & Enum Registry

**Regel:** Alla enums är lowercase snake_case.
**Regel:** Marketplace-identifierare är lowercase.
**Regel:** UI-labels är separata från enum-värden.

---

### 15.3.1 products.status

**Column:** products.status
**Type:** string enum
**Allowed values:**
- draft
- published
- sold
- archived

**Meaning**
- **draft** — Ej synlig publikt. Skapad via import eller manuellt.
- **published** — Synlig publikt.
- **sold** — Automatiskt eller manuellt avpublicerad pga affiliate otillgänglig.
- **archived** — Manuellt borttagen från publikt flöde (ej sold).

**Invariants**
- Cron får endast sätta sold
- Import sätter alltid draft
- Public site visar endast published

---

### 15.3.2 products.marketplace

**Column:** products.marketplace
**Type:** string enum
**Allowed values (MVP):**
- tradera
- ebay
- manual

**Future extension pattern**
För Shopify-partners:
`shopify:<partner_slug>`
Ex: `shopify:vintagesphere`

**Invariants**
- Alltid lowercase
- Aldrig "Tradera" eller "Ebay"
- Används i availability cron
- UI-label mappas separat

---

### 15.3.3 products.unpublished_reason

**Column:** products.unpublished_reason
**Type:** string enum (nullable)
**Allowed values:**
- affiliate_unavailable
- ended
- sold
- manual_unpublish
- data_incomplete

**Invariants**
- Cron använder endast:
  - affiliate_unavailable
  - ended
  - sold
- Admin kan använda manual_unpublish

---

### 15.3.4 ancora_import_items.source_type

**Column:** ancora_import_items.source_type
**Type:** string enum
**Allowed values:**
- tradera
- ebay
- manual

**Rule**
Måste spegla products.marketplace exakt (när kopplad).

---

### 15.3.5 style_guides.status (Stories)

**Column:** style_guides.status
**Type:** string enum
**Allowed values:**
- draft
- published
- archived

**Public rule**
Frontend visar endast: `published`

---

### 15.3.6 Condition canonical values (products.condition)

**Column:** products.condition
**Type:** string enum (soft enum, ej hård DB constraint)
**Allowed normalized English values:**
- new
- very_good
- good
- fair
- poor

**Display mapping**

| DB value | UI label |
|----------|----------|
| new | New |
| very_good | Very good |
| good | Good |
| fair | Fair |
| poor | Poor |

**Tradera mapping examples**

| SV | Canonical |
|----|-----------|
| Oanvänd | new |
| Mycket gott skick | very_good |
| Gott skick | good |
| Använt skick | fair |

---

### 15.3.7 Material canonical values

**Column:** products.material
**Type:** string (controlled vocabulary, not strict enum)

**Preferred normalized values:**
- wool
- cotton
- leather
- silk
- linen
- cashmere
- polyester
- denim
- suede
- synthetic

**Rule**
- Lowercase
- Singular form
- Original stored in material_original

---

### 15.3.8 Color canonical values

**Column:** products.color
**Type:** string (controlled vocabulary)

**Preferred values:**
- black
- white
- brown
- beige
- grey
- blue
- navy
- green
- red
- pink
- purple
- yellow
- multi

**Rule**
- Lowercase
- English only
- Compound colors allowed as:
  `black_white`
  `brown_beige`

---

### 15.3.9 Language values

**Column:** products.language

**Allowed values:**
- sv
- en
- null

---

### 15.3.10 Translation job status (if used)

**Column:** translation_jobs.status
- pending
- completed
- failed
- skipped

---

### 15.3.11 Retry job status (tradera_retry_jobs.status)

- pending
- retrying
- completed
- failed

---

### 15.3.12 Cron job names (cron_runs.job_name)

**Allowed values:**
- tradera_sync
- ebay_availability
- tradera_retry_import
- translate_backfill

Must match exact string used in edge functions.

---

### 15.3.13 Canonical Naming Conventions

**Database**
- snake_case
- lowercase
- singular table names optional but consistent
- foreign keys end with _id

**Edge functions**
- kebab-case:
  - tradera-search
  - ebay-availability
  - admin-health

**Frontend components**
- PascalCase:
  - TraderaSearchDrawer
  - ProductDetail
  - StoryViewsTable

---

### 15.3.14 Forbidden Variants (AI Guardrail)

A future AI must NOT generate:
- ❌ "Tradera"
- ❌ "Ebay"
- ❌ "Published"
- ❌ "SOLD"
- ❌ "very good" (should be very_good internally)
- ❌ mixed case enums

All enums are lowercase snake_case.
