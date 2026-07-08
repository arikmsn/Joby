# Joby Growth Engine — Staged Delivery Roadmap

**Version:** 4.0 · **Date:** 2026-07-02 · **Status:** Approved
**Baseline:** W1 foundation + W2 safe boundary shipped (RBAC, audit, sources/observations, dark LP shell + hardened intake + masked queue). Admin-only architecture and all legal/compliance guardrails unchanged. ⚖️ = requires legal review. 🚦 = launch gate.

> **Scope note:** The "Stage 1/2/3…" numbering in this document refers exclusively to **Growth Engine delivery stages** (collection → AI layer → publishing → leads → candidates). This is separate from the product's **Pilot Role Families** (events/promo and flex-logistics, defined in `docs/brand/Joby_internal_strategy.md` under "פיילוט ראשוני"). Those product families are live in the marketplace taxonomy independently of which Growth Engine stage is active.

---

## 1. Stage-by-Stage Roadmap

### Stage 1 — Collection validation (no AI)
| | |
|---|---|
| **Goal** | Prove the collection pipeline end-to-end: sources → observations → dedup → clusters → admin review, with measurable source reliability — before any AI touches the data |
| **In scope** | Telegram public-channel collector + gov/open-data pull (cron); SSRF-guarded career-page fetcher landing raw text into the review queue for **human** structuring; rule-based nightly clustering job (`ad_worthy` = ≥5 obs ∧ ≥3 employers, server-computed); analyst daily sweep via the entry form; collection-health metrics panel: observations/day, coverage freshness, queue depth, per-source yield, **median review time per observation** |
| **Out of scope** | Any AI extraction/classification; ad drafting; publishing; anything public-facing (LP stays dark) |
| **Success criteria** | 2 weeks of continuous collection; ≥50 obs/day combined; ≥90% channel freshness (≤48h); duplicate handling verified; ≥5 ad-worthy clusters; per-source reliability ranking (yield, error rate, review burden); **median review time per observation ≤2 minutes** (raw collector items ≤3 min) — if the median stays above target after ergonomics fixes, that is the signal that Stage 2 extraction is worth its cost |
| **Blockers/deps** | None technical. Product finalizes channel lists + curated employer list |

### Stage 2 — AI layer (extraction first, generation second)
| | |
|---|---|
| **Goal** | Replace human structuring with AI extraction/classification under confidence gates; then AI-draft Joby ads under the human compliance gate |
| **In scope** | Extraction of collector raw text → `source_jobs` fields (confidence <0.7 → review queue; 10% daily spot-check); classification onto the fixed taxonomy; then Ad Writer drafting **only** from approved briefs of ad-worthy clusters; advisory-only AI compliance pre-check attached to the human review screen |
| **Out of scope** | Resume parsing; auto-publish; AI approval decisions; AI touching candidate PII |
| **Success criteria** | ≥90% extraction accuracy vs the Stage-1 human-structured baseline; median review time drops materially; first 6-9 ads drafted and human-approved |
| **Blockers/deps** | Stage 1 labeled baseline as the eval set; Anthropic API key server-side only |

### Stage 3 — Ad & publication management
| | |
|---|---|
| **Goal** | Full admin workflow: drafts → compliance approval (segregation of duties) → publication records → status management |
| **In scope** | `/growth/ads`, `/growth/compliance`, `/growth/publications` per execution pack S5.1-S5.3; `landing_pages` management UI; flipping `PUBLIC_LP_ENABLED` 🚦 only after privacy counsel clears ⚖️ |
| **Out of scope** | Auto-publishing; competitor-board posting (pending A3 ⚖️); attribution analytics |
| **Success criteria** | First live publications on 2 cells; every publish traceable ad→brief→cluster in audit; 0 severe compliance incidents |
| **Blockers/deps** | 🚦 Privacy counsel (PPL Amendment 13) ⚖️; Meta business verification + employment special-ad-category; MFA + ≤12h admin sessions |

### Stage 4 — Leads & attribution
| | |
|---|---|
| **Goal** | Know which platform/publication produces usable candidates |
| **In scope** | Unique publication code per `ad_publications` row in LP URLs (naming convention below — **defined now, implemented in Stage 4**); funnel metrics per publication; cost per usable candidate per cell (north star); CV upload (storage-only phase) once storage + security land 🚦 |
| **Out of scope** | Multi-touch attribution; candidate accounts |
| **Success criteria** | Every submission attributable to a publication; per-platform CPL comparison drives budget; ≥50 usable candidates in ≥2 cells |
| **Blockers/deps** | Stage 3 live publications; object-storage decision for CVs 🚦 |

