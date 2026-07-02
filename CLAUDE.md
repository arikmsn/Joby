# Joby — Shift Operations Platform

## Stack
- Next.js 14 (App Router) + TypeScript strict
- Neon (Postgres) + Drizzle ORM
- Tailwind CSS, Hebrew RTL-first
- No Supabase — Neon + Drizzle only

## Project Structure
- `app/` — Next.js project root
- `app/src/lib/schema.ts` — Drizzle schema (single source of truth)
- `app/src/lib/constants.ts` — All enums and config constants
- `app/src/lib/i18n/he.ts` — Hebrew strings
- `app/src/lib/trust.ts` — Trust score calculation
- `app/src/lib/qr.ts` — QR token generation/verification
- `app/src/lib/slots.ts` — Atomic slot management
- `app/src/lib/overlap.ts` — Shift overlap detection
- `app/src/app/api/` — Route handlers (business logic)
- `app/src/app/(worker)/` — Worker mobile-first pages
- `app/src/app/(employer)/` — Employer dashboard pages
- `app/src/app/(admin)/` — Admin pages (future)
- `app/src/components/ui/` — Shared UI components

## Commands
```
cd app && npm run dev                # Dev server
cd app && npm run build              # Production build
cd app && npm run lint               # ESLint
cd app && npm run check:growth-authz # Growth route authz gate (CI)
```

## Growth Module (admin-only)
- `app/src/lib/growth/` — candidate-acquisition growth engine (RBAC wrapper,
  audit, DTO masking, dedup). NEVER import from worker/employer code (ESLint-enforced).
- Every `/api/admin/growth/*` handler must be `export const METHOD = withGrowthAuth(permission, handler)`;
  cron jobs under `growth/jobs/*` use `isAuthorizedCronRequest` instead. Enforced by `check:growth-authz`.
- Growth sub-roles live in `users.admin_sub_role` (super_admin/growth_ops/growth_analyst/compliance_reviewer);
  bootstrap: first admin self-grants super_admin via POST /api/admin/growth/roles/grant.
- Feature flags: `GROWTH_MODULE_ENABLED` (server, 503 when off) + `NEXT_PUBLIC_GROWTH_MODULE_ENABLED` (nav).
- Growth UI strings: `app/src/lib/i18n/he-growth.ts` (admin-only namespace, not he.ts).
- Candidate PII is masked by default (`lib/growth/dto.ts`); source raw_text is TTL-purged (30d) by
  the cron job at `/api/admin/growth/jobs/purge`.
## Migration Safety Policy
- **Never** use `drizzle-kit push --force` in this repo — it auto-accepts destructive
  statements (it has offered to TRUNCATE `users` here).
- Avoid `drizzle-kit push` against shared/prod-like DBs with drift. The live Neon DB has
  known drift on `users` (constraint naming), so push diffs include destructive fixes.
- Use **additive** migrations/scripts only (`CREATE/ALTER ... IF NOT EXISTS`) unless a
  destructive change is explicitly approved. Pattern: `app/scripts/migrate-growth.mjs`.
- Document any schema drift you discover (what/where/why) in `docs/` **before** applying
  changes, and keep `schema.ts` updated in parallel as the source of truth.

## Key Rules
- Hebrew RTL UI only — all user-facing strings in he.ts
- Status transitions must go through server routes, never client-side
- Slot updates must be atomic (see slots.ts)
- Trust score is deterministic (see trust.ts)
- We are NOT the legal employer — avoid payroll/tax/compliance features
- No Supabase anywhere
