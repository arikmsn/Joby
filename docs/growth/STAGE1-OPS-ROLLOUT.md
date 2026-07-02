# Stage 1 — Operational Rollout Pack (Live Collection)

**Date:** 2026-07-02 · **Audience:** growth_ops, growth_analyst, super_admin · **Scope:** operations, measurement, validation only — no new product scope, no AI, everything inside `/growth/*` admin screens.
**Companions:** [STAGE1-VALIDATION.md](STAGE1-VALIDATION.md) (per-source technical checks) · [ROADMAP-STAGED.md](ROADMAP-STAGED.md) (stage definitions).

---

## 1. Recommended Initial Source Set (activate in this order)

Mix chosen to exercise every collection path and cover the three launch cells (warehouse/Ashdod-Shfela · call-center/Beer Sheva-South · warehouse-industrial/Haifa-Krayot). **All names/URLs below are candidates — ops verifies the exact URL, robots.txt, and TOS during onboarding (step 2 of the procedure); nothing is exempt from the approval gate.**

| # | Source (candidate) | Type | Method | Risk tier | Why first | Config starting point |
|---|---|---|---|---|---|---|
| 1 | Israel Employment Service open data (taasuka via data.gov.il datastore endpoint — ops locates the dataset URL) | gov | api | low | Zero-friction public-mandate data; validates the gov path | No crawl; default schedule 12h |
| 2 | Shufersal careers (logistics/DC roles) | career_page | fetch + crawl | low | Big retail-DC employer, center+south coverage | depth 2, include `*career*`,`*job*`,`*משרות*`; warehouse preset below |
| 3 | Rami Levy careers | career_page | fetch + crawl | low | Retail/DC, strong Shfela presence | same as #2 |
| 4 | A national logistics operator careers (e.g., HFD / Orian) | career_page | fetch + crawl | low | Direct warehouse/driver demand, Ashdod-relevant | warehouse preset |
| 5 | A telecom/insurance call-center careers page (e.g., Bezeq / Cellcom / Harel) | career_page | fetch + crawl | low | Call-center cell (Beer Sheva) | call-center preset below |
| 6 | National Telegram "דרושים" channel (ops picks 1 active public channel, verify handle) | telegram | fetch | low-med | Validates Telegram path; high freshness | Default; keyword fallback active |
| 7 | Regional Telegram channel — south/Ashdod (verify handle) | telegram | fetch | low-med | Cell-A signal | cities: אשדוד, יבנה, ראשון לציון |
| 8 | AllJobs manual sweep (filtered to cell role families) | board | **manual** | low (as performed) | Boards carry the densest signal — humans only, per guardrails | n/a — analyst entry form |
| 9 | Facebook groups — דרושים Ashdod/Shfela (2-3 groups) | fb_group | **manual** | low (as performed) | Where blue-collar hiring actually happens | n/a — analyst entry form |
| 10 | Facebook groups — דרושים Beer Sheva/South | fb_group | **manual** | low (as performed) | Cell-B signal | n/a |

**Config presets** (enter on the source detail screen):
- **Warehouse preset:** interest role families: מחסנאי/ת, מלקט/ת, מלגזן/ית, אורז/ת, נהג/ת חלוקה; include keywords: `דרושים, מחסן, לוגיסטיקה, מלקט, משמרות`; exclude keywords: `סטודנט להנדסה, היי-טק`; cities per cell; hard filter **off** initially (watch what scoring does first).
- **Call-center preset:** families: נציג/ת מוקד, נציג/ת שירות, תמיכה, מכירות טלפוניות; include: `מוקד, נציג, שירות לקוחות, משמרות`; cities: באר שבע + south.
- **Common exclude rules (all crawled sources):** `*/login*`, `*/signin*`, `*/blog*`, `*/news*`, `*privacy*`, `*terms*`, `*/contact*`, `*/about*`, `*?page=*` (add per-site noise as the test panel reveals it).
- **Include rules:** start with the site's careers section (`/careers/*`, `/jobs/*`, `*drushim*`, `*משרות*`) — confirm exact paths via Test before approving.

Do NOT activate in Stage 1: automated collection of AllJobs/Drushim/JobMaster/Indeed (prohibited), anything requiring login, any Meta automation.

---

## 2. Adding & Approving a New Source — Step-by-Step (admin UI)

1. **Pre-check (outside the app, 5 min):** open the site's `/robots.txt` and TOS page. Note Disallow rules and any anti-scraping language. Decide risk tier: gov/own-career-pages = low; Telegram previews/agencies = medium; anything with TOS friction or competitor character = **high** (super_admin approval).
2. **Propose:** `/growth/sources` → "הצעת מקור חדש" → fill type, name, root URL, collection method (fetch/api/manual), risk tier, and paste your robots/TOS findings into the notes field. Source is created as `proposed` — nothing collects yet.
3. **Configure:** open the source's "פרטים והגדרות" page → set crawl on/off, seed URLs (careers section entry points), depth (start 1-2), max pages (start 20-30), delay (keep 10,000ms default), include/exclude rules, interest preset, schedule (frequency 12h, window 05:00-22:00 default). Save.
4. **Test (mandatory before approval):** click "בדיקה (יבש)". Review: allowed URLs — are these the job pages you expect? Blocked list — are exclusions catching login/blog/noise? Samples — is extracted text readable and relevant, do priorities look sane? Iterate rules → Test again (dry runs persist nothing). If the page yields "page text too short," the site is JS-rendered — mark in notes and skip (no workaround in Stage 1).
5. **Approve:** back on the list → "אישור" (growth_ops; high-risk requires super_admin — the button will 403 otherwise, by design). Status change is audit-logged.
6. **First real run:** "הרצה עכשיו" → confirm items appear in `/growth/observations` queue with sensible priorities → open run history on the detail page and check pages/ingested/duplicates/filtered.
7. **Watch for 48h:** freshness badge on `/growth/metrics`, and the source's error field. A source that pushes back (403/429) stops itself — never tighten the delay downward in response; pause it and note why.
8. **Escalation rule (unchanged):** any legal letter, ban, or complaint → pause the source same day, note it, tell the PM.