#### Publication-code & UTM naming convention (binding from Stage 4 day 1)
- **Publication code (canonical attribution key):** `p_<8 lowercase base32 chars>` (e.g. `p_7k2m9x4q`), generated per `ad_publications` row, unique-indexed, never the internal UUID. Carried as `?p=<code>` on LP URLs; resolved server-side at intake; unknown/missing code degrades to landing-page-only attribution. One publication = one channel placement (same ad on Meta and Telegram = two rows, two codes).
- **UTM convention (secondary, for platform-side reconciliation only):** all lowercase ascii, `_` as separator, no free text:
  - `utm_source` = platform key from the `PublicationPlatform` enum (`meta`, `google`, `gfj`, `telegram`, `fb_group`, `board`)
  - `utm_medium` = `paid` | `organic` | `community`
  - `utm_campaign` = `jb_<rolefamily>_<region>_<yyyymm>` (keys from the taxonomy enums, e.g. `jb_warehouse_worker_shfela_ashdod_202607`)
  - `utm_content` = `<publication code>` (identical to `p` — one join key everywhere)
- The `p` code is authoritative; UTMs are never trusted as the primary source of truth.

### Stage 5 — Candidate management in-platform
| | |
|---|---|
| **Goal** | Candidates become managed users: profile, interest areas, relevant-job suggestions |
| **In scope** | Candidate registration (reuse phone-OTP auth); profile + interest areas; suggestions of **Joby-platform** roles; consent-based bridge from `candidates` (RPD) to platform users ⚖️; **funnel A/B test (below)** |
| **Out of scope** | Routing to **external** employers (placement license A4 ⚖️ — phase 2); employer-interest loop beyond authorized pilots |
| **Success criteria** | Measured conversion from intake to registered users; A/B verdict on gating; repeat digest engagement |
| **Blockers/deps** | Stage 4 volume; consent/retention policy implemented ⚖️ |

#### Stage 5 funnel experiment (explicit, planned now)
Side-by-side test on the same cell with a 50/50 traffic/budget split, minimum 2 weeks or ≥200 submissions per arm:
- **Arm A — quick-apply (current):** name + phone + consents, no account.
- **Arm B — preview→register:** public headline + salary band + summary; full details + apply behind phone-OTP registration. Run only on ads with real, specific details worth gating (employer-authorized where possible).
- **Primary metric:** cost per usable candidate. **Secondary:** 7-day contactability rate (answered/responded), registration completion rate, submission quality score. Decision rule pre-registered: adopt B per-ad-type only if primary metric is ≤ A's within 20% while contactability is meaningfully higher.

---

## 2. What Changes in the Current Implementation Plan

**Already aligned:** W1 = Stage 1 foundation. W2's LP/intake/queue were built ahead of stage — parked dark behind `PUBLIC_LP_ENABLED=false`; they become live deliverables in Stages 3-4. No rework.

| Item | v3.0 pack said | Now |
|---|---|---|
| AI extraction pipeline | W2-W3 | Stage 2 — Stage 1 collectors land raw text for human structuring, which creates the labeled eval set AI must beat |
| Compliance/ads/publications UI | W2-W3 | Stage 3 |
| Metrics dashboard | W3 | Split: collection-health panel up into Stage 1; funnel metrics in Stage 4 |
| Career-page fetcher | W3 | Stage 1 (collection validation, not AI) |

**Build now (Stage 1):** Telegram + gov collectors, SSRF-guarded fetcher, rule-based clustering job, collection-health metrics panel, review-queue ergonomics. **Defer:** everything AI; ads/compliance/publications UI; public flags; CV upload; candidate accounts; employer outreach.

---

## 3. AI Timing and Scope

Safest order: **extraction → classification → ad generation → advisory compliance pre-check → (much later) resume parsing.**

| Capability | When | AI does | Human keeps |
|---|---|---|---|
| Extraction | Stage 2 first | Raw text → structured facts + confidence; raw text still TTL-purged | <0.7 rows, 10% daily spot-check, corrections |
| Classification | Stage 2 | Fixed taxonomy mapping; "other" → queue | Queue resolution, taxonomy changes |
| Ad generation | Stage 2 second half | Drafts only from approved ad-worthy briefs; never references a single source ad | **Every** ad: compliance sign-off by a different human than the author — unchanged hard gate |
| Compliance pre-check | Stage 2/3 | Advisory similarity/wording/substantiation flags on the review screen | The decision. AI never approves/rejects/publishes |
| Resume parsing | Stage 4/5 earliest | Parse stored CVs into structured fields (RPD) | Gated on storage security + counsel-approved basis ⚖️ |

Rationale: extraction is internal, verifiable, and measurable against the Stage-1 manual baseline; generation is public-facing so it inherits the existing human gate; anything touching PII or compliance decisions comes last or never.

---

## 4. Candidate Funnel Design

Full funnel (Stage 5): ad click → public preview (headline, salary band, region, short summary) → phone-OTP quick-register → full details + one-tap apply → confirmation + weekly digest (§30A consent).

