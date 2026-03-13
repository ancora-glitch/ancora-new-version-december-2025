ANCORA — MASTER PROJECT SPECIFICATION
Version 1.7

Changelog v1.7:

- VintageSphere partner importer added (Section 4.4)
- Import run limit: max_import_per_run = 10 (VintageSphere only)
- Structured health logging for VintageSphere import runs
- marketplace enum extended: vintagesphere added
- Adapters list updated: Tradera, eBay, VintageSphere

Changelog v1.6:

- F-05: Source label redesigned from badge/button to plain bold text
- F-05: Copy changed from "Ancora selects from X" to "Source Tradera" / "Source eBay"
- F-05: File path corrected to src/pages/ProductDetail.tsx
- Empty category copy updated to "All gone. Check back in another day — we're out looking for great stuff for you."

Changelog v1.5:

- Bulk subcategory reclassification: 35 products → knitwear, 10 → blazers, 25 → shirts
- Reclassification rules documented (Section 9.7)
- Header mobile logo z-index fix (logo now clickable on mobile)

Changelog v1.4:

- Admin health coverage window corrected to 24h
- eBay availability checks hardened with rate-limit handling (429 abort + request pacing)
- Clothing subcategories defined (knitwear, shirts, blazers, skirts, jeans, trousers, shorts)
- Removed legacy "Bottoms" category
- Enum registry updated: products.status now includes active, pending_import, review_required

Status: Production MVP — Architecture Locked
Purpose: System blueprint for AI-assisted regeneration and extension

SPEC GOVERNANCE
This document is the single source of truth for Ancora's system architecture.
If code and specification conflict:
→ The specification prevails.
All architectural or structural changes must:
Update this document first

Define invariants

Document affected layers (DB, Edge, UI, Cron)

Define migration impact (if any)

No implementation may introduce silent behavioral changes without spec update.

MVP FREEZE MARKER
Production MVP Locked.
Current architecture is intentionally optimized for:
Editorial control

Quota-aware API usage

Predictable background processing

Manual-first workflow

Architecture may only change when Phase 2 or Phase 3 triggers (see Section 7.4).
Premature optimization is explicitly discouraged.

1. PRODUCT PURPOSE
   1.1 Vision
   Ancora är ett redaktionellt lager ovanpå second hand-marknaden.
   Det är:
   Inte en marketplace

Inte ett lagerhållande bolag

Inte ett checkout-system

Det är:
→ Ett kuraterat gränssnitt
→ En trafikmotor
→ En redaktionell shopping-upplevelse
→ Ett API-agnostiskt importlager

1.2 Problem
Second hand-marknaden är:
Fragmenterad

Sökdriven

Tidskrävande

Datamässigt ostrukturerad

Ancora löser detta genom:
Standardiserad datamodell

Redaktionsstyrd selektion

Strukturerade produktfält

Affiliate-trafik istället för transaktion

2. SYSTEM OVERVIEW
   Ancora består av 5 huvudlager:
   Import Layer (Adapter-based)

Product Layer (Canonical Product Model)

Editorial Layer (Stories / Guides)

Availability Layer (Sold detection + cron)

Analytics Layer (Views + cron telemetry)

3. DATA MODEL
   3.1 Canonical Product Model (Products Table)
   Products är systemets sanning.
   Optional for MVP – reserved for future multi-marketplace support.
   Core Fields
   id

name

name_en

name_original

description

description_en

description_original

brand

brand_original

color

color_original

size

material

material_original

condition

condition_original

price

currency

image (primary)

additional_images[]

affiliate_url

marketplace (tradera | ebay | vintagesphere | manual)

tradera_item_id (nullable)
external_listing_id (nullable)
external_listing_source (nullable)
status (draft | published | sold | archived)

unpublished_reason

translated_at

created_at

updated_at

external_listing_id
Marketplace-specific listing identifier used for availability checks and deduplication.

external_listing_source
Marketplace identifier corresponding to the listing id.
Typically matches products.marketplace but allows flexibility for multi-source listings.

3.2 Import Log (AIS)
AIS är nu ett logglager.
source_type

source_ref

raw payload reference

mapped fields snapshot

product_id

status (promoted)

AIS är ej längre redaktionens arbetsyta.

3.3 Schema Authority Rule
The database schema defined in this document is the canonical authority.
The following tables are considered schema-controlled:
products
style_guides
ancora_import_items
tradera_cache
tradera_retry_jobs
tradera_usage
translation_usage
cron_runs
cron_job_state
story_views
site_analytics

Rules:

1. No AI or developer may introduce new columns, enums, or tables without updating this specification first.
2. When creating tables:
   - Section 3 (Data Model)
   - Section 16.5 (Database Map)
   - Section 17.3 (Enum Registry), if applicable.
3. Code must never be treated as the authoritative source for schema inference.
4. If implementation and specification diverge, the schema defined in this document prevails.

Purpose:
Prevent silent schema drift in AI-assisted development.

4. IMPORT SYSTEM
   4.1 Design Principle
   Adapter Pattern.
   Varje källa mappar till Product Model direkt.
   Current Adapters:
   Tradera

eBay

VintageSphere

4.2 Tradera Import
Data Source:
SOAP GetItem
Structured Term IDs:
term_121 → Skick

term_105 → Material

term_3 → Brand

term_102 → Color

Flow:
Search Tradera

Fetch GetItem

Parse TermAttributeValues

Normalize SV → EN

Create Product draft

Normalization Layer:
SV → EN mapping for:
condition

material

color

Brand:
Clean formatting only

Original SV stored in \*\_original

4.3 eBay Import
Data Source:
Browse API
Flow:
Search (GB marketplace)

Filter:

deliveryCountry=SE

buyingOptions=FIXED_PRICE

Fetch getItem endpoint for description enrichment

Create Product draft

Fallback description built from structured fields if missing.

4.4 VintageSphere Import (Partner Importer)
Data Source:
Shopify JSON endpoint (/products.json and /products/{handle}.json)