---

## 3. Daily Analyst Workflow (~90-120 min/day total)

| Time | Task | How | Target |
|---|---|---|---|
| 09:00 (30-45m) | **Manual sweep** — boards + FB groups (sources #8-10) | Entry form at `/growth/observations/new`, one structured row per relevant posting; facts only, never paste ad text anywhere except the raw-text field | 20-40 entries/day |
| 09:45 (30-45m) | **Review queue** — `/growth/observations`, "ממתינות לבדיקה" tab (priority-sorted) | For each item: expand raw text → inline classify (family, region, title, city, employer) → "שמירה וסיום בדיקה". Junk item (irrelevant page): classify honestly as `other` + resolve — the weekly ranking uses this as a junk signal for the source | Empty the queue or top-50; **median ≤2 min/item (≤3 for raw crawler pages)** |
| 10:30 (10m) | **Metrics glance** — `/growth/metrics` | Check: queue depth trend, freshness %, any source error badges. Two consecutive days of a red/stale source → tell ops | Freshness ≥90% |
| 10:40 (5m) | **Log anomalies** | New source ideas → propose (step 2 flow); recurring junk pattern → suggest an exclude rule/keyword to ops | — |
| Weekly (Sun, with ops) | Ranking review — see §4 | | |

Notes: the queue is ordered by priority score — trust it, work top-down. Don't fight bad extraction by hand-editing 50 identical junk items; that's a rules problem — fix the source config instead (that discipline is exactly what keeps median review time meaningful).

---

## 4. Weekly Source-Ranking Template

Fill every Sunday (ops + analyst, ~30 min). Data sources: `/growth/metrics` (yield, freshness, median review time is global — per-source review burden from the analyst's sense + junk share), per-source **run history** on the detail page (duplicates, errors), `/growth/clusters` (ad-worthy membership).

| Source | Yield (obs/wk) | Freshness (% runs on schedule) | Dup rate (dups ÷ (ingested+dups)) | Junk share (% resolved as `other`) | Median review time | Error rate (failed runs ÷ runs) | Ad-worthy contribution (structured obs now in ad-worthy clusters) | Score | Action |
|---|---|---|---|---|---|---|---|---|---|
| … | | | | | | | | | keep / tune / pause |

**Scoring guide (simple, 0-10):** start at 5 · +2 yield in top third · +1 freshness ≥90% · +1 ad-worthy contribution >0 · −1 dup rate >60% (career pages naturally re-serve; >60% sustained means the page rarely changes → lower frequency instead of penalizing) · −2 junk share >40% · −2 error rate >25% · −1 median review time for this source's items notably above target.

**Actions:** **keep** (≥6) · **tune** (4-5: adjust rules/keywords/frequency, re-test) · **pause** (≤3 for two consecutive weeks, or any guardrail incident). Log the decision in the source's notes field.

Per-source ad-worthy contribution isn't a single dashboard number yet — count it from `/growth/observations` filtered by channel against the ad-worthy clusters list, or (super_admin) one read-only SQL: structured observations per channel whose `cluster_id` is in `demand_clusters where ad_worthy`. If this becomes tedious by week 2, it's a candidate metrics-panel addition — note it, don't build it now.

---

## 5. Go/No-Go: Stage 1 → Stage 2 (AI)

Evaluate after **2 full weeks** of live collection. All GO conditions must hold; any NO-GO condition blocks regardless.

**GO when all of:**
1. **Pipeline proven:** ≥5 real sources ran on schedule for 2 weeks; freshness ≥90%; error rate per surviving source <15%; 0 unresolved SSRF/authz/exposure findings.
2. **Volume:** ≥50 observations/day combined (≥25/day automated) — enough flow that automation matters.
3. **Labeled baseline exists:** ≥300 human-structured observations (classified + resolved) — this is the Stage-2 extraction eval set; below that, we can't measure whether AI is accurate.
4. **Demand signal is real:** ≥5 ad-worthy clusters from human-structured data across ≥2 launch cells.
5. **AI has a job to do:** review burden is the bottleneck — median review time above the 2-min target with queue depth growing, OR analyst time on structuring exceeds ~90 min/day sustained. (If humans comfortably clear the queue, defer Stage 2 and add sources instead — AI should solve a measured problem, not a hypothetical one.)
6. **Source ranking stable:** two consecutive weekly rankings agree on the top-5 sources — extraction should be trained/evaluated against sources that will still be there.

**NO-GO (fix first) if any of:**
- A guardrail incident is open (source pushback unresolved, legal letter, authz finding).
- Junk share >40% overall — AI would automate garbage; fix rules/filters first.
- Duplicate handling misbehaving (same item repeatedly re-queued).
- The labeled set is <300 or heavily skewed to one source/family (eval would be meaningless).
- Analyst process unstable (median review time still swinging >2× week-over-week).

**Decision artifact:** a one-page memo (append to this doc): metrics table for the 2 weeks, the two weekly rankings, GO/NO-GO per criterion, and — if GO — the top-5 sources and ~role-family mix Stage 2 extraction will be evaluated on.