**Tradeoff:** every gate costs conversion (blue-collar candidates are drop-off-prone); zero friction produces unverified, low-commitment leads and no owned relationship. Gating is only worth it when the gated content is genuinely valuable — a real, specific job. Generic pool ads have no "full details" to withhold.

**MVP recommendation:** keep no-account quick-apply through Stages 3-4 (phone capture already gives an owned channel). Introduce preview→register in Stage 5 **only on ads with real job details**, and decide by the pre-registered A/B experiment above — not by intuition.

---

## 5. Lead Attribution Design

Every publication gets a unique identifier — schema already supports it (`ad_publications` row; `candidate_submissions.publication_id` waiting to be populated). Implementation per the binding naming convention in Stage 4 above.

**Measure in order:** (1) submissions per publication; (2) usable-candidate rate per publication (review-queue outcomes); (3) **cost per usable candidate per publication/platform** — the north star that moves budget; (4) later: CTR, time-to-first-submission, digest engagement.

---

## 6. Resume Strategy (policy-driven, phased)

| Phase | Stage | What happens |
|---|---|---|
| 1. Storage only | Stage 4 | Optional CV upload: magic-byte validation, size cap, object storage, randomized keys, signed URLs ≤5 min, every open audited (`CV_ACCESSED`). Blocked on storage decision + counsel sign-off ⚖️; field stays off the form until then |
| 2. Parsing | Stage 5 | AI parses stored CVs → structured fields on the candidate record; parsed output classified RPD like the source file; parse errors never overwrite candidate-entered data |
| 3. Indexing/search | Stage 5+ | Admin-only search over parsed fields; aggregate counts only in sales collateral |
| 4. Reuse | Phase 2 | Matching/sharing requires **per-instance candidate consent** ⚖️; tied to placement-license question A4 |

### Retention & deletion — explicit procedure (policy-driven, not aspirational)
- **Policy parameters (counsel-set ⚖️, config-driven):** `CV_RETENTION_MONTHS` (proposal: 24), `CONSENT_WITHDRAWAL_SLA_DAYS` (proposal: 14). Stored as configuration, not hardcoded prose.
- **Scheduled retention purge (cron, audited):** monthly job selects candidates past retention → deletes, in order: (1) storage object(s) — CV file and any derivatives, (2) parsed/derived fields, (3) `candidate_submissions` rows, (4) `candidates` row, (5) suppression of the phone from any digest list. Each run writes an audit row (`PURGE_RUN`) with counts only.
- **Consent-withdrawal deletion (on demand):** same 5-step procedure, triggered per candidate, completed within the SLA; audited with candidate id only. Must exist and be tested **before** CV upload is enabled 🚦.
- **Verification:** each purge run is followed by an automated check that no orphaned storage objects or submission rows remain for the deleted ids; failures alert and are logged.
- **Legal holds:** a per-candidate hold flag exempts a record from purge (counsel-directed cases only, super_admin-set, audited).

---

## 7. Employer-Interest Loop

- **Value:** high — it is the phase-2 revenue motion (warm outreach with evidence).
- **Complexity:** moderate — interest→`employer_targets` linkage + outreach tracking.
- **Sensitivity:** high ⚖️ — (1) reveals systematic monitoring of employers' postings; (2) placement-for-fee licensing question (A4) unresolved; (3) any candidate-specific mention starts a data-sharing conversation requiring explicit consent.
- **Placement:** phase 2, after Stage 5. Existing gate stays: moving an employer target to "contacted" requires super_admin confirmation.
- **Safest initial version:** manual, super_admin-approved outreach to warm-intro/authorized employers only, presenting **aggregate** evidence from `cluster_evidence_snapshots` — never a specific candidate, never tied to a specific observed ad, no PII without per-instance consent ⚖️. Cold outreach stays off the table until counsel clears licensing and framing.

---

## 8. Updated Execution Recommendation

- **Build next (Stage 1, ~2 weeks):** Telegram + gov collectors, SSRF-guarded career-page fetcher feeding the human review queue, rule-based clustering job, collection-health metrics panel (including median review time), review-queue ergonomics. Then run the pipeline for two weeks and rank sources by yield and review burden — that ranking is Stage 1's deliverable and Stage 2's eval baseline.
- **Postpone:** all AI (Stage 2); ads/compliance/publications UI (Stage 3); attribution codes + CV upload (Stage 4); candidate accounts, preview-gating, candidates→users bridge (Stage 5); employer-interest loop (phase 2).
- **Behind legal/privacy review ⚖️:** flipping `PUBLIC_LP_ENABLED`; CV storage/parsing basis + the retention/deletion procedure above; candidates→users consent bridge; board advertiser terms (A3); placement licensing (A4) and employer-interest framing.
