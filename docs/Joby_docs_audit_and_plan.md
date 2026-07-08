# Joby — Documentation Audit & Consolidation Plan

**Date:** 2026-07-08 · **Status:** Research & planning only — no files were moved, merged, or deleted in this round.
**Scope:** All docs in `docs/`, root-level product specs (`MVP_SPEC.md`, `EXECUTION_PACK.md`), and the role-taxonomy definitions in code (`app/src/lib/occupations.ts`, `app/src/lib/constants.ts`).
**Trigger:** Three new core docs were added — `docs/Joby_requirements_and_ads.md`, `docs/brand/Joby_internal_strategy.md`, `docs/growth/Joby_external_publishing.md` — introducing the worker-as-provider (עובד־כספק) model. This report maps how they relate to everything that already exists, and what to do about it.

---

## 1. Executive Summary

The three "new" docs are really **one new strategy layer plus two accidental duplicates**:

- `docs/brand/Joby_internal_strategy.md` is the real, canonical artifact: the worker-as-provider positioning, a six-role taxonomy with full requirement sets and ad copy, content guardrails (§7), and a new "שלב 1" pilot-families appendix (events/promo + flex logistics).
- `docs/Joby_requirements_and_ads.md` and `docs/brand/Joby_internal_strategyOld.md` are **byte-for-byte the same 660-line body** as the strategy doc (diff-verified; only the title differs, and the strategy doc adds the pilot-families appendix). They should be deleted, not maintained.
- `docs/growth/Joby_external_publishing.md` is genuinely new and valuable: the softened, market-ready external copy per role family, with explicit softening rationale per family.