Import Method:
Admin-driven curated search + select (Admin → Imports → Search VintageSphere)
Not automated — all imports are manually initiated by the editorial team.

External Identifier:
Shopify product handle (used as source_ref and slug)

Availability Source:
variants[].available from Shopify JSON response.
HTML sold-out parsing is not used.

Currency: SEK

Field Mapping:

- title → products.name / name_en
- body_html (stripped) → products.description / description_en
- vendor → products.brand (unless "Vintage Sphere", then parsed from listing)
- options[Size] → products.size
- options[Color] → products.color
- options[Material] → products.material
- Condition → parsed from body_html star ratings (⭑⭑⭑⭑ = Excellent, ⭑⭑⭑ = Very good, ⭑⭑ = Good, ⭑ = Fair)
- Era → parsed from body_html (e.g. "Era: 2000's")
- images[] → products.image + additional_images
- product URL → products.affiliate_url

Sold-Out Behavior:
Products where variants[].available is false are imported as draft (not published).
The curator decides whether to publish or discard.

Run Limit:
max_import_per_run = 10
The importer stops automatically after 10 successful imports in a single run.
If more products are selected, the UI notifies the curator that the limit was reached.
Additional imports require a new run.
Rationale: Ancora uses curated selection — batch size limits prevent accidental bulk imports.

Isolation Rule:
The VintageSphere importer is fully isolated from Tradera and eBay import flows.
It does not share quota counters, retry queues, or cron jobs with other importers.
Edge functions: vintagesphere-search, vintagesphere-item (separate from tradera-_ and ebay-_).

Deduplication:
Products are deduplicated by handle (source_ref) and affiliate_url against the products table.
Items already imported show "Already imported" in the search UI.

Logging Requirement:
Every import run produces a structured health log with:

- importer_name: vintagesphere
- endpoint_status
- pages_fetched
- products_returned
- products_imported
- duration_ms
- error_count
- run_limit_reached

Failure Alerts:
If endpoint_status != 200 or products_returned = 0, an additional structured warning is emitted:

- event: VintageSphereImportWarning
- Fields: endpoint_status, pages_fetched, products_returned, error_count, duration_ms
  This is observability-only and does not modify import behavior.

Source Badge:
Products with marketplace = "vintagesphere" display "Source VintageSphere" on the product detail page,
using the same styling and logic as Tradera and eBay source badges.

Analytics:
The admin Statistics dashboard supports filtering by source/partner (All Sources, Tradera, eBay, VintageSphere).
The filter applies to Product Clicks, Purchase Intent, Intent Rate, trend chart, and Top Products.
Page Views and Unique Visitors remain unfiltered (not source-specific).

Rate Limiting:

- 500ms delay between search pagination pages
- 300ms delay between individual product imports
- 15s timeout per API request

5. EDITORIAL WORKFLOW
   5.1 Products
   States:
   draft

published

sold

archived

Import → draft
Editor edits → publish
Cron never modifies editorial fields.

5.2 Stories / Style Guides
Fields:
title

body

image

status (draft/published)

published_at

Only published visible publicly.

6. AVAILABILITY SYSTEM (v2 – Quota-Aware Architecture)
   6.0 Architecture Principle
   Availability accuracy must not compromise editorial control.
   Ancora is a curated editorial layer — not a real-time marketplace.
   Availability checks must be reliable, but must never consume so much API quota that manual search and import become blocked.
   Priority order:
   Manual search & imports

Featured product accuracy

Background availability cleanup

System design must always protect editorial freedom.

6.1 Tradera Sold Detection
Mark product as sold if ANY:
ItemStatus in ["Ended", "Closed", "Sold"]

EndDate < now

Quantity === 0

BuyNowAvailable === false AND EndDate < now

Sync Strategy
Goal: Remove ended listings within 24–72h while preserving API quota for manual use.
Cron Schedule
Frequency: Once per day

Time: 03:00 UTC

Batch size: 25 products

Strategy: Round-robin cursor across active products

Quota Management
All GetItem SOAP calls increment a shared global quota counter.

Sync aborts automatically if:

Remaining quota < 30

Manual search and import always have priority over cron jobs.

Retry jobs must respect the same quota guard.

No background job may bypass quota tracking.

Expected System Behaviour
Max background usage: ~25 API calls/day

78 active products → full scan completed in ~3 days

Maximum removal delay: 24–72h

Editorial workflow remains fully functional during daytime

This delay is acceptable in current editorial phase.

6.2 eBay Sold Detection
Mark product as sold if:
HTTP 404
OUT_OF_STOCK
quantity === 0
endDate < now

Sync Strategy
Cron: Once per day (aligned with Tradera schedule)
Batch size: 25
eBay availability checks must follow the same defensive rate-protection principles as other background jobs.

Current guardrails:

- Maximum batch size: 25 products per run
- Small delay between requests
- Graceful handling of rate-limit responses
- Logging of request volume per run
  eBay does not rely on the Tradera shared quota counter unless a marketplace-specific quota model is explicitly introduced.

  6.3 Future Optimization (Phase 2)
  Not yet implemented.
  Future prioritization model:
  Featured / Frontpage products → highest sync priority

Story-embedded products → medium priority

Archive products → lowest priority

This allows faster removal of high-visibility products without increasing total API consumption.

7. API STRATEGY (Quota-Aware & Editorial-First)
   7.0 Core Principle
   Ancora operates under limited third-party API quotas.
   API usage must be:
   Predictable

Observable

Prioritized

Never blocking editorial workflow

Quota is a finite resource and must be treated as product infrastructure, not implementation detail.

7.1 Global Quota Model
All external API calls must:
Increment a shared global quota counter.

Be logged with:

Source (manual import / search / sync / retry)

Endpoint (e.g., GetItem)

Timestamp

Be visible in admin for debugging.

No background process may bypass quota tracking.
UI quota display must reflect real API usage.

7.2 Priority Hierarchy
When quota is limited, calls are prioritized:
Priority 1 — Manual Editorial Actions
Manual search

