# Growth Engine — W1 Handoff Note

**Date:** 2026-07-02 · **Scope:** Execution pack v3.0, week-1 critical path (E1 → E2 → E3-start)
**Commit:** "Growth Engine W1 foundation: RBAC, audit log, sources + observations (admin-only)"

## What shipped

| Area | Delivered |
|---|---|
| RBAC (E1) | Growth sub-roles (`super_admin`/`growth_ops`/`growth_analyst`/`compliance_reviewer`) on `users.admin_sub_role`; permission registry in `constants.ts`; `withGrowthAuth(permission, handler)` wrapper on **every** `/api/admin/growth/*` route (deny-by-default, 503 when `GROWTH_MODULE_ENABLED=false`, 403s audit-logged) |
| Audit (E1) | Append-only `audit_logs` (insert-only repo, ids only — never PII); `/api/admin/growth/audit` viewer endpoint (super sees all, ops own-actions only) |
| Schema (E2) | 12 growth tables live in Neon: `audit_logs`, `source_channels`, `source_jobs`, `demand_clusters`, `demand_cluster_employers`, `ad_briefs`, `landing_pages`, `joby_ads`, `ad_publications`, `candidates`, `candidate_submissions`, `employer_targets`, `cluster_evidence_snapshots` |
| Data layer (E2) | Masked-by-default candidate DTOs (`lib/growth/dto.ts`); 14-day dedup hash enforced by unique index; growth Zod validators; raw-text 30-day TTL purge cron (`/api/admin/growth/jobs/purge`, audited runs) |
| Screens (E3) | `/growth/sources` (propose → approval gate; high-risk approval = super_admin only, server-enforced) and `/growth/observations` + `/growth/observations/new` analyst entry form; gated "צמיחה" admin-nav section |
| Isolation | `robots.txt` + `X-Robots-Tag: noindex` on `/growth` and `/api`; ESLint bars `lib/growth` imports from worker/employer code; `npm run check:growth-authz` CI gate; growth UI strings isolated in `he-growth.ts` |

## What was verified
Production build + lint clean; authz route-walk check green (8 route files);
12-assertion end-to-end smoke test green (see [W1-EVIDENCE.md](W1-EVIDENCE.md));
flag-off returns 503 on growth endpoints without affecting other admin APIs;
test data cleaned up (0 residual rows, 0 granted sub-roles).

## ⚠️ Drizzle drift finding on `users`
`npx drizzle-kit push` detects pre-existing drift on the `users` table
(`users_phone_unique` constraint naming) and interactively offers to **TRUNCATE
users** (~42 live rows). Do not run it, and never with `--force`. Schema changes
go through additive `IF NOT EXISTS` SQL scripts — pattern:
`app/scripts/migrate-growth.mjs`. Policy is codified in CLAUDE.md
("Migration Safety Policy").

## One-time super_admin bootstrap
While **no** super_admin exists, any `role=admin` user may self-grant once:

```
POST /api/admin/growth/roles/grant
Authorization: Bearer <admin JWT>
{ "user_id": "<your own user id>", "sub_role": "super_admin" }
```

The wrapper allows this only in the zero-super_admin state and only as a
self-grant of super_admin; it is audit-logged (`ROLE_GRANTED`). After that,
all role management is super_admin-only. Requires `GROWTH_MODULE_ENABLED=true`
(+ `NEXT_PUBLIC_GROWTH_MODULE_ENABLED=true` for the nav).

## 🚦 W2 blocker — do not cross
**No public landing page (or any campaign) goes live until privacy counsel has
reviewed and approved the intake consent text and database duties (Privacy
Protection Law, Amendment 13).** The W2 code (LP shell, intake endpoint, masked
review queue) may be built and merged, but stays dark behind
`PUBLIC_LP_ENABLED=false` + per-page `status='live'` until counsel clears it.
Related launch-gate items still open: MFA + ≤12h admin sessions, CV upload
security (needs object-storage decision), consent-withdrawal deletion path.
