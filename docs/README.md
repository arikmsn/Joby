# Joby — Documentation Index

Last updated: 2026-07-08 (docs consolidation round 1 — see [Joby_docs_audit_and_plan.md](Joby_docs_audit_and_plan.md)).

**Default classification: everything in this repo is INTERNAL-ONLY.** The only content cleared for external use is the explicitly marked external sections of one doc (see below), and even those are gated behind legal review.

---

## Folder map

| Location | What lives here |
|---|---|
| `docs/brand/` | Vision, worker-as-provider model, role content, voice & language rules |
| `docs/growth/` | Growth engine: staged roadmap, Stage-1 collection ops, validation, delivery records, external copy library |
| repo root | Product specs (`MVP_SPEC.md`, `EXECUTION_PACK.md`) — planned move to `docs/product/` in a later round |
| `docs/data/` | (planned) Shared vocabularies — canonical role taxonomy mapping docs ↔ code |

---

## Source of truth — by topic

| Topic | Source of truth | Notes |
|---|---|---|
| **Product** (flows, invariants, statuses) | [`/MVP_SPEC.md`](../MVP_SPEC.md) | `EXECUTION_PACK.md` is the historical build plan (Supabase-era; actual stack per `/CLAUDE.md`) |
| **Brand / vision / role content** (positioning, taxonomy, requirement sets, ad copy) | [`brand/Joby_internal_strategy.md`](brand/Joby_internal_strategy.md) | Canonical. Marked לא לפרסום — never publish from it directly |
| **Voice & guardrails** (what we may say, internally vs externally; blocked promises; publishing gates) | [`brand/Joby_voice_and_guardrails.md`](brand/Joby_voice_and_guardrails.md) | **The operative rulebook for all copywriting.** Supersedes internal_strategy §7 as the working reference |
| **Growth strategy & stage gates** | [`growth/ROADMAP-STAGED.md`](growth/ROADMAP-STAGED.md) | v4.0 approved; legal gates ⚖️ / launch gates 🚦 live here |
| **Collection operations** (sources, presets, analyst workflow, go/no-go) | [`growth/STAGE1-OPS-ROLLOUT.md`](growth/STAGE1-OPS-ROLLOUT.md) + [`growth/STAGE1-VALIDATION.md`](growth/STAGE1-VALIDATION.md) | Includes the scraping prohibitions (boards, login-gated, Meta automation) |
| **External copy** (landing pages, social posts) | [`growth/Joby_external_publishing.md`](growth/Joby_external_publishing.md) | Copy *library*, not permission to publish — see gating below |
| **Role taxonomy (canonical keys)** | not yet unified — planned `docs/data/role-taxonomy.md` | Today three key sets coexist: brand docs, `ROLE_FAMILIES` (`app/src/lib/constants.ts`), `occupations.ts`. Do not invent new keys until unified |

---

## Document classification

### Internal-only — never publish
- `brand/Joby_internal_strategy.md` — positioning, provider model, un-softened promises
- `brand/Joby_voice_and_guardrails.md` — the rulebook itself
- All `growth/` ops docs (`ROADMAP-STAGED`, `STAGE1-OPS-ROLLOUT`, `STAGE1-VALIDATION`, `W1-HANDOFF`, `W1-EVIDENCE`) — describe collection/sourcing operations
- `/MVP_SPEC.md`, `/EXECUTION_PACK.md`
- `Joby_docs_audit_and_plan.md` (this audit)

### Publishable content — gated
- **Only** the sections titled «דף נחיתה – טקסט חיצוני» and «פוסטים לרשתות – חיצוני» inside `growth/Joby_external_publishing.md`.
- The «פסקת מיצוב פנימית» paragraphs and «הערת ריכוך» notes in that same file are **internal** — strip them before any hand-off to marketing.
- Gate: nothing goes public before the Stage-3 legal gate clears (`PUBLIC_LP_ENABLED` stays off until privacy counsel approves — see `growth/ROADMAP-STAGED.md` Stage 3 and `growth/W1-HANDOFF.md`), and every published ad requires human compliance sign-off per the roadmap.

---

## Historical records (do not edit)
- `growth/W1-HANDOFF.md`, `growth/W1-EVIDENCE.md` — W1 delivery evidence
- `/EXECUTION_PACK.md` — original build plan

## Known open items (tracked in the audit, not yet resolved)
1. "Stage 1" naming collision: growth Stage 1 (collection cells) vs brand «שלב 1» (pilot families) — pending decision.
2. Fee framing: «אף עמלה לא יורדת מהשכר» vs the implemented 15% platform fee — pending product+legal decision; the promise is on the blocked list in the guardrails doc.
3. Taxonomy unification (`docs/data/role-taxonomy.md`) — pending item 1.