Manual import

Manual sync trigger

These must always succeed if quota > 0.

Priority 2 — Featured Product Accuracy
Availability checks for frontpage / featured items

Only executed if quota allows.

Priority 3 — Background Maintenance
Nightly sync

Retry queue

Backfill jobs

Must abort automatically if:
Remaining quota < 30

7.3 Background Job Rules
No cron job may consume more than 35% of daily quota, where such a quota model exists.
All cron jobs must include protective execution guards.
For quota-based integrations (such as Tradera), this means explicit quota guards against the shared counter.
For non-quota-based integrations (such as eBay), this means defensive rate protection, including:

- capped batch size
- request pacing / small delay between calls
- graceful handling of rate-limit responses
  Retry loops must include exponential backoff.
  No automatic retry on HTTP 429 without delay.
  Admin-triggered backfills must also respect quota guard unless explicitly marked 'force'.
  System must fail gracefully — not aggressively.

Retry Job Exception (Phase 1 Clarification)
The tradera-retry-import cron job may run sub-daily (e.g. every 30 minutes), as it is not an availability sync job.

However, it must:

- Respect the shared global quota counter
- Abort automatically if remaining quota < 30
- Enforce a hard cap per run (maximum retry jobs processed per execution)
- Use exponential backoff
- Never loop aggressively or retry indefinitely

Retry-import is considered operational maintenance, not availability freshness.

7.4 Phase-Based API Strategy
Phase 1 — Editorial Build Phase (Current)
Daily quota: 75 calls

Nightly sync only

Accept 24–72h removal delay

Focus on manual curation capacity

Phase 2 — Growth Phase
Triggers:
Increased traffic

Increased active listings (>150)

Higher dependency on conversion accuracy

Actions:
Negotiate higher quota with partner

Implement priority-based sync

Reduce scan window for featured items

Phase 3 — Scale Phase
Possible upgrades:
Webhook-based availability updates

Differential updates instead of full polling

Caching layer for search results

Smart expiration window (near-end prioritization)

Goal: Real-time feel without brute-force polling.

7.5 Guardrail Rule
If quota usage threatens manual editorial workflow:
→ Background sync must automatically scale down or pause.
Editorial control is never sacrificed for automation.

8. RISK REGISTER — API DEPENDENCY
   Ancora relies on third-party marketplace APIs (e.g., Tradera, eBay) for product availability and listing data.
   This introduces operational, technical, and strategic dependencies that must be actively managed.

8.1 Identified Risks
Risk 1 — API Quota Exhaustion
Description:
Daily API limit reached, blocking search, import, or sync.
Impact:
Editorial workflow disruption

Inability to import products

Delayed sold detection

Likelihood (Current Phase): Medium
Mitigation:
Nightly sync only

Global quota guard

Priority hierarchy (manual > background)

Visible quota monitoring

Risk 2 — API Policy Changes
Description:
Marketplace changes rate limits, endpoints, authentication, or pricing.
Impact:
System instability

Increased costs

Temporary service disruption

Likelihood: Medium
Mitigation:
Modular API integration layer

No tight coupling to single endpoint

Active partner dialogue

Maintain fallback logic (e.g., EndDate-based removal)

Risk 3 — Real-Time Accuracy Gap
Description:
Sold products remain visible for up to 24–72h.
Impact:
Minor user friction

Perceived inaccuracy

Likelihood (Current Phase): High
Severity: Low (editorial phase)
Mitigation:
Clear product linking (users complete purchase on marketplace)

Phase-based prioritization for featured products

Planned priority sync model (Phase 2)

Risk 4 — Single Marketplace Dependency
Description:
Over-reliance on one marketplace API.
Impact:
Strategic vulnerability

Revenue risk

Likelihood: Medium
Mitigation:
Multi-marketplace strategy (Tradera + eBay + future partners)

Marketplace-agnostic product model

Editorial layer independent from inventory ownership

8.2 Strategic Positioning
Ancora does not:
Store inventory

Control transaction

Guarantee availability

Ancora is:
A curated discovery layer

A traffic driver

A conversion amplifier

Therefore:
Temporary availability inconsistencies do not compromise core business model.

8.3 Monitoring & Governance
Quota dashboard in admin

Logged API usage by source

Monthly review of API consumption trends

Pre-scaling audit when active listings exceed 150

8.4 Upgrade Triggers
The following automatically trigger API strategy review:
Daily quota consistently exceeds 80%

Active listings > 150

Conversion rate affected by sold-item friction

Marketplace partner offers upgraded access

9. ANCORA TECH ARCHITECTURE OVERVIEW
   9.1 Architectural Identity
   Ancora is an editorial commerce layer built on top of external marketplaces.
   It does not:
   Own inventory

Control transactions

Require real-time synchronization

It does:
Curate

Filter

Contextualize

Drive qualified traffic

System design reflects this positioning.

9.2 System Layers
Layer 1 — Editorial Layer (Ancora Core)
Manual curation

Product tagging

Weekly edits

Category structure (see 9.6 Category & Subcategory Model)

Featured prioritization

This layer must always remain functional, independent of API volatility.

Layer 2 — Integration Layer
Handles:
Tradera API

eBay API

Availability checks

Import flows

Quota management

This layer is quota-aware and priority-controlled.
All API calls pass through:
Global quota counter

Priority filter

Abort guard

Layer 3 — Background Maintenance
Nightly sync

Sold detection

Retry logic

This layer must degrade gracefully when quota is limited.
It may never block Layer 1.

9.3 Control Principles
Editorial > Automation

Predictability > Real-time polling

Quota visibility > Hidden background jobs

Phase-based scaling > Premature optimization

9.4 Current Phase
Phase: Editorial Build
75 daily API calls

Nightly sync only

24–72h acceptable delay

Manual import prioritized

System optimized for control and flexibility — not volume.

9.5 Evolution Path
When scaling:
Introduce priority-based sync

Increase quota via negotiation

Consider webhook-based updates

Reduce polling footprint

