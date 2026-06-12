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
cd app && npm run dev    # Dev server
cd app && npm run build  # Production build
cd app && npm run lint   # ESLint
```

## Key Rules
- Hebrew RTL UI only — all user-facing strings in he.ts
- Status transitions must go through server routes, never client-side
- Slot updates must be atomic (see slots.ts)
- Trust score is deterministic (see trust.ts)
- We are NOT the legal employer — avoid payroll/tax/compliance features
- No Supabase anywhere
