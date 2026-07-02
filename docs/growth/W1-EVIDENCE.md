# Growth Engine — W1 Completion Evidence

Captured 2026-07-02 against the dev server (localhost:3000) and the live Neon dev DB.

## 1. Authz route-walk check (`npm run check:growth-authz`)

```
✅ Growth authz check passed: 8 route file(s), all handlers wrapped with withGrowthAuth.
```

Static CI gate: every `/api/admin/growth/*` route must export handlers as
`withGrowthAuth(permission, handler)`; cron routes under `growth/jobs/*` must use
`isAuthorizedCronRequest`. An unwrapped route fails the script (exit 1).

## 2. End-to-end smoke test (`node scripts/smoke-growth.mjs <admin-id>`)

Signs a real admin JWT (same claims/secret as production `signToken`) and walks the
full E1→E3 flow:

```
✓ no sub-role → sources 403: 403 (expected 403)
✓ bootstrap self-grant super_admin: 200 (expected 200)
✓ with super_admin → sources 200: 200 (expected 200)
✓ propose source 201: 201 (expected 201)
✓ approve high-risk as super_admin 200: 200 (expected 200)
✓ create observation 201: 201 (expected 201)
✓ duplicate observation 409: 409 (expected 409)
✓ analyst cannot approve sources 403: 403 (expected 403)
✓ analyst cannot read audit 403: 403 (expected 403)
✓ audit contains ROLE_GRANTED
✓ audit contains SOURCE_STATUS_CHANGED
✓ audit contains AUTHZ_DENIED
🧹 cleaned up test rows and revoked test sub-role

✅ smoke test passed
```

Additional boundary probes (curl, unauthenticated): `GET sources` 401 ·
`POST observations` 401 · `GET audit` 401 · cron purge without secret 401 ·
garbage bearer token 401 · `X-Robots-Tag: noindex, nofollow` present on
`/growth/*` · robots.txt disallows `/growth` and `/api/`.
Flag test: with `GROWTH_MODULE_ENABLED=false`, growth endpoints return
`503 {"error":"MODULE_DISABLED"}` while non-growth admin APIs are unaffected (401).

## 3. Migration script used

`app/scripts/migrate-growth.mjs` — additive-only DDL (`IF NOT EXISTS`), applied
2026-07-02, all 23 statements ✓ (1 ALTER + 12 CREATE TABLE + 10 indexes).
`drizzle-kit push` was **not** used — see the drift finding in
[W1-HANDOFF.md](W1-HANDOFF.md) and CLAUDE.md "Migration Safety Policy".

## 4. Test-data cleanup confirmation

Post-smoke DB check:

```
cleanup check — TEST channels: 0 | source_jobs rows: 0 | users with sub-role: 0
```

The smoke test deletes its channel + observation rows and revokes the granted
sub-role. Audit rows from the run remain by design (append-only log).