Architecture designed to scale deliberately — not accidentally.

9.6 Category & Subcategory Model
Categories are managed in the categories table (DB).
Products reference a category via products.category_id and may have a products.subcategory string.

Clothing subcategories (canonical list):

- outerwear
- tops
- knitwear
- shirts
- blazers
- dresses
- skirts
- jeans
- trousers
- shorts

Rules:

- Subcategory values are lowercase.
- The legacy category "Bottoms" has been removed. Products previously tagged "bottoms" should be reassigned to the appropriate subcategory (jeans, trousers, shorts, or skirts).
- New subcategories must be added to this list before implementation.
- Subcategories are currently hardcoded in Shop, CategoryPage, AdminPortal, and Header navigation.
- A DB trigger (`validate_product_subcategory`) enforces the canonical list above. Any new subcategory must be added to both this spec and the trigger.

  9.7 Subcategory Reclassification Log
  Purpose: Document bulk data operations that reassign products between subcategories.
  These operations are performed via SQL UPDATE on products table, scoped to a specific category_id.

Completed reclassifications (Clothing category):

1. Knitwear (35 products)
   Keywords matched: sweater, cardigan, pullover, knit
   Excluded: dress, skirt, vest, shirt, blouse
   Source subcategories: tops, NULL → knitwear

2. Blazers (10 products)
   Keywords matched: blazer
   Excluded: jacket, leather, parka (kept as outerwear)
   Source subcategories: tops, NULL → blazers

3. Shirts (25 products)
   Keywords matched: shirt, blouse, blus
   Excluded: sweatshirt, t-shirt (kept as tops)
   Source subcategories: tops, NULL → shirts

Rules for future reclassifications:

- Always scope to category_id to avoid cross-category pollution
- Use exclusion keywords to prevent misclassification
- Only reclassify from NULL or generic subcategories (e.g. tops), never override specific assignments
- Document each operation in this section

  9.8 Header / Navigation
  The site header uses a fixed top bar with centered ANCORA logo.

- Desktop: left-aligned nav with hover-triggered Shop dropdown
- Mobile: hamburger menu with slide-in panel, accordion Shop submenu
- Logo link requires z-10 to remain clickable above mobile menu elements
- Navigation items: Shop (with category dropdown), This Week's Edit, Stories, About

  9.9 Empty State Copy
  When a category or shop view has no products to display:

- Text: "All gone. Check back in another day — we're out looking for great stuff for you."
- Files: src/pages/Shop.tsx, src/pages/CategoryPage.tsx

10. ADMIN UI
    Tabs:
    Products

Imports

Stories

Statistics

Imports:
Search Tradera

Search eBay

Backfill buttons

Cron status

Translation budget

11. SECURITY MODEL
    All admin functions require JWT + admin role
    Service role for cron
    CORS dynamic origin validation
    Input validation on all API params
    Defensive rate protection on eBay background availability checks
    Tradera daily quota enforcement

12. COST OPTIMIZATION (Updated — Quota-Aware Model)
    12.1 Sync Strategy
    Background availability checks are intentionally limited to preserve API quota for manual editorial use.
    Current configuration:
    Nightly sync only

Time: 03:00 UTC

Batch size: 25 products

Round-robin cursor

Abort if remaining quota < 30

Background jobs may not consume more than 35% of daily quota

Estimated background usage:
~25 API calls/day
Remaining quota reserved for manual search + import.

12.2 Caching
Tradera cache versioning enabled (tradera_cache.cache_version)

Fresh backfill optional (admin-triggered)

No automatic aggressive re-fetching

Retry queue respects exponential backoff

12.3 Defensive Cost Controls
No cron job runs every 2h
No blind full inventory polling
No auto-retry on HTTP 429 without delay
All external calls for quota-based integrations must increment the shared quota counter
Non-quota-based integrations must still use defensive request pacing and bounded batch execution
Cost stability is prioritized over theoretical real-time accuracy.

13. DESIGN PRINCIPLES
    API-agnostic core

Editorial control over automation

Never auto-overwrite human edits

Defensive availability detection

Normalized English surface

Preserve original data

14. REBUILD INSTRUCTIONS (AI REGENERATION MODE)
    To recreate system from scratch:
    Create Product schema exactly as defined

Build adapter interface:
transformExternalItem() → CanonicalProduct

Implement Tradera adapter with TermAttributeValue parsing

Implement eBay adapter with description enrichment

Implement normalization layer

Implement availability cron with signal detection

Implement draft → publish editorial workflow

Implement story CMS

Add admin analytics + view tracking

Apply security constraints

15. EXTENSION PROTOCOL
    Future features must:
    Not mutate existing Product schema without migration note

Not override manual edits

Respect availability invariants

Add new adapters via adapter pattern

16. CODE MAPPING SECTION
    16.1 Repository Map (High-level)
    Frontend (Public site)
    Visar produkter, stories, shop, product detail

Får aldrig göra externa API-anrop mot partners (endast visar DB-data)

Admin Portal
Import UI (Tradera/eBay) → skapar Products i draft

Edit UI för Products / Stories

Statistics UI (views, cron health, etc.)

Edge Functions (Supabase functions)
Partner API calls (Tradera/eBay)

Availability checks (cron)

Retry/backfill utilities

Translation utilities

Health endpoints

Database (Supabase/Postgres)
Canonical model: products

Editorial: style_guides

Import logs: ancora_import_items (AIS)

Telemetry: cron_runs, cron_job_state

Views: story_views, site_analytics

Quota/cache: tradera_cache, tradera_usage, translation_usage, tradera_retry_jobs

16.2 Canonical Ownership Rules (What owns what)
Products table is canonical.
All import flows must end in products drafts.
AIS is logging/tracing only.
Edge Functions own:
External partner API calls

Auth checks for admin-only actions

Rate limiting / quota logic

Backfill jobs (batch operations)

Frontend owns:
Rendering only

No writes except analytics beacons / view tracking

Admin UI owns:
Editor actions (publish/unpublish, edit fields)

