# Joby — Canonical Role Taxonomy

**Status:** Source of truth for role naming across all layers.  
**Date:** 2026-07-08.  
**Audience:** Product, engineering, growth ops, copywriters.

This document maps every role family across the four places where names appear:
1. **`ROLE_FAMILIES`** — the enum in `app/src/lib/constants.ts` (code + growth classifier)
2. **Brand / internal strategy** — `docs/brand/Joby_internal_strategy.md`
3. **External publishing** — `docs/growth/Joby_external_publishing.md`
4. **Occupation catalog** — `app/src/lib/occupations.ts` (the DB-seeded picker list)

When names differ, this document picks **one canonical key and one canonical Hebrew label** and explains the variants. No code is changed in this round — the recommendations here are the input for a future normalization pass.

---

## Main Mapping Table

> **Key:** ✅ = matches canonical | ⚠️ = differs (variant documented below) | — = not present in this layer

| Canonical key | Canonical label (UI) | ROLE_FAMILIES | Internal strategy | External publishing | Occupation catalog | Notes |
|---|---|---|---|---|---|---|
| `warehouse_worker` | מחסנאי/ת | ✅ `warehouse_worker` | ⚠️ `warehouse_clerk` | ⚠️ `warehouse_clerk` | ⚠️ `warehouse` ("עבודת מחסן") | **Key mismatch.** Brand + external docs use `warehouse_clerk`; code uses `warehouse_worker`. Canonical is `warehouse_worker` (code wins — it's the runtime key). Use `מחסנאי/ת` as the label everywhere. |
| `order_picker` | מלקט/ת | ✅ `order_picker` | ⚠️ mentioned inline under `warehouse_clerk` only | — | ⚠️ `picker-packer` ("ליקוט ואריזה") | Brand doc treats it as a sub-role of warehouse. ROLE_FAMILIES has it as a first-class family. Occupation catalog merges it with packing under `picker-packer`. Recommend keeping as a distinct family in code; brand doc should give it its own entry when content is ready. |
| `forklift_operator` | מלגזן/ית | ✅ `forklift_operator` | ✅ `forklift_operator` | ✅ `forklift_operator` | — | Clean match across brand + external. Occupation catalog has no direct equivalent (would map loosely to `logistics`). No action needed. |
| `packer` | אורז/ת | ✅ `packer` | — | — | ⚠️ `picker-packer` (merged with order_picker) | Not covered in brand or external docs as its own family. Occupation catalog merges it with picking. No urgent action. |
| `logistics_coordinator` | רכז/ת לוגיסטיקה | ✅ `logistics_coordinator` | — | — | ⚠️ `logistics` ("לוגיסטיקה", broad) | Office/coordination role; not yet covered in brand or external docs. |
| `delivery_driver` | נהג/ת חלוקה | ✅ `delivery_driver` | ✅ `delivery_driver` | ✅ `delivery_driver` | ⚠️ `driver` ("נהיגה", broad) | Clean match across brand + external. Occupation catalog entry is broader (covers all driving). |
| `courier` | שליח/ה | ✅ `courier` | — | — | ✅ `courier` ("שליחויות") | Not covered in brand or external docs. Occupation catalog matches key exactly. |
| `production_worker` | עובד/ת ייצור | ✅ `production_worker` | — | — | — | Not covered in any non-code layer yet. |
| `machine_operator` | מפעיל/ת מכונה | ✅ `machine_operator` | — | — | — | Not covered in any non-code layer yet. |
| `quality_control` | בקר/ית איכות | ✅ `quality_control` | — | — | — | Not covered in any non-code layer yet. |
| `call_center_rep` | נציג/ת מוקד | ✅ `call_center_rep` | ⚠️ key is `call_center_rep` but label used is "נציג/ת שירות לקוחות" | ⚠️ same — key `call_center_rep`, label "נציג/ת שירות לקוחות" | ⚠️ `customer-service` ("שירות לקוחות") | **Label mismatch.** Brand + external docs use the label "נציג/ת שירות לקוחות" on the key `call_center_rep`. ROLE_FAMILIES gives that same Hebrew label to the *separate* key `customer_service`. See disambiguation note below. |
| `customer_service` | נציג/ת שירות לקוחות | ✅ `customer_service` | — | — | ✅ `customer-service` ("שירות לקוחות") | **See note below.** This is a ROLE_FAMILIES key that holds the label "נציג/ת שירות לקוחות" — the same label the brand/external docs give to `call_center_rep`. Currently both keys exist in the codebase. Recommend: unify into one key in a future normalization pass; tentative winner is `call_center_rep` (brand + external copy built around it). |
| `tech_support` | נציג/ת תמיכה טכנית | ✅ `tech_support` | — | — | — | Not covered in brand or external docs. |
| `telesales` | מכירות טלפוניות | ✅ `telesales` | — | — | — | Not covered in brand or external docs. |
| `back_office` | בק אופיס | ✅ `back_office` | — | — | — | Not covered in brand or external docs. |
| `receptionist` | פקיד/ת קבלה | ✅ `receptionist` | — | — | ⚠️ `hostess` ("קבלת אורחים", event-specific) | Occupation catalog entry is narrower (event/hospitality context). |
| `cleaner` | עובד/ת ניקיון | ✅ `cleaner` | ⚠️ key used: `cleaning_worker` | ⚠️ key used: `cleaning_worker` | ⚠️ `cleaning` ("ניקיון") | **Key mismatch.** Brand + external docs use `cleaning_worker`; code uses `cleaner`. Canonical is `cleaner` (code wins). Use `עובד/ת ניקיון` as the label. Future brand/external doc updates should use `cleaner`. |
| `security_guard` | מאבטח/ת | ✅ `security_guard` | ✅ `security_guard` ("מאבטח/ת – סייר/ת") | ✅ `security_guard` | ✅ `security` ("אבטחה") | Clean match. Brand/external use a longer label ("מאבטח/ת – סייר/ת") for context; short UI label is `מאבטח/ת`. |
| `general_labor` | עבודה כללית | ✅ `general_labor` | — | — | ⚠️ `general` ("כללי") | Fallback bucket. Occupation catalog has a matching "general" entry. |
| `other` | אחר | ✅ `other` | — | — | — | Classifier fallback only; never shown as a selectable role in UI. |
| **`event_staff`** | עובד/ת אירועים | ✅ `event_staff` *(added 2026-07-08)* | ✅ `event_staff` (under "פיילוט ראשוני") | — | ⚠️ `events-general` ("צוות אירועים כללי") + `steward` ("סדרנות") | **Pilot family.** Occupation catalog has partial coverage via `events-general` and `steward`. No external publishing copy yet. |
| **`promo_staff`** | דייל/ת קידום מכירות | ✅ `promo_staff` *(added 2026-07-08)* | ✅ `promo_staff` (under "פיילוט ראשוני") | — | ⚠️ `sales-promoter` ("קידום מכירות") + `brand-promotion` ("פרומוטרים") | **Pilot family.** Occupation catalog has two partial-match entries. No external publishing copy yet. |
| **`project_worker`** | עובד/ת פרויקטים קצרים | ✅ `project_worker` *(added 2026-07-08)* | ✅ `project_worker` (under "פיילוט ראשוני") | — | — | **Pilot family.** No occupation catalog entry. No external publishing copy yet. |
| **`flex_logistics_worker`** | עובד/ת לוגיסטיקה גמישה | ✅ `flex_logistics_worker` *(added 2026-07-08)* | ✅ (under "פיילוט ראשוני – משפחה 2") | — | ⚠️ `logistics` ("לוגיסטיקה", broad) | **Pilot family.** Covers on-demand logistics, picking, light delivery. Occupation catalog `logistics` is broader. No external publishing copy yet. |
| **`warehouse_helper`** | עוזר/ת מחסן | ✅ `warehouse_helper` *(added 2026-07-08)* | ✅ (under "פיילוט ראשוני – משפחה 2") | — | ⚠️ `warehouse` (same as `warehouse_worker` mapping — distinct roles) | **Pilot family.** Entry-level warehouse role, distinct from `warehouse_worker`. Both map to the occupation catalog's `warehouse` entry; a future catalog addition (`warehouse_helper`) would improve precision. No external publishing copy yet. |

---

## Naming Conflict Resolutions

### 1. `warehouse_worker` vs `warehouse_clerk`

| Layer | Key used |
|---|---|
| `ROLE_FAMILIES` (code) | `warehouse_worker` |
| `Joby_internal_strategy.md` | `warehouse_clerk` |
| `Joby_external_publishing.md` | `warehouse_clerk` |

**Decision:** `warehouse_worker` is canonical. The code key is the runtime identifier; changing it requires a migration. Brand and external docs should adopt `warehouse_worker` in their next update. The Hebrew label `מחסנאי/ת` is consistent across all layers — no label conflict.

### 2. `cleaner` vs `cleaning_worker`

| Layer | Key used |
|---|---|
| `ROLE_FAMILIES` (code) | `cleaner` |
| `Joby_internal_strategy.md` | `cleaning_worker` |
| `Joby_external_publishing.md` | `cleaning_worker` |

**Decision:** `cleaner` is canonical (code key wins). Brand and external docs should adopt `cleaner` in their next update. Hebrew label `עובד/ת ניקיון` is consistent across all layers — no label conflict.

### 3. `call_center_rep` vs `customer_service` — the double-key problem

ROLE_FAMILIES currently has *both* of these keys, and the Hebrew label "נציג/ת שירות לקוחות" appears on both:
- `call_center_rep` → `נציג/ת מוקד` (in ROLE_FAMILIES)
- `customer_service` → `נציג/ת שירות לקוחות` (in ROLE_FAMILIES)

Meanwhile the brand and external docs use `call_center_rep` with the label "נציג/ת שירות לקוחות" — the label ROLE_FAMILIES assigns to `customer_service`.

In practice: `call_center_rep` is the richer of the two (full ad copy, requirement sets, growth classifier training data). `customer_service` is thinner and overlaps.

**Decision (deferred to code normalization):** Treat `call_center_rep` as the primary family, covering both inbound call-center and customer-service roles. `customer_service` should be either merged into `call_center_rep` or narrowed to a distinct meaning (e.g., in-person customer service roles vs. phone). **Do not create new content or growth presets for `customer_service` until this is resolved.** For now, both keys remain in code; growth classifier should prefer `call_center_rep` for phone/מוקד roles.

### 4. Occupation catalog key format

`occupations.ts` uses kebab-case (`picker-packer`, `customer-service`, `events-general`), while ROLE_FAMILIES uses snake_case (`order_picker`, `customer_service`, `event_staff`). These are two different systems with different purposes — ROLE_FAMILIES is the growth/filter taxonomy; the occupation catalog is the worker profile picker (DB-backed, immutable keys). **They do not need to be unified.** The mapping table above cross-references them for lookup purposes only.

---

## Pilot Role Families

The five families below were added to ROLE_FAMILIES on 2026-07-08 to represent the first product pilot segments. They are standard product taxonomy entries — employers can tag shifts with these roles today. They are called "pilot" because Joby's brand strategy identified them as the primary focus segments for the first market push.

**Why these families:**
- Events/promo and flexible logistics share the same shift-based, defined-scope work pattern that fits Joby's marketplace model best.
- They have high demand variability (event calendar, seasonal logistics peaks) — the exact condition where a per-shift marketplace adds the most value over traditional staffing.
- The internal strategy doc (`Joby_internal_strategy.md`, section "פיילוט ראשוני") covers both pilot families in full with requirement patterns and ad copy.

**What's in the brand doc:**
- `event_staff`, `promo_staff`, `project_worker` → "משפחה 1: אירועים, פרומו ופרויקטים קצרים" in internal strategy
- `flex_logistics_worker`, `warehouse_helper` → "משפחה 2: לוגיסטיקה גמישה ועזרה במחסן" in internal strategy

**What's missing (deferred):**
- External publishing copy for all 5 pilot families — not yet in `Joby_external_publishing.md`. Should be added in a future content round after internal strategy review.
- Occupation catalog entries for `project_worker` and `warehouse_helper` (not present). Add `{ key: "project-work", label_he: "עבודות פרויקט" }` and `{ key: "warehouse-helper", label_he: "עוזר/ת מחסן" }` in a future catalog update.
- Growth classifier presets for the pilot families — `STAGE1-OPS-ROLLOUT.md` currently has presets only for warehouse and call-center. A Stage 2 preset addition (or Stage 1 expansion after the pilot decision) should add interest role families for `event_staff`, `promo_staff`, `flex_logistics_worker`.

---

## Usage Notes

**For engineers:** Always use the `ROLE_FAMILIES` key from `constants.ts` as the identifier in code, DB queries, and API responses. Never invent new keys ad-hoc; add them to `ROLE_FAMILIES` first.

**For copywriters:** Use the canonical Hebrew label from the "Canonical label" column above. For roles with full brand treatment (forklift, warehouse, delivery driver, call center, security, cleaning), the Hebrew copy in `Joby_internal_strategy.md` is the source. For pilot families, the internal strategy section "פיילוט ראשוני" is the source.

**For growth ops:** The growth classifier's `ROLE_FAMILIES` key is the canonical classifier output. When adding presets, use the snake_case key from ROLE_FAMILIES. The occupation catalog keys are the worker self-report layer (different system, not the classifier).

**For future normalization:** The two keys that most need a code-level fix are `warehouse_worker` (brand docs say `warehouse_clerk`) and `cleaner` (brand docs say `cleaning_worker`). These are the only cases where a human reader following the brand doc would use a key that doesn't exist in ROLE_FAMILIES. They can be fixed with a non-destructive code rename when the next normalization pass is scheduled.
