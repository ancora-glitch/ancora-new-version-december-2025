ANCORA — AI OPERATING PROTOCOL
Version: 1.1
Status: Mandatory
Purpose: Guardrails for AI-driven code modification

THIS DOCUMENT IS AUTHORITATIVE.
All AI-generated changes must comply.

0. CORE PRINCIPLE
   You are modifying a production system.
   You must:
   Preserve invariants

Preserve editorial content

Preserve canonical data model

Avoid silent regressions

If unsure:
→ Ask for clarification
→ Never guess enum values
→ Never rename canonical fields

0.0 SPEC-LOCK RULE (NEW)
ANCORA — MASTER PROJECT SPECIFICATION (v1.1) is the single source of truth.
Before any code change:
Identify affected spec section(s)

Confirm alignment with invariants

Confirm no conflict with enum registry

Confirm no cron/quota drift

If spec update is required:
→ Update spec excerpt first
→ Then implement
If protocol and spec conflict:
→ Spec wins

1. SYSTEM ARCHITECTURE RULE
   Ancora consists of:
   Import Layer (Adapters)

Canonical Product Layer (products table)

Editorial Layer (stories/products draft workflow)

Availability Layer (cron + partner checks)

Analytics Layer

All new features must map to exactly one owner layer.
No cross-layer logic leakage.

2. CANONICAL SOURCE OF TRUTH
   Products table is canonical.
   All partner imports must end in:
   products (status='draft')

AIS (ancora_import_items) is logging only.
Cron must never modify editorial fields.
Frontend must never call partner APIs directly.

3. HARD INVARIANTS (NON-NEGOTIABLE)

3.1 Editorial Protection
Cron and availability functions may only update:
products.status

products.unpublished_reason

products.unpublished_at

affiliate/ended metadata fields (if defined in spec)

They must NEVER update:
name / name_en

description / description_en

brand

material

color

condition

image

additional_images

Editorial content is human-owned.

3.2 Enum Enforcement
All enums must match the Naming & Enum Registry exactly.
Examples:
status: draft | published | sold | archived

marketplace: tradera | ebay | manual

condition: new | very_good | good | fair | poor

Rules:
Lowercase only

snake_case only

No mixed case

No invented variants

Never guess enum values.

3.3 Marketplace Rules
marketplace values are lowercase

Tradera availability requires tradera_item_id

eBay availability requires affiliate_url

Do not invent marketplace identifiers

New partners require explicit enum registration

3.4 Import Rules
Imports create Products as draft

Never auto-publish

API values override parser fallback

Hero image must be included in images[]

Never create partial draft if external API call fails

3.5 Translation Rules
Only applies to marketplace='tradera'

Always store \*\_original

Display uses \*\_en fallback

Translation must be non-blocking

Must respect translation budget counter

3.6 QUOTA & CRON INVARIANTS (NEW — CRITICAL)
Availability and partner calls are quota-aware.
Hard rules:
Availability cron runs once per day

Time: 03:00 UTC

Batch size: 25

All external API calls increment the shared global quota counter

Abort background jobs if remaining quota < 30

Manual search/import always has priority

No job may bypass quota tracking

Forbidden:
Cron every 2 hours

Blind full inventory polling

Auto-retry on HTTP 429 without backoff

“Internal-only” quota counters

Quota is infrastructure.

4. AI CHANGE WORKFLOW (MANDATORY)
   When implementing a feature:

STEP 1 — Identify Owner
Which layer owns this change?
Import

Product

Editorial

Availability

Analytics

Admin UI

Edge function

If unclear → Ask.

STEP 2 — Update Specification First
Before generating code, update:
Feature Index

Enum Registry (if needed)

Code Mapping (if needed)

Invariants (if changed)

Cron/quota references (must match nightly 03:00 UTC + guard < 30)

Then implement.
Spec alignment must be explicitly confirmed.

STEP 3 — Minimal Surface Change
Only modify:
Required files

Required DB migrations

Required edge functions

Never refactor unrelated logic.
No speculative improvements.

STEP 4 — Validate Against Invariants
Explicitly confirm:
No editorial overwrite

Enums unchanged

Cron safety preserved

Nightly sync preserved

Quota guard preserved

Availability detection preserved

No security regression

STEP 5 — Logging
All new logic that interacts with:
Partner APIs

Availability

Translation

Cron

Must include structured logging.
Example:
[FeatureName] { key: value }
No secrets in logs.

5. SECURITY RULES
   Admin edge functions must:
   Require JWT

Validate admin role via user_roles

Allow service-role bypass for cron only

Never:
Log secrets

Log tokens

Return raw API error bodies to client

CORS must:
Allow .lovable.app

Allow .lovableproject.com

Set Vary: Origin

6. DATABASE MIGRATION RULES
   When adding fields:
   Never rename canonical fields

Never change enum meaning

Add new fields as nullable

Provide backfill plan if needed

Update Master Spec

When removing fields:
Only if no active code path depends on them

Must update spec first

7. FEATURE REQUEST FORMAT (AI INPUT PROTOCOL)
   All feature requests should include:
   Feature ID:

Owner Layer:

Change Type: (UI / DB / Edge / Cron / Parser / Import)

Desired Behavior:

Constraints:

Acceptance Criteria:

If missing information:
→ Ask before coding.

8. SAFE FAILURE PRINCIPLE
   If external API fails:
   Abort import

Do not create partial draft

Do not overwrite existing data

If cron fails:
Log error

Do not corrupt products

Never bulk-mark sold without verified signal

9. EXTENSIBILITY RULE
   New partners must:
   Implement adapter

Map to canonical Product model

Not alter canonical schema

Register new marketplace enum

Never special-case logic inside frontend

Partner logic belongs in adapter or edge layer.

10. OUTPUT FORMAT REQUIREMENT (FOR AI RESPONSES)
    When implementing changes, always respond with:
    Spec updates

Files modified

DB migrations (if any)

Edge functions changed

Invariants validation

Regression risk assessment

Never respond with “Done” only.

11. IF UNSURE
    Do not guess.
    Ask:
    Which layer owns this?

Is this canonical?

Does this change an invariant?

Is this an enum change?

Does this affect cron or quota behavior?

Final Status
Your system is now:
Spec-locked

Quota-aware

Invariant-protected

AI-guarded

Drift-resistant

This is now CTO-level governance for a small team.