Triggering backfills / retries / health checks

16.3 Key Files and Modules (by responsibility)
A) Import UI (Admin)
Tradera search/import UI
src/components/admin/TraderaSearchDrawer.tsx

Responsibilities:

search Tradera (via edge function)

fetch GetItem details (via edge function) before creating draft

mapping → Product draft payload

translation trigger (Tradera → English)

logs mapping and guardrails

Invariants:

If GetItem is rate-limited/fails → abort import (no partial draft)

Must use HD images (/images/ paths)

Must set primary image via hero selection

eBay search/import UI
src/components/admin/EbaySearchDrawer.tsx

Responsibilities:

search eBay via edge function (GB marketplace, EU location filter, shipping to SE, FIXED_PRICE)

enrich item via ebay-item for description

mapping → Product draft payload

Invariants:

Always set affiliate_url

Ensure description non-empty via enrichment/fallback builder

Import-to-Product hook
src/hooks/useImportToProduct.ts

Responsibilities:

single entry-point to create Product drafts from adapter payload

dedupe: Tradera by tradera_item_id, eBay by affiliate_url

writes canonical fields to products

creates AIS "log record" linked by product_id (if enabled)

B) Parsing / Normalization (Shared libs)
Listing parser
src/lib/listingParser.ts

Responsibilities:

parse brand/size/color/material/condition from raw title+description

used as fallback if API doesn't provide structured values

Invariants:

Parser must never override partner API-provided values

Hero image selection
src/lib/heroImageSelector.ts

Responsibilities:

choose best hero image from images array

Invariants:

primary_image must be included in images[]

must prefer high-res, avoid detail closeups if possible

Tradera normalization
src/lib/traderaNormalization.ts

Responsibilities:

normalize SV → EN for Tradera-only fields:

condition/material/color/brand (brand mostly cleanup)

detect Swedish vs English heuristic

Invariants:

Only applies when marketplace === 'tradera'

Store original values in \*\_original

C) Product Editing (Admin)
Product form / save logic
(Likely) src/components/admin/ProductForm.tsx (name may vary)

Responsibilities:

editor sees and edits display text fields

save must persist both base + \_en fields to keep them in sync

Invariants:

Editing in admin must not revert to imported text on save

Cron must never overwrite editorial fields

D) Public Site Rendering
Product detail
src/pages/ProductDetail.tsx

Responsibilities:

render product fields

render image carousel from image + additional_images

render source label (marketplace / editorial override)

show English fields first: name_en || name, description_en || description

Invariants:

Must not call partner APIs at runtime

Must gracefully handle additional_images being string/array/null

Shop / listings
src/pages/Shop.tsx (or equivalent)

Responsibilities:

display products based on status

use name_en where available

Stories
src/pages/stories/... (varies)

Responsibilities:

show only status='published'

trigger view registration

E) Stories workflow + view count
Stories model / admin
Table: style_guides (stories)

Admin list + filters: likely in src/components/admin/StoriesTab.tsx

Public story pages filter by published

Story views
Edge function: register-story-view

DB: story_views

Admin Statistics table shows totals + unique (7d/30d)

16.4 Edge Functions Map (Supabase functions)
Folder path depends on setup, but logically: supabase/functions/<fn>/index.ts
Admin-only functions (JWT + admin role, plus service-role bypass for cron)
tradera-search
Search endpoint for Tradera (and optionally quota check)

ebay-search
Search endpoint for eBay

ebay-item
Fetch full item details for description enrichment

tradera-sync (cron)
Availability check for Tradera products (batching + cursor)

ebay-availability (cron)
Availability check for eBay products (batching + cursor)

tradera-retry-import (cron)
Processes queued retry jobs for rate limited imports

translate-swedish
Translates SV → EN with heuristics/budget

translate-backfill (if still present)
Batch translate missing \*\_en fields

ais-backfill-parsed-fields (if present)
Batch parse structured fields into AIS (logging layer)

tradera-backfill-condition-material (now includes brand/color too)
Backfill missing Tradera fields (cached/fresh)

recheck-product
On-demand availability recheck for a single product

admin-health
DB ping + secrets present + queue readable + cron telemetry summary

Public functions
analytics-beacon

tradera-item (if left public by design)

NOTE: if used by admin only, consider making it admin-protected too

Intake v1 — Test Only (feature-flagged, isolated)

intake-fetch-test
Purpose: Fetch a capped batch from one source in test mode.
Saves raw payloads to intake_raw_listings only.
Guards: INTAKE_V1_ENABLED check · INTAKE_FETCH_ENABLED check ·
INTAKE_KILL_SWITCH check · max items cap · source throttling.
Forbidden: Any write to products or production tables.

intake-normalize-test
Purpose: Map raw payloads to canonical intake schema.
Run deterministic rules engine. Write to intake_normalized_products.
Guards: Same flag stack as above · idempotent · logs rule rejections.
Forbidden: Any write to products or production tables.

intake-enrich-test
Purpose: Run AI enrichment prompts (brand, category, color, title rewrite).
Store enriched fields and confidence scores in intake_normalized_products.
Guards: Prompt version tracked · JSON validation · safe fallback on
malformed AI output · skips hard-rejected items.
Forbidden: Any write to products or production tables.

intake-score-test
Purpose: Run AI scoring prompt. Write results to intake_evaluations.
Update intake_normalized_products.current_queue_state.
Guards: Score threshold config · hard override flags respected.
Forbidden: Any write to products or production tables.

intake-detect-duplicates-test
Purpose: Exact and probable duplicate detection.
Compares read-only against products table (affiliate_url, external_id).
Writes candidates to intake_duplicate_candidates.
Forbidden: Any mutation of products or production tables.

intake-availability-test
Purpose: Re-check availability within the intake test system only.
Updates intake_normalized_products.availability_status.
Forbidden: Any mutation of products.status or production availability fields.
Note: Does NOT consume Tradera shared quota counter.
Must use separate rate controls from production availability jobs.

