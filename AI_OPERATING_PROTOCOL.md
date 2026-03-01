THIS DOCUMENT IS AUTHORITATIVE.
All AI-generated changes must comply.

# ANCORA — AI OPERATING PROTOCOL

**Version:** 1.0
**Status:** Mandatory
**Purpose:** Guardrails for AI-driven code modification

---

## 0. CORE PRINCIPLE

You are modifying a production system.

You must:

- Preserve invariants
- Preserve editorial content
- Preserve canonical data model
- Avoid silent regressions

If unsure:
→ Ask for clarification
→ Never guess enum values
→ Never rename canonical fields

---

## 1. SYSTEM ARCHITECTURE RULE

Ancora consists of:

- Import Layer (Adapters)
- Canonical Product Layer (products table)
- Editorial Layer (stories/products draft workflow)
- Availability Layer (cron + partner checks)
- Analytics Layer

All new features must map to exactly one owner layer.

---

## 2. CANONICAL SOURCE OF TRUTH

Products table is canonical.

All partner imports must end in:

- products (status='draft')

AIS (ancora_import_items) is logging only.

Cron must never modify editorial fields.

---

## 3. HARD INVARIANTS (NON-NEGOTIABLE)

### 3.1 Editorial Protection

Cron and availability functions may only update:

- products.status
- products.unpublished_reason
- products.unpublished_at

They must NEVER update:

- name / name_en
- description / description_en
- brand / material / color / condition
- image / additional_images

---

### 3.2 Enum Enforcement

All enums must match the Naming & Enum Registry exactly.

Examples:

- status: draft | published | sold | archived
- marketplace: tradera | ebay | manual
- condition: new | very_good | good | fair | poor

No mixed case.
No variants.

---

### 3.3 Marketplace Rules

- marketplace values are lowercase
- Tradera availability requires tradera_item_id
- eBay availability requires affiliate_url
- Do not invent marketplace identifiers

---

### 3.4 Import Rules

- Imports create Products as draft
- Never auto-publish
- API values override parser fallback
- Hero image must be included in images[]
- Never create partial draft if external API call fails

---

### 3.5 Translation Rules

- Only applies to marketplace='tradera'
- Always store \*\_original
- Display uses \*\_en fallback
- Translation must be non-blocking

---

## 4. AI CHANGE WORKFLOW (MANDATORY)

When implementing a feature:

### STEP 1 — Identify Owner

Which layer owns this change?

- Import
- Product
- Editorial
- Availability
- Analytics
- Admin UI
- Edge function

---

### STEP 2 — Update Specification First

Before generating code, update:

- Feature Index
- Glossary (if new fields)
- Enum Registry (if new enums)
- Code Mapping (if new modules)

Then implement.

---

### STEP 3 — Minimal Surface Change

Only modify:

- Required files
- Required DB migrations
- Required edge functions

Never refactor unrelated logic.

---

### STEP 4 — Validate Against Invariants

Explicitly confirm:

- No editorial overwrite
- Enums unchanged
- Cron safety preserved
- Availability detection preserved
- No security regression

---

### STEP 5 — Logging

All new logic that interacts with:

- Partner APIs
- Availability
- Translation
- Cron

Must include structured console logging.

Example:

```
[FeatureName] { key: value }
```

---

## 5. SECURITY RULES

Admin edge functions must:

- Require JWT
- Validate admin role via user_roles
- Allow service-role bypass for cron only

Never:

- Log secrets
- Log tokens
- Return raw API error bodies to client

CORS must:

- Allow .lovable.app
- Allow .lovableproject.com
- Set Vary: Origin

---

## 6. DATABASE MIGRATION RULES

When adding fields:

- Never rename canonical fields
- Never change enum meaning
- Add new fields as nullable
- Provide backfill plan if needed

When removing fields:

- Only if no active code path depends on them
- Must update spec

---

## 7. FEATURE REQUEST FORMAT (AI INPUT PROTOCOL)

All future feature requests should follow:

- **Feature ID:** (existing or new)
- **Owner Layer:**
- **Change Type:** (UI / DB / Edge / Cron / Parser / Import)
- **Desired Behavior:**
- **Constraints:**
- **Acceptance Criteria:**

If missing information:
→ Ask clarifying questions before coding.

---

## 8. SAFE FAILURE PRINCIPLE

If external API fails:

- Abort import
- Do not create partial draft
- Do not overwrite existing data

If cron fails:

- Log error
- Do not corrupt products
- Never bulk-mark sold without verified signal

---

## 9. EXTENSIBILITY RULE

New partners must:

- Implement adapter
- Map to canonical Product model
- Not alter canonical schema
- Register new marketplace enum
- Never special-case logic inside frontend.

All partner logic belongs in adapter or edge layer.

---

## 10. OUTPUT FORMAT REQUIREMENT (FOR AI RESPONSES)

When implementing changes, always respond with:

- Spec updates
- Files modified
- DB migrations (if any)
- Edge functions changed
- Invariants validation
- Regression risk assessment

Never respond with "Done" only.

---

## 11. IF UNSURE

Do not guess.

Ask:

- Which layer?
- Is this canonical?
- Does this change an invariant?
- Is this an enum change?
