# Stage 1 — Collection-Layer Validation Checklist

**Purpose:** what to manually verify on **5–10 real sources** from the admin UI before declaring the collection layer stable and moving to Stage 2 (AI). No AI is involved in Stage 1 — every collected item is human-structured in the review queue.

**Who:** growth_ops or super_admin. **Where:** entirely inside `/growth/*` admin screens.

## Pre-flight (once)
- [ ] `GROWTH_MODULE_ENABLED=true` and a super_admin exists (bootstrap grant done).
- [ ] Automated smoke suites green: `smoke-stage1.mjs`, `smoke-crawler.mjs`, `check:growth-authz`.
- [ ] Cron entries deployed (`vercel.json`): collect hourly, cluster + purge nightly.

## Source mix to validate (pick 5–10 real ones)
Aim for coverage across types so each code path is exercised:
- [ ] 2–3 **career pages** with crawl enabled (e.g. a logistics operator, a retailer DC, a call-center employer) — root URL + auto-discovery.
- [ ] 1–2 **career pages** single-page (crawl disabled) — a page that already lists roles.
- [ ] 1–2 **Telegram** public "דרושים" channels.
- [ ] 1 **gov/open-data** endpoint (data.gov.il datastore or taasuka export).
- [ ] 1 **manual** source (analyst sweep) for contrast in the metrics panel.

## Per-source checks (repeat for each configured source)
1. **Definition & approval**
   - [ ] Source created with correct type, root URL, risk tier; status moved to `approved` (high-risk → super_admin only).
   - [ ] robots/TOS notes recorded.
2. **Test mode (dry run) before any real run**
   - [ ] "Test" returns discovered / allowed / blocked counts and text samples.
   - [ ] Blocked list shows the *reason* (`blocked_exclude`, `blocked_include`, `blocked_robots`, `blocked_domain`, `fetch_error`).
   - [ ] Nothing was persisted (observations count unchanged after test).
3. **Include/exclude rules**
   - [ ] A careers/jobs include rule (`/careers/*`, `*jobs*`) keeps relevant pages.
   - [ ] Exclusions (`*/login*`, `*/blog*`, `*privacy*`, `*contact*`, `*?page=*`) are blocked — confirm in the test blocked list.
   - [ ] A seed URL that matches an exclude rule **is blocked** (seeds respect exclusions).
   - [ ] `same_domain_only` keeps the crawl on the root host; off-domain links appear as `blocked_domain`.
4. **robots.txt**
   - [ ] For a site with a known `Disallow`, confirm those paths show `blocked_robots` in the test.
5. **Interest filters**
   - [ ] With `hard_keyword_filter` on and an include keyword absent from a page, the page is `filtered_out`.
   - [ ] An exclude keyword drops an otherwise-matching page.
   - [ ] Priority scoring: pages hitting role-family labels / cities get higher `priority` in the samples.
6. **Run now**
   - [ ] Real run ingests items into `/growth/observations` with `needs_review=true`, `role_family=other`.
   - [ ] `raw_text` present and within TTL; re-running the unchanged page ingests 0 (content-hash dedup).
   - [ ] A `collector_runs` row appears in run history with pages/ingested/duplicates/filtered.
7. **Scheduling & resilience**
   - [ ] After a run, `next_run_at` is set to ~frequency ahead; the channel isn't re-collected before then.
   - [ ] A channel outside its preferred-hours window is skipped by the scheduled collect.
   - [ ] Force a failure (bad URL): `consecutive_failures` increments; after `max_retries+1`, crawl auto-disables (audit row written).
8. **Queue ergonomics**
   - [ ] Raw text expands as plain text; inline classify-and-resolve saves role_family/region/title and clears the review flag in one action.
   - [ ] Higher-priority items sort to the top of the queue.

## Cross-source / pipeline checks
- [ ] **Metrics panel** reflects reality: observations today/7d, per-channel yield, freshness uses each source's `stale_threshold_hours`, queue depth, **median review time**.
- [ ] Structure ~20–30 real observations by hand, then run **cluster** (system job): clusters form by family×region×band; `ad_worthy` flips only at ≥5 obs from ≥3 employers.
- [ ] **Purge** system job nulls `raw_text` past TTL; extracted facts remain; audit row written.
- [ ] **Audit log** shows COLLECT_RUN / CLUSTER_RUN / PURGE_RUN / SOURCE_STATUS_CHANGED with the acting user (or null for cron).

## Safety / guardrail spot-checks (must all hold)
- [ ] An SSRF attempt (config a seed pointing at a private IP or `169.254.169.254`) is blocked (`private_ip`) and never fetched.
- [ ] A source returning 403/429 aborts that run and records the error — no aggressive ret/retry.
- [ ] Every `/api/admin/growth/*` call is 401 unauthenticated / 403 without the right sub-role (route-walk test).
- [ ] Nothing about crawling is visible outside admin; `/growth/*` carries `noindex`; robots.txt disallows `/growth` and `/api/`.
- [ ] No PII in the collection layer (observations are job facts + source text, not personal data); metrics payload has no PII fields.

## Exit criteria (collection layer "stable")
- [ ] ≥5 real sources run on schedule for **2 weeks** with ≥90% freshness.
- [ ] ≥50 observations/day combined; duplicate behavior sane; ≥5 ad-worthy clusters formed from human-structured data.
- [ ] Per-source reliability ranking produced (yield, error rate, review burden, median review time) — this ranking is the input that decides whether Stage 2 AI extraction is worth building.
- [ ] 0 unresolved SSRF/authz/exposure findings.