intake-run-log
Purpose: Write structured health log per run to intake_run_logs.
Called by all other intake functions at start and completion.

16.5 Database Map (Tables + ownership)
Canonical
products — canonical inventory and editorial state

Import/Operations
ancora_import_items — import log (AIS)

tradera_cache — cached partner payloads (versioned)

tradera_retry_jobs — rate-limit retry queue

tradera_usage — daily quota counters

translation_usage — translation budget counters

Editorial
style_guides — stories with draft/published

Telemetry / Health
cron_runs — cron execution logs

cron_job_state — cursor for batching

Analytics
site_analytics

story_views

Intake v1 — Test Only
intake_raw_listings — original source payloads, unmodified
intake_normalized_products — canonical enriched intake objects
intake_evaluations — rules + AI scoring per product per pass
intake_editorial_actions — human review actions in test queue
intake_run_logs — structured health log per job execution
intake_duplicate_candidates — probable and exact duplicate matches

Rules:

- All intake\_\* tables are test-only during v1.
- No intake\_\* table may be queried by the public storefront.
- No intake\_\* table may write to or join with products in a mutating operation.
- Read-only joins against products are permitted for duplicate detection only.

  16.6 Invariants Checklist (must never regress)
  Import invariants
  Tradera import must use GetItem images (/images/ HD) and import >= 3 images when available

Hero image must be in images[]

Imports create Products as draft (never auto-publish)

Adapter priority: API values > parser fallback

Editorial invariants
Cron jobs may only update:

status / unpublished_reason / ended metadata

Cron must never overwrite:

name/description (any language fields)

brand/color/material/condition edited by humans

Availability invariants
Tradera ended detection uses signals:
ItemStatus, EndDate, Quantity, BuyNowAvailable

eBay ended detection uses:
404, OUT_OF_STOCK, quantity=0, endDate passed

Translation invariants
Tradera only

Store originals in \*\_original

Display uses \*\_en fallback to base

Security invariants
Admin functions require JWT + admin role

Service role bypass allowed only for cron

CORS allows preview origins (.lovable.app, .lovableproject.com)

16.7 "AI Sync Protocol" (how to update code safely)
When asked to add a feature, the AI must:
Identify which layer owns it (Admin UI, Edge, DB, Frontend, Cron)

Update spec first (this document), including:

new fields/tables

new edge functions

new invariants

updated mapping section

Generate a change plan:

migrations (if needed)

affected files

tests/guardrails

Implement minimal change set

Verify against invariants checklist

Add/adjust guard test(s) (e.g. forbidden pattern scan)

16.8 Cron Job Registry (Execution Contracts)
Purpose:
Provide a single authoritative reference for all scheduled background jobs.

This registry prevents ambiguity in:

- execution frequency
- batch limits
- quota usage
- rate protection
- ownership

All cron jobs must be listed here.

If implementation changes:
→ This section must be updated first.

Cron Jobs
Job: tradera-sync
Purpose:
Availability detection for Tradera products.

Schedule:
Once per day (03:00 UTC)

Batch size:
25 products

Cursor:
Round-robin across active products

Guards:
Abort if shared Tradera quota remaining < 30

Ownership:
Edge Function → tradera-sync

Updates allowed:
products.status → sold
products.unpublished_reason

Forbidden:
Any editorial fields

---

Job: ebay-availability
Purpose:
Availability detection for eBay listings.

Schedule:
Once per day (aligned with tradera-sync)

Batch size:
25 products

Rate protection:
Request pacing between calls
Abort remaining batch on HTTP 429

Quota:
Does not use Tradera shared quota counter

Ownership:
Edge Function → ebay-availability

Updates allowed:
products.status → sold
products.unpublished_reason

Forbidden:
Any editorial fields

---

Job: tradera-retry-import
Purpose:
Retry queue for rate-limited Tradera imports.

Schedule:
Sub-daily (e.g. every 30 minutes)

Batch size:
Max jobs per run enforced

Guards:
Abort if remaining quota < 30

Retry policy:
Exponential backoff

Ownership:
Edge Function → tradera-retry-import

---

Job: translate-backfill (optional)
Purpose:
Backfill missing \*\_en fields.

Schedule:
Manual trigger or controlled cron

Guards:
Translation budget tracking

Ownership:
Edge Function → translate-backfill

Job: intake-fetch-test (v1 shadow mode)
Purpose: Fetch capped source batches into test intake pipeline.
Schedule: Manual trigger or low-frequency test schedule (not aligned
with production cron). Frequency increases only after
stability is confirmed.
Batch size: Configurable via INTAKE_MAX_ITEMS_PER_RUN (default: 10)
Guards:

- INTAKE_V1_ENABLED must be true
- INTAKE_FETCH_ENABLED must be true
- INTAKE_KILL_SWITCH must be false
- Source must be in INTAKE_ALLOWED_SOURCES
- Abort immediately on HTTP 429
- Does NOT consume Tradera shared quota counter
- Does NOT share quota guards with tradera-sync or tradera-retry-import
  Ownership: Edge Function → intake-fetch-test
  Updates allowed: intake_raw_listings · intake_run_logs only
  Forbidden: products · ancora_import_items · tradera_usage · any
  production table

---

Job: intake-score-test (v1 shadow mode)
Purpose: Run enrichment and scoring on normalized intake items.
Schedule: Manual trigger or low-frequency test schedule.
Batch size: Configurable via INTAKE_MAX_ITEMS_PER_RUN
Guards: Same flag stack as intake-fetch-test.
Ownership: Edge Function → intake-score-test
Updates allowed: intake_normalized_products · intake_evaluations ·
intake_run_logs only
Forbidden: products · any production table

17. FEATURE INDEX
    Syfte: En AI ska kunna slå upp en feature → se var den bor i kodbas/DB/edge functions → ändra utan att bryta invariants.
    Legend
    Owner: Primär "source of truth" (var ändring ska börja)

Touches: Vanliga sekundära beröringsytor