The new layer is largely **complementary** to the committed growth corpus (roadmap, Stage-1 ops), which is about *collection and sourcing mechanics*, not brand voice. But there are **five real contradictions** that must be resolved before wiring any of this into the product or publishing anything — most critically: two conflicting meanings of "Stage 1", a brand promise ("אף עמלה לא יורדת מהשכר") that appears to contradict the implemented 15% platform-fee payout model, and taxonomy keys that don't match the code's `ROLE_FAMILIES` enum (the declared pilot families can't even be classified by the collection pipeline today).

**Urgent housekeeping note:** all three new docs (plus the Old duplicate) are **untracked in git**. The single most valuable strategy document in the repo currently has zero version-control protection. Committing the keepers is step 1 of the next round.

---

## 2. Document Inventory & Map

| Doc | Lines | Purpose | Primary audience | Git status | Overlap with the 3 new docs |
|---|---|---|---|---|---|
| `MVP_SPEC.md` (root) | 1201 | Product spec: scope, personas, operational invariants, flows, statuses | Product, Eng | Committed | None (pure product/eng; no brand/growth content — grep-verified) |
| `EXECUTION_PACK.md` (root) | 763 | Build plan derived from MVP spec (workstreams, sprints) | Eng | Committed | None; historical — references Supabase, superseded by CLAUDE.md stack (Neon + Drizzle) |
| `docs/growth/ROADMAP-STAGED.md` | 153 | Growth engine Stages 1–5: collection → AI → ads/publication → attribution → candidate mgmt; legal gates ⚖️🚦; UTM/attribution conventions | Growth, Eng, Legal | Committed (v4.0, approved 2026-07-02) | Indirect: defines *when* external publishing may go live (Stage 3, behind privacy counsel) — the external doc doesn't reference this gate |
| `docs/growth/STAGE1-OPS-ROLLOUT.md` | 97 | Live-collection ops: initial source set, config presets, analyst daily workflow, weekly source ranking, Stage-1→2 go/no-go | growth_ops, growth_analyst | Committed | Segment focus (warehouse/call-center cells) conflicts with the brand doc's pilot families (see §5.1) |
| `docs/growth/STAGE1-VALIDATION.md` | 68 | Per-source technical validation checklist (crawl, robots, SSRF, dedup, purge) | growth_ops | Committed | None direct |
| `docs/growth/W1-HANDOFF.md` | 52 | W1 delivery record: RBAC, audit, schema, screens, drift warning | Eng | Committed | None — historical record |
| `docs/growth/W1-EVIDENCE.md` | 61 | W1 smoke-test evidence | Eng | Committed | None — historical record |
| `docs/Joby_requirements_and_ads.md` | 660 | "ערכת דרישות ומודעות... (גרסה 2 – חזון הספקים)": 6-role taxonomy, requirements, ad copy, schema, guardrails | Product, Growth, Brand | **Untracked** | **Duplicate** — body ≡ internal_strategy minus header + pilot families |
| `docs/brand/Joby_internal_strategyOld.md` | 662 | Same body with the internal-strategy header | — | **Untracked** | **Exact-body duplicate** of requirements_and_ads |
| `docs/brand/Joby_internal_strategy.md` | 810 | **Canonical internal strategy** (marked "לא לפרסום"): provider model, taxonomy, per-role requirement sets + ads, structured schema (§6), guardrails (§7), pilot families appendix ("שלב 1") | Product, Brand — internal only | **Untracked** | Superset of the two duplicates; declares external doc as its public counterpart |
| `docs/growth/Joby_external_publishing.md` | 362 | Market-ready external copy (landing pages + social posts) per role family, with per-family softening notes and 5 global softening rules | Growth, Marketing | **Untracked** | Companion to internal_strategy (explicitly cross-referenced both ways) |

### Related definitions living in code (not docs)

| Artifact | What it defines | Relation to new docs |
|---|---|---|
| `app/src/lib/constants.ts:359` `ROLE_FAMILIES` | Fixed 20-key growth taxonomy (`warehouse_worker`, `order_picker`, `forklift_operator`, `cleaner`, `call_center_rep`, `customer_service`, …) | Conflicts with doc taxonomy keys — see §5.3 |
| `app/src/lib/occupations.ts` | Product-side occupation catalog (kebab-case: `warehouse`, `picker-packer`, `brand-promotion`, `events-general`, `cleaning`, …) | Third, independent taxonomy — no mapping exists |
| `app/src/lib/constants.ts` `Config.PLATFORM_FEE_PERCENT = 15` + `app/src/lib/payout.ts` | Payout model: worker net = gross − 15% platform fee | Tension with the brand promise "אף עמלה לא יורדת מהשכר" — see §5.2 |

---

## 3. Old vs New — Verdicts

| Doc | Verdict | Reason |
|---|---|---|
| `docs/brand/Joby_internal_strategy.md` | **Keep — canonical** | Superset of both duplicates; self-declares as the internal source of truth; contains the only copy of the pilot-families strategy |
| `docs/Joby_requirements_and_ads.md` | **Deprecate → delete** | 100% of its content is contained in internal_strategy (diff-verified). Keeping it guarantees drift |
| `docs/brand/Joby_internal_strategyOld.md` | **Delete** | Exact-body duplicate; the "Old" suffix already signals intent |
| `docs/growth/Joby_external_publishing.md` | **Keep + one update** | Genuinely new softening layer. Must gain an explicit banner tying every piece of copy to the Stage-3 legal gate (`PUBLIC_LP_ENABLED` stays dark until privacy counsel clears — per ROADMAP-STAGED and W1-HANDOFF 🚦) |
| `docs/growth/ROADMAP-STAGED.md` | **Keep + decision note** | Still the authoritative staged plan. Needs a short decision note reconciling its Stage-1 launch cells with the brand doc's different "שלב 1" (see §5.1) |
| `docs/growth/STAGE1-OPS-ROLLOUT.md` | **Keep** | Current operational doc. Update source presets only *after* the pilot-family decision |
| `docs/growth/STAGE1-VALIDATION.md` | **Keep as-is** | Purely technical; unaffected by the new layer |
| `docs/growth/W1-HANDOFF.md`, `W1-EVIDENCE.md` | **Keep as-is** | Historical delivery records; never edit |
| `MVP_SPEC.md`, `EXECUTION_PACK.md` | **Keep; optionally move to `docs/product/`** | Spec remains product source of truth. EXECUTION_PACK is historical (Supabase-era) — mark as such or archive |

**Where the new docs refine older thinking:** they give the growth engine what it never had — a brand voice, per-role content templates, and an explicit internal/external boundary. The external doc's softening rules are the most mature editorial-risk thinking in the repo.

**Where they simply add structure:** the §6 structured role schema (role_key, requirements, promises, expectations) is a ready-made data model for a future role-taxonomy table / ad-template automation.

**Where they conflict:** segments, fee framing, taxonomy keys, and tone rules — detailed in §5.

---

## 4. Duplications (clean up first)

1. **Three copies of the same 660-line strategy body** — `Joby_requirements_and_ads.md` ≡ `Joby_internal_strategyOld.md` ≡ body of `Joby_internal_strategy.md`. One canonical copy (the strategy doc) should survive.
2. **Guardrails defined in three places** — internal_strategy §7 (content rules), external_publishing (5 softening rules + per-family notes), ROADMAP/STAGE1-OPS (board-scraping prohibitions, e.g. "Do NOT activate automated collection of AllJobs/Drushim/JobMaster/Indeed"). No single place answers "what are we allowed to say/do."
3. **Role taxonomy defined three ways** — brand docs (`warehouse_clerk`, `cleaning_worker`, …), growth `ROLE_FAMILIES` (`warehouse_worker`, `cleaner`, …), product `occupations.ts` (`warehouse`, `cleaning`, …). Same real-world roles, three incompatible key sets.
4. **Internal positioning embedded in the external doc** — each family in external_publishing carries its "פסקת מיצוב פנימית (לא לפרסום)". Intentional and clearly labeled, but a copy-paste-leakage risk once marketing people work from this file. Acceptable short-term; the docs/README index should flag it.

---

## 5. Contradictions (must resolve before implementation)

### 5.1 Two different "Stage 1"s (naming collision + real segment conflict)
- **Growth ROADMAP Stage 1** = collection validation on three launch cells: warehouse/Ashdod-Shfela, call-center/Beer Sheva, warehouse-industrial/Haifa-Krayot. STAGE1-OPS source presets, keywords, and cities are all tuned to these.
- **Brand internal_strategy "שלב 1 – משפחות הפיילוט"** = worker-as-provider pilot on `event_promo_family` + `flex_logistics_family` — chosen precisely because gig-like, short engagements fit the provider model.
- These are different axes (pipeline maturity vs. market segment), but the shared name "Stage 1" plus the segment mismatch means ops is collecting demand signals for segments the brand pilot doesn't target, and nothing collects events/promo demand. **Decision needed:** either extend Stage-1 collection cells to include events/promo sources, or explicitly state the brand pilot launches later (Stage 3+) on the existing cells first. Also: rename one of the "Stage 1"s (e.g., brand doc → "גל פיילוט 1" / "Pilot Wave 1").

### 5.2 Fee framing vs the implemented payout model
- Brand promise (top of internal_strategy, repeated in every role section): **"אף עמלה לא יורדת מהשכר"**.
- Implemented model (`Config.PLATFORM_FEE_PERCENT = 15`; `app/src/lib/payout.ts` `calculateFee()`): payout ledger computes **worker net = gross − 15% platform fee**.
- These can coexist *only* under a specific pricing narrative (the "gross" is the price charged to the employer; the worker's agreed wage is the net; the fee is employer-side). That framing decision is currently **implicit and undocumented**. internal_strategy §7 itself flags this ("הבטחות תלויות־מודל... לוודא שהמודל העסקי אכן עומד בהן לפני פרסום") — but flagging isn't resolving. **Decision needed (product + legal) before any external use of the promise.** The external doc already softened it to "הרשמה חינם / שירות ללא עלות למועמד" — correct interim call.

### 5.3 Taxonomy key conflicts (docs vs `ROLE_FAMILIES` vs `occupations.ts`)
| Concept | Brand docs | `ROLE_FAMILIES` (constants.ts:359) | `occupations.ts` |
|---|---|---|---|
| Warehouse worker | `warehouse_clerk` | `warehouse_worker` | `warehouse` |
| Cleaning | `cleaning_worker` | `cleaner` | `cleaning` |
| Customer service | `call_center_rep` labeled **"נציג/ת שירות לקוחות"** | `call_center_rep` = "נציג/ת מוקד" **and separately** `customer_service` = "נציג/ת שירות לקוחות" | — |
| Pilot families | `event_staff`, `promo_staff`, `project_worker`, `flex_logistics_worker`, `warehouse_helper` | **absent** | roughly `events-general`, `brand-promotion` |
- Consequence: the collection pipeline **cannot classify the declared pilot segments** — analyst classification would dump them into `other`, and clustering/ad-worthiness for those families is impossible today.
- **Decision needed:** one canonical key set (recommendation: extend `ROLE_FAMILIES` as canonical since it's already enforced in code and observations data exists against it; map brand-doc keys onto it; treat `occupations.ts` as the separate product-catalog concern it is, with an explicit mapping table).

### 5.4 Aggressive internal tone vs launch guardrails
- internal_strategy §7 *permits* "לא עוד חברת כוח אדם" and describing market ills (hidden fees, delayed payments) as long as no specific company is attacked.
- external_publishing's own rules **removed exactly those** as "עוין מדי להשקה" / defaming employers who are also potential Joby customers (see the security-guard softening note).
- Both positions are reasonable — for different audiences. But today an internal writer reading only §7 would produce copy the external rules forbid. **Resolution:** one voice-&-guardrails doc with an explicit two-tier structure (internal positioning language vs. externally publishable language), superseding §7 as the operative rulebook.

### 5.5 Provider-model promises vs "not the legal employer"
- CLAUDE.md: "We are NOT the legal employer — avoid payroll/tax/compliance features." MVP_SPEC keeps payroll/invoicing out of scope.
- internal_strategy promises (esp. cleaning family): "תנאים סוציאליים (פנסיה, חופשה, הבראה) מוגדרים בכתב מהיום הראשון", "תשלום בזמן" — commitments that presuppose an employment/payment framework Joby doesn't operate yet (payout infra is internal groundwork only; no real money movement).
- internal_strategy §7 correctly flags worker-classification law (צווי הרחבה in security/cleaning) for legal review. **Resolution:** convert these from prose warnings into tracked launch gates alongside the existing ⚖️/🚦 items in ROADMAP-STAGED, so they block publishing the same way `PUBLIC_LP_ENABLED` does.

### Minor product-doc drift (noted, not part of this cleanup)
- MVP_SPEC invariant §3.6 references an `admin_actions` immutable audit table; no such table exists in `schema.ts` (the admin action-log page is a placeholder; the payout layer got its own audit fields instead). One-line spec correction or a backlog item.

---

## 6. Internal-Only vs Publishable

| Classification | Docs |
|---|---|
| **Internal only — never publish** | `brand/Joby_internal_strategy.md` (marked "לא לפרסום"), all `growth/` ops docs (describe collection/scraping operations), `MVP_SPEC.md`, `EXECUTION_PACK.md`, W1 records, this audit |
| **Publishable content, gated** | Only the "דף נחיתה – טקסט חיצוני" and "פוסטים לרשתות – חיצוני" sections of `growth/Joby_external_publishing.md` — and only after the Stage-3 privacy-counsel gate 🚦. The doc's positioning paragraphs and softening notes are internal |
| **Never publishable by policy** | Anything naming source boards/employers from collection, anything from the observations pipeline (guardrail: facts only, no source-ad text reuse), the un-softened promise set (§5.2, §5.4) |

---

## 7. Proposed Documentation Structure

```
docs/
  README.md                        # NEW: one-page index — what lives where, internal-only markings,
                                   #      pointer to canonical taxonomy + guardrails
  brand/
    Joby_internal_strategy.md      # KEEP — canonical vision, provider model, role content, pilot families
    Joby_voice_and_guardrails.md   # NEW — merges: internal_strategy §7 + external softening rules +
                                   #      scraping/content prohibitions pointer + legal launch gates.
                                   #      Two-tier: internal language vs externally publishable language
  growth/
    ROADMAP-STAGED.md              # KEEP + add pilot-families decision note (§5.1)
    STAGE1-OPS-ROLLOUT.md          # KEEP (update presets only after §5.1 decision)
    STAGE1-VALIDATION.md           # KEEP
    W1-HANDOFF.md, W1-EVIDENCE.md  # KEEP — historical
    Joby_external_publishing.md    # KEEP + add legal-gate banner
  product/
    MVP_SPEC.md                    # MOVED from root (optional, low priority)
    EXECUTION_PACK.md              # MOVED from root; mark historical (Supabase-era)
  data/
    role-taxonomy.md               # NEW — canonical key set + 3-way mapping
                                   #      (ROLE_FAMILIES ↔ brand keys ↔ occupations.ts) + pilot-family additions

DELETED: docs/Joby_requirements_and_ads.md          (duplicate)
         docs/brand/Joby_internal_strategyOld.md    (duplicate)
```

Rationale: `brand/` holds *why and what we say*; `growth/` holds *how we source and operate*; `product/` holds *what we build*; `data/` holds *shared vocabularies* that both docs and code reference. The 3 new docs land as: internal_strategy → `brand/` (already there), external_publishing → stays in `growth/` (it's a growth/campaign asset), requirements_and_ads → deleted (absorbed).

---

## 8. Prioritized Next Steps (implementation — future rounds)

| # | Step | Why first | Touches |
|---|---|---|---|
| 1 | **Consolidate & commit**: delete the two duplicates, `git add` `brand/` + external doc + this report | The canonical strategy is currently untracked — one editor crash from loss. Everything else builds on a single canonical copy | 2 deletions, 1 commit |
| 2 | **Resolve the two-Stage-1 collision** (§5.1): one decision note in ROADMAP-STAGED; rename brand "שלב 1" → "Pilot Wave 1" | Blocks taxonomy work and ops presets; cheapest contradiction to kill | ROADMAP-STAGED.md, internal_strategy.md |
| 3 | **Create `docs/data/role-taxonomy.md`**: canonical keys + 3-way mapping; queue the `ROLE_FAMILIES` code addition (pilot families) behind decision #2 | Unblocks classification of pilot segments; single vocabulary for docs, growth pipeline, and future ad automation | new doc; later constants.ts |
| 4 | **Create `docs/brand/Joby_voice_and_guardrails.md`**: two-tier rulebook superseding §7 as operative; includes the un-publishable-promises list and legal gates | Kills contradiction §5.4; gives marketing one page to obey | new doc; internal_strategy §7 gets a pointer |
| 5 | **Resolve fee framing** (§5.2) with product+legal; document the decision in the guardrails doc | Precondition for ever using the core brand promise externally; also affects payout UI copy | decision + guardrails doc |
| 6 | **Only then: wire docs into code/admin** — role-taxonomy table/seed from §6 schema, ad-template library connected to the Stage-3 `ad_briefs`/`joby_ads` workflow | Everything above is prerequisite vocabulary/policy | schema, growth module |

---

*Report generated as part of the docs audit round, 2026-07-08. No repo files were modified other than adding this report.*