Key paths: Viktigaste filer/edge functions/tabeller (namn kan variera något, men ska hållas synkade)

F-01 Products: Draft/Published/Sold lifecycle
Owner: Database + Admin UI

Touches: Cron (availability), Frontend rendering

Key paths:

DB: products

Cron: tradera-sync, ebay-availability

UI: Product list/filter + Product form (admin)

FE: ProductDetail + Shop

F-02 Import: Tradera → Products (Draft)
Owner: Admin UI (Tradera drawer) + Edge functions

Touches: Normalization, Translation, Hero image selection

Key paths:

UI: src/components/admin/TraderaSearchDrawer.tsx

Hook: src/hooks/useImportToProduct.ts

Edge: tradera-search, tradera-item

Lib: src/lib/heroImageSelector.ts, src/lib/traderaNormalization.ts

DB: products, (log) ancora_import_items

F-03 Import: eBay → Products (Draft)
Owner: Admin UI (eBay drawer) + Edge functions

Touches: Description enrichment, shipping/location filters

Key paths:

UI: src/components/admin/EbaySearchDrawer.tsx

Hook: src/hooks/useImportToProduct.ts

Edge: ebay-search, ebay-item

DB: products

F-04 Import: Deduplication
Owner: Import hook

Touches: DB constraints/indexes (optional)

Key paths:

Hook: src/hooks/useImportToProduct.ts

Logic: Tradera by tradera_item_id, eBay by affiliate_url

F-05 Source label ("Source Tradera", "Source eBay")
Owner: Frontend ProductDetail

Touches: Product fields mapping

Key paths:

FE: src/pages/ProductDetail.tsx

DB fields: products.marketplace, products.ancora_select_source

Display rules:

- Rendered as plain bold text (p with font-bold text-muted-foreground), NOT as a badge or button
- Text: "Source Tradera" when source is tradera, "Source eBay" when source is ebay
- Priority: ancora_select_source, then marketplace (lowercase fallback)
- Only shown for active/published products (hidden when sold)
- Positioned between description and Buy Now CTA

F-06 Image pipeline (HD + carousel + hero selection)
Owner: Import adapters + ProductDetail rendering

Touches: Backfill, invariants/logging

Key paths:

Lib: src/lib/heroImageSelector.ts

FE: ProductDetail carousel logic

Import: Tradera/eBay drawers + mapping

DB: products.image, products.additional_images

F-07 Tradera rate-limit resilience (quota + retry jobs)
Owner: Edge functions + DB

Touches: Admin UI retry queue panel

Key paths:

Edge: tradera-search, tradera-item, tradera-retry-import

DB: tradera_usage, tradera_cache, tradera_retry_jobs

UI: Imports header/queue panel

F-08 Availability checks: Auto-unpublish sold/ended listings
Owner: Cron edge functions

Touches: Product status logic, admin "Recheck now"

Key paths:

Edge cron: tradera-sync, ebay-availability

Edge manual: recheck-product

DB: products.status, unpublished_reason, marketplace, tradera_item_id, affiliate_url

F-09 Tradera ended-detection logic (the "ended but still visible" bug class)
Owner: tradera-sync + Tradera parsing

Touches: tradera-item GetItem parsing

Key paths:

Edge: tradera-sync, tradera-item

Logic: signals from ItemStatus, EndDate, Quantity, BuyNowAvailable

F-10 Tradera cache/versioning
Owner: Edge functions + DB

Touches: Backfill jobs

Key paths:

DB: tradera_cache.cache_version

Edge: tradera-item, tradera-backfill-condition-material (fresh/cached modes)

F-11 Translation: Tradera SV → EN
Owner: Translation edge + Import adapters

Touches: Products edit form, Frontend render fallback

Key paths:

Edge: translate-swedish, translate-backfill (if present)

UI: Tradera drawer import translation call

Admin: Product form loads/saves \*\_en

FE: uses name_en || name, description_en || description

DB: products.name_en, products.description_en, \*\_original, translated_at, language

DB budgets: translation_usage

F-12 Normalization: Tradera condition/material/color/brand SV → EN (standardized)
Owner: src/lib/traderaNormalization.ts + import mapping

Touches: Backfill

Key paths:

Lib: src/lib/traderaNormalization.ts

Edge: tradera-backfill-condition-material (now includes brand/color too)

DB: products.condition/material/color/brand + \*\_original

F-13 Structured field extraction (parser fallback)
Owner: src/lib/listingParser.ts

Touches: Import adapters

Key paths:

Lib: src/lib/listingParser.ts

Adapters: Tradera/eBay drawers (priority: API > parser)

F-14 AIS (Ancora Import Spec) as import log
Owner: Database + Imports UI

Touches: Backfill parsed fields

Key paths:

DB: ancora_import_items

UI: Imports tab ("Import log")

Edge: ais-backfill-parsed-fields (if present)

F-15 Admin health checks (system visibility)
Owner: admin-health edge function + Imports header UI
Touches: cron_runs, retry queue, secrets presence
Key paths:
Edge: admin-health
UI: Imports header health row
Invariant:
Coverage calculations for nightly sync jobs must assume a 24-hour schedule window, not a sub-daily interval.

F-16 Cron telemetry + batching/cursor state
Owner: Cron edge functions + DB

Touches: Admin UI display

Key paths:

DB: cron_runs, cron_job_state

Edge: tradera-sync, ebay-availability, tradera-retry-import

F-17 Security: Admin-only edge function auth
Owner: Edge function auth wrapper

Touches: user_roles table, CORS

Key paths:

Edge: verify via getUser() + user_roles lookup + service-role bypass

DB: user_roles

F-18 CORS for preview environments
Owner: Shared CORS helper in edge functions

Touches: all edge functions

Key paths:

Edge: getCorsHeaders(req) allows .lovable.app + .lovableproject.com, sets Vary: Origin

F-19 Stories workflow (draft/published/archived)
Owner: DB + Admin Stories UI

Touches: Public stories routes

Key paths:

DB: style_guides.status, published_at, unpublished_at

Admin: Stories list/filter + publish/unpublish buttons

FE: /stories only shows published

F-20 Story views (total + unique 7d/30d)
Owner: story view edge + statistics UI

Touches: anti-spam dedup

Key paths:

Edge: register-story-view

DB: story_views (ip_hash + dedup window)

Admin: Statistics "Story Views" table

F-21 Statistics: product clicks / intent rate / unique visitors
Owner: Analytics pipeline

Touches: admin exclusion, date filters

Key paths:

DB: site_analytics (+ visitor_id)

Admin: Statistics UI, intent rate formula

17.1 How to reference features in future prompts
When you ask an AI to change something, use:
Feature ID (e.g. F-08)

Desired behavior

Constraints/invariants

Acceptance criteria

Files to touch (if known)

Example:
"Update F-08 Availability checks: Tradera ended detection must also treat BuyNowAvailable=false as ended even if ItemStatus is blank. Keep invariant: cron never overwrites editorial fields."

Perfekt. Här kommer en Naming & Enum Registry som du kan lägga direkt efter Glossary (t.ex. som 15.3 i ANCORA_MASTER_SPEC.md).
Den är skriven för att:
Eliminera "nästan-rätt"-värden

Förhindra Tradera vs tradera

Ge en generell AI exakta enum-listor

Göra framtida migrationer tydliga

17.3 Naming & Enum Registry
Regel: Alla enums är lowercase snake_case.
Regel: Marketplace-identifierare är lowercase.
Regel: UI-labels är separata från enum-värden.

17.3.1 products.status
Column: products.status
Type: string enum
Allowed values:
draft
published
sold
active
pending_import
review_required
Meaning
draft
Ej synlig publikt. Skapad via import eller manuellt.

published
Synlig publikt.

sold
Automatiskt eller manuellt avpublicerad pga affiliate otillgänglig.

active
Aktiv produkt (legacy/operational status).

pending_import
Import pågår, väntar på att bli klar.

review_required
Behöver manuell granskning innan publicering.

Invariants
Cron får endast ändra: status (→ sold) + unpublished_reason + affiliate/ended metadata
Cron får aldrig ändra: name/description/brand/color/material/condition (något språk)"
Import sätter alltid draft
Public site visar endast published

17.3.2 products.marketplace
Column: products.marketplace
Type: string enum
Allowed values (MVP):
tradera
ebay
manual
Future extension pattern
För Shopify-partners:
shopify:<partner_slug>
Ex:
shopify:vintagesphere
Invariants
Alltid lowercase

Aldrig "Tradera" eller "Ebay"

Används i availability cron

UI-label mappas separat

17.3.3 products.unpublished_reason
Column: products.unpublished_reason
Type: string enum (nullable)
Allowed values:
affiliate_unavailable
ended
sold
manual_unpublish
data_incomplete
Invariants
Cron använder endast:

affiliate_unavailable

ended

sold

Admin kan använda manual_unpublish

17.3.4 ancora_import_items.source_type
Column: ancora_import_items.source_type
Type: string enum
Allowed values:
tradera
ebay
manual
Rule
Måste spegla products.marketplace exakt (när kopplad).

17.3.5 style_guides.status (Stories)
Column: style_guides.status
Type: string enum
Allowed values:
draft
published
archived
Public rule
Frontend visar endast:
published

17.3.6 Condition canonical values (products.condition)
Column: products.condition
Type: string enum (soft enum, ej hård DB constraint)
Allowed normalized English values:
new
very_good
good
fair
poor
Display mapping
DB value
UI label
new
New
very_good
Very good
good
Good
fair
Fair
poor
Poor

Tradera mapping examples
SV
Canonical
Oanvänd
unused
Mycket gott skick
very_good
Gott skick
good
Använt skick
fair

17.3.7 Material canonical values
Column: products.material
Type: string (controlled vocabulary, not strict enum)
Preferred normalized values:
wool
cotton
leather
silk
linen
cashmere
polyester
denim
suede
synthetic
Rule
Lowercase

Singular form

Original stored in material_original

17.3.8 Color canonical values
Column: products.color
Type: string (controlled vocabulary)
Preferred values:
black
white
brown
beige
grey
blue
navy
green
red
pink
purple
yellow
multi
Rule
Lowercase

English only

Compound colors allowed as:

black_white
brown_beige

17.3.9 Language values
Column: products.language
Allowed values:
sv
en
null

17.3.10 Translation job status (if used)
Column: translation_jobs.status
pending
completed
failed
skipped

17.3.11 Retry job status (tradera_retry_jobs.status)
pending
retrying
completed
failed

17.3.12 Cron job names (cron_runs.job_name)
Allowed values:
tradera_sync
ebay_availability
tradera_retry_import
translate_backfill
Must match exact string used in edge functions.

17.3.13 Canonical Naming Conventions
Database
snake_case

lowercase

singular table names optional but consistent

foreign keys end with \_id

Edge functions
kebab-case:

tradera-search

ebay-availability

admin-health

Frontend components
PascalCase:

TraderaSearchDrawer

ProductDetail

StoryViewsTable

17.3.14 Forbidden Variants (AI Guardrail)
A future AI must NOT generate:
❌ "Tradera"
❌ "Ebay"
❌ "Published"
❌ "SOLD"
❌ "very good" (should be very_good internally)
❌ mixed case enums
All enums are lowercase snake_case.

17.3.15 intake_normalized_products.current_queue_state
Allowed values:
raw_imported
rules_rejected
normalized
enriched
scored_review
scored_draft_approved
rejected
test_approved
archived

Rules:

- These states exist only within the intake test pipeline.
- They must never be mapped to or confused with products.status values.
- No public storefront query may reference these states.

  17.3.16 intake_evaluations.decision
  Allowed values:
  reject
  review
  draft_approve

  17.3.17 intake_run_logs.status
  Allowed values:
  started
  completed
  failed
  aborted_kill_switch
  aborted_flag_disabled
  aborted_rate_limit
