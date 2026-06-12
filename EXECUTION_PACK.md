# Joby / ShiftMatch — Execution Pack v1.0

> Derived from MVP Specification v1.2. No new scope introduced.

---

## 1. Build Order

### Workstreams (dependency-ordered)

| # | Workstream | Purpose | Dependencies | Deliverables | Blocking Risks |
|---|---|---|---|---|---|
| WS-1 | Project Scaffold | Next.js 14, Supabase client, Tailwind RTL, shadcn/ui, i18n, env config | None | Running dev server, RTL layout shell, theme, Hebrew string system | Supabase project creation, env vars |
| WS-2 | DB Schema & Migrations | All tables, indexes, constraints | WS-1 | Complete DB schema deployed to Supabase | Migration order correctness |
| WS-3 | Auth & Users | OTP auth, registration, role-based profiles, session middleware | WS-1, WS-2 | Login/register flows for all 3 roles, auth middleware | SMS provider for OTP |
| WS-4 | Shift CRUD & Feed | Create, edit, publish, cancel shifts; worker shift feed with filters | WS-3 | E3, E4, W2, W3 screens; shift API routes | — |
| WS-5 | Applications Core | Apply, approve (active/backup), reject, cancel; overlap check; slots_filled logic | WS-4 | E5, W3 apply, W4 my-shifts; application API routes | slots_filled transactional safety |
| WS-6 | Attendance & Check-in | Confirmation crons, QR generation/scan, manual check-in/out, live view | WS-5 | E6, E7, W5, W6 screens; checkin API routes; 3 cron jobs | QR scanner library compatibility |
| WS-7 | Trust Engine | Trust formula, recalculation, thresholds, first-3 protection | WS-5, WS-6 | Trust score display, recalc triggers, min-trust enforcement | — |
| WS-8 | SOS & Backup | SOS broadcast, auto-approve, backup promotion, eligible worker query | WS-5, WS-7 | SOS flow, backup UI sections, promote endpoint | — |
| WS-9 | Ratings | Post-shift rating, trust recalc on rate | WS-6 | E8 screen, rate endpoint, RATED transition | — |
| WS-10 | Incidents & Admin | Incidents CRUD, auto-creation, admin overrides, suspend, action log | WS-7 | A1-A5 screens, admin API routes, incident crons | — |
| WS-11 | Notifications | In-app notification table, polling, SMS integration | WS-3 | W8 screen, notification API, SMS adapter | SMS provider decision |
| WS-12 | Polish & Seed | RTL pass, Hebrew review, seed data, E2E tests, deploy | All | Production deployment, demo-ready seed data | — |

---

## 2. Sprint Plan

### Sprint 1 — Foundation (Week 1, Days 1-3)

**Goal:** Running app shell with DB, auth, and RTL layout.

| Area | Scope |
|---|---|
| DB | Migration 001-003: users, employer_profiles, worker_profiles |
| Infra | Next.js 14 project init, Supabase client setup, Tailwind with RTL, shadcn/ui install, env config, i18n (Hebrew strings file) |
| API | `/api/auth/send-otp`, `/api/auth/verify-otp`, `/api/auth/register`, `/api/auth/me` |
| UI | Login page, register page (employer + worker variants), RTL layout shell (sidebar/nav), role-based routing |
| QA | Auth flow works end-to-end (OTP → JWT → session); RTL layout renders correctly on 375px viewport |

**Files created:** `/lib/db.ts`, `/lib/auth.ts`, `/lib/types.ts`, `/lib/constants.ts`, `/lib/validators.ts`, `/app/(auth)/*`, `/components/layout/*`, `/components/ui/*`, i18n strings file

**Done:** User can register as employer or worker via phone OTP, land on role-appropriate empty dashboard.

---

### Sprint 2 — Shifts CRUD & Feed (Week 1 Day 4 — Week 2 Day 2)

**Goal:** Employers create/publish shifts. Workers browse and see them.

| Area | Scope |
|---|---|
| DB | Migration 004: shifts table |
| API | `POST /api/shifts`, `PATCH /api/shifts/:id`, `GET /api/shifts`, `GET /api/shifts/:id`, `PATCH /api/shifts/:id/status`, `GET /api/shifts/employer/dashboard` |
| UI | E3 (shift list), E4 (create/edit shift), E2 (dashboard — basic), W2 (shift feed with filters), W3 (shift detail) |
| Logic | Shift status transitions (DRAFT→PUBLISHED→CANCELLED), cancel side effects (bulk-cancel placeholder — no applications yet) |
| QA | Create shift, publish, see in worker feed, edit draft, cancel published |

**Files created:** `/api/shifts/*`, `/app/(employer)/shifts/*`, `/app/(employer)/dashboard/*`, `/app/(worker)/shifts/*`, `/components/shifts/*`

**Done:** Employer creates and publishes shifts. Worker browses published shifts filtered by role/date/distance.

---

### Sprint 3 — Applications Core (Week 2 Day 3 — Week 3 Day 1)

**Goal:** Workers apply. Employers approve/reject. slots_filled works.

| Area | Scope |
|---|---|
| DB | Migration 005: applications table |
| API | `POST /api/shifts/:id/apply`, `GET /api/shifts/:id/applications`, `PATCH /api/applications/:id/status`, `POST /api/applications/:id/cancel`, `GET /api/worker/applications` |
| UI | W3 (apply button), E5 (applicant list, approve/reject buttons, approve-as-backup), W4 (my shifts tabs), W5 (shift card with status/cancel) |
| Logic | `/lib/overlap.ts` (time overlap check), `/lib/slots.ts` (slots_filled increment/decrement), approve guards (§8.3.1), trust-score application gate |
| QA | Apply, approve active, approve backup, reject, cancel by worker, overlap blocking, slots_filled correctness |

**Files created:** `/api/applications/*`, `/api/shifts/[id]/apply/*`, `/api/worker/applications/*`, `/app/(worker)/my-shifts/*`, `/lib/overlap.ts`, `/lib/slots.ts`, `/components/applications/*`

**Done:** Full apply→approve/reject cycle works. slots_filled tracks correctly. Overlapping applications blocked.

---

### Sprint 4 — Attendance & QR Check-in (Week 3 Day 2 — Week 4 Day 1)

**Goal:** Confirmation flow, QR check-in/out, manual override, live view.

| Area | Scope |
|---|---|
| DB | Migration 006: checkin_events table (with source, scanned_by_user_id) |
| API | `POST /api/applications/:id/confirm`, `GET /api/shifts/:id/qr`, `POST /api/checkin/scan`, `POST /api/applications/:id/manual-checkin`, `POST /api/applications/:id/manual-checkout`, `GET /api/shifts/:id/attendance` |
| UI | W5 (confirm button), W6 (QR scanner), E7 (QR display with CHECK_IN/CHECK_OUT toggle), E6 (live attendance view, manual check-in/out buttons) |
| Logic | `/lib/qr.ts` (HMAC token gen/validate), scan validation per §8.4.1, confirmation window logic |
| Cron | `requestConfirmations`, `flagUnconfirmed`, `cancelUnconfirmedAtStart` |
| QA | Confirm attendance, scan QR in/out, manual check-in/out, crons produce correct transitions, checkin_events have correct source/scanned_by |

**Files created:** `/api/checkin/*`, `/api/applications/[id]/confirm/*`, `/api/applications/[id]/manual-checkin/*`, `/api/applications/[id]/manual-checkout/*`, `/api/shifts/[id]/qr/*`, `/api/shifts/[id]/attendance/*`, `/api/cron/request-confirmations/*`, `/api/cron/flag-unconfirmed/*`, `/api/cron/cancel-unconfirmed-at-start/*`, `/app/(worker)/scan/*`, `/app/(employer)/shifts/[id]/live/*`, `/app/(employer)/shifts/[id]/qr/*`, `/lib/qr.ts`, `/components/qr/*`

**Done:** Full attendance cycle works: confirm → QR check-in → QR check-out. Manual overrides work. Crons transition unconfirmed workers correctly.

---

### Sprint 5 — Trust Engine & NO_SHOW (Week 4 Day 2 — Week 4 Day 5)

**Goal:** Trust scores calculated and enforced. NO_SHOW detection works.

| Area | Scope |
|---|---|
| API | Trust score is internal; no new public routes. Enforcement in existing apply endpoint |
| Logic | `/lib/trust.ts` (recalcTrustScore with §9.2 queries, first-3-shifts protection, threshold checks) |
| Cron | `flagNoShows`, `autoCompleteShifts` |
| UI | Trust score badge on worker cards (E5, E9, W7), min_trust_score field on E4 |
| QA | NO_SHOW flags correctly from APPROVED/CONFIRMED only, trust recalcs on NO_SHOW/cancel/rate, first-3-shifts floor works, min_trust blocks apply |

**Files created:** `/lib/trust.ts`, `/api/cron/flag-noshows/*`, `/api/cron/auto-complete/*`, `/components/trust/*`

**Done:** Trust scores update on events. Workers below min_trust_score blocked. NO_SHOW and auto-complete crons work.

---

### Sprint 6 — SOS, Backup Promotion & Ratings (Week 5 Day 1 — Week 5 Day 3)

**Goal:** SOS broadcast fills urgent slots. Backup workers promotable. Post-shift ratings.

| Area | Scope |
|---|---|
| DB | Migration 007: sos_broadcasts table, ratings table |
| API | `POST /api/shifts/:id/sos`, `POST /api/applications/:id/promote-backup`, `POST /api/applications/:id/rate`, `GET /api/workers/:id/ratings`, `GET /api/workers/:id` |
| Cron | `expireSOS` |
| UI | E6 (SOS button, backup section with promote), W2 (SOS badge), E8 (rate workers), E9 (worker profile with ratings), W7 (trust score display) |
| Logic | `getEligibleWorkers` query, SOS auto-approve, backup promotion (is_backup flip + slots_filled), rating → trust recalc |
| QA | SOS broadcasts to eligible workers, auto-approve fills slots, backup promotion works, ratings update trust |

**Files created:** `/api/shifts/[id]/sos/*`, `/api/applications/[id]/promote-backup/*`, `/api/applications/[id]/rate/*`, `/api/workers/[id]/*`, `/api/cron/expire-sos/*`, `/app/(employer)/shifts/[id]/rate/*`, `/app/(employer)/workers/[id]/*`

**Done:** SOS → auto-approve → fill cycle works. Backup promotion works. Ratings submitted and trust recalculated.

---

### Sprint 7 — Admin & Incidents (Week 5 Day 4 — Week 6 Day 2)

**Goal:** Admin can see incidents, override statuses, suspend users, manage trust.

| Area | Scope |
|---|---|
| DB | Migration 008: incidents table, admin_actions table |
| API | All `/api/admin/*` routes (incidents CRUD, assign, resolve, user suspend, trust override, application/shift override, action log) |
| Cron | `autoCreateLowTrustIncidents` |
| UI | A1 (incidents dashboard), A2 (user management), A3 (shift override), A4 (trust editor), A5 (action log) |
| Logic | `/lib/incidents.ts` (auto-creation helpers), admin action logging on every write |
| QA | Auto-created incidents appear for NO_SHOW/LOW_TRUST/SHIFT_UNFILLED, admin can assign/resolve/dismiss, overrides bypass transition rules, all actions logged |

**Files created:** `/api/admin/*`, `/app/(admin)/*`, `/api/cron/low-trust-incidents/*`, `/lib/incidents.ts`, `/components/admin/*`, `/components/incidents/*`

**Done:** Admin has full intervention capability. Incidents auto-created and manageable. Action log captures everything.

---

### Sprint 8 — Notifications, Polish, Seed & Deploy (Week 6 Day 3 — Week 8)

**Goal:** Notifications work. RTL polished. Seed data ready. Production deployed.

| Area | Scope |
|---|---|
| DB | Migration 009: notifications table |
| API | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, SMS adapter integration |
| UI | W8 (notifications screen), notification badge in nav, RTL polish pass on all screens, Hebrew string review, viewport testing (320-428px) |
| Logic | `/lib/notifications.ts` (create + send), `/lib/sms.ts` (SMS adapter), wire all existing notification creation points |
| Infra | Vercel deployment config, Supabase production project, cron schedule config, domain setup |
| Seed | Seed script per §9 of this doc |
| QA | Full E2E test suite for high-risk flows, RTL rendering on mobile viewports, SMS delivery for OTP |

**Files created:** `/api/notifications/*`, `/app/(worker)/notifications/*`, `/lib/notifications.ts`, `/lib/sms.ts`, seed script, E2E test files

**Done:** App deployed to production. Demo-ready with seed data. All high-risk flows pass E2E. Hebrew RTL correct across screens.

---

## 3. Engineering Task Breakdown

### WS-1: Project Scaffold

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-001 | Init Next.js 14 project | Infra | — | Create Next.js 14 App Router project with TypeScript strict mode | `npm run dev` serves blank page |
| ENG-002 | Configure Tailwind RTL | Infra | ENG-001 | Install Tailwind, configure `dir="rtl"` on root layout, add RTL utilities | Root layout renders right-to-left |
| ENG-003 | Install shadcn/ui | Infra | ENG-002 | Init shadcn/ui with default theme, install Button, Input, Card, Dialog, Select, Table, Badge, Toast | Components importable and render in RTL |
| ENG-004 | Supabase client setup | Infra | ENG-001 | Create `/lib/db.ts` with server + client Supabase clients, env vars for URL + anon key + service role key | `supabase.from('users').select()` connects |
| ENG-005 | Create type definitions | Logic | ENG-001 | Create `/lib/types.ts` with all TypeScript interfaces matching DB schema + API request/response types | Types compile without errors |
| ENG-006 | Create constants file | Logic | ENG-001 | Create `/lib/constants.ts` with all status enums (ShiftStatus, ApplicationStatus, IncidentType, etc.), config values (grace periods, thresholds) | Single source of truth for all statuses |
| ENG-007 | Create validators | Logic | ENG-005 | Create `/lib/validators.ts` with Zod schemas for all API request payloads | Validators importable and enforce shape |
| ENG-008 | i18n setup | Infra | ENG-001 | Create Hebrew strings file (`/lib/i18n/he.ts`), string lookup helper, error message map | `t('shift.created')` returns Hebrew string |
| ENG-009 | RTL layout shell | UI | ENG-002, ENG-003 | Create `/components/layout/` with: RootLayout (RTL, Hebrew font), WorkerLayout (bottom nav), EmployerLayout (sidebar), AdminLayout (sidebar) | All 3 role layouts render with RTL nav |

### WS-2: DB Schema & Migrations

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-010 | Migration 001: users table | DB | ENG-004 | Create users table with role CHECK, phone UNIQUE, is_active | Table exists, insert/select works |
| ENG-011 | Migration 002: employer_profiles | DB | ENG-010 | Create employer_profiles with user_id FK UNIQUE | Table exists with FK constraint |
| ENG-012 | Migration 003: worker_profiles | DB | ENG-010 | Create worker_profiles with trust_score CHECK (0-5), user_id FK UNIQUE | Table exists with CHECK constraint |
| ENG-013 | Migration 004: shifts | DB | ENG-011 | Create shifts table with end_time > start_time CHECK, slots_total >= 1, slots_filled >= 0, status/sos_status CHECKs | All constraints enforced |
| ENG-014 | Migration 005: applications | DB | ENG-012, ENG-013 | Create applications with status CHECK, UNIQUE(shift_id, worker_id) | Unique constraint blocks duplicate |
| ENG-015 | Migration 006: checkin_events | DB | ENG-014 | Create checkin_events with source CHECK ('QR','MANUAL'), scanned_by_user_id FK | source field defaults to 'QR' |
| ENG-016 | Migration 007: ratings, sos_broadcasts | DB | ENG-014, ENG-011 | Create ratings (score 1-5 CHECK, application_id UNIQUE) and sos_broadcasts | Both tables exist with constraints |
| ENG-017 | Migration 008: incidents, admin_actions | DB | ENG-010 | Create incidents (type/severity/status CHECKs), admin_actions | Incident types enforced by CHECK |
| ENG-018 | Migration 009: notifications | DB | ENG-010 | Create notifications with channel CHECK | Table exists |
| ENG-019 | Create all indexes | DB | ENG-010–ENG-018 | Add all indexes from spec §6 | Indexes visible in Supabase dashboard |

### WS-3: Auth & Users

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-020 | Auth middleware | Logic | ENG-004 | Create `/lib/auth.ts`: extractUser from JWT, requireRole middleware, requireAuth wrapper | Middleware rejects unauthenticated/wrong-role requests |
| ENG-021 | POST /api/auth/send-otp | API | ENG-010, ENG-020 | Send OTP to phone via SMS adapter (stub for now). Rate limit 3/hour/phone | OTP sent, rate limit enforced |
| ENG-022 | POST /api/auth/verify-otp | API | ENG-021 | Verify OTP, create Supabase session, return JWT | Valid OTP → JWT; invalid → 401 |
| ENG-023 | POST /api/auth/register | API | ENG-022 | Create user + role-specific profile. Validate required fields with Zod | User + profile rows created |
| ENG-024 | GET /api/auth/me | API | ENG-020 | Return current user + profile (employer or worker) | Returns correct role-specific profile |
| ENG-025 | Login page UI | UI | ENG-021, ENG-022, ENG-009 | Phone input + OTP entry, Hebrew labels, RTL | User can log in via OTP |
| ENG-026 | Register page UI | UI | ENG-023, ENG-009 | Role selection, then role-specific form (employer: business name/type/address; worker: name/city/tags) | Registration creates correct profile type |

### WS-4: Shift CRUD & Feed

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-027 | POST /api/shifts | API | ENG-020, ENG-013 | Create shift. Validate with Zod. Default DRAFT unless publish=true. Generate qr_code_secret on publish | Shift row created with correct status |
| ENG-028 | PATCH /api/shifts/:id | API | ENG-027 | Update shift. Guard: only DRAFT, or PUBLISHED with zero APPROVED applications. 409 if APPROVED exist | Edit blocked correctly |
| ENG-029 | GET /api/shifts | API | ENG-013 | List shifts. Query params: status, role_tag, date_from, date_to, employer_id, lat/lng/radius. Paginated | Filtered results returned |
| ENG-030 | GET /api/shifts/:id | API | ENG-013 | Single shift detail with employer profile joined | Full shift data returned |
| ENG-031 | PATCH /api/shifts/:id/status | API | ENG-027 | Status changes: publish (DRAFT→PUBLISHED), cancel (DRAFT/PUBLISHED→CANCELLED). Cancel triggers bulk-cancel side effects per §5.1.1. 403 for IN_PROGRESS cancel | Correct transitions, bulk-cancel works |
| ENG-032 | GET /api/shifts/employer/dashboard | API | ENG-029 | Aggregated data: today's shifts, fill rates, upcoming shifts, alert counts | Dashboard data shape correct |
| ENG-033 | E4: Create/Edit Shift UI | UI | ENG-027, ENG-028 | Form with all fields, publish toggle, min_trust_score, Hebrew validation errors | Shift created/edited via form |
| ENG-034 | E3: Shift List UI | UI | ENG-029 | Filterable table/list of employer's shifts with status badges | Shifts listed with filters |
| ENG-035 | E2: Dashboard UI | UI | ENG-032 | Dashboard cards: today's shifts, fill rate, upcoming, alerts | Dashboard renders with data |
| ENG-036 | W2: Shift Feed UI | UI | ENG-029 | Mobile list with filters (role, date, distance), SOS badge, pay display (₪/שעה) | Worker sees published shifts |
| ENG-037 | W3: Shift Detail UI | UI | ENG-030 | Full shift info, map placeholder, employer name, Apply button (disabled if already applied or ineligible) | Detail page renders correctly |

### WS-5: Applications Core

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-038 | Create /lib/overlap.ts | Logic | ENG-005 | Query for non-terminal applications with overlapping shift times for a worker. Return conflicting shift_id if found | Overlap detected and returned |
| ENG-039 | Create /lib/slots.ts | Logic | ENG-005 | Functions: incrementSlotsFilled(shiftId), decrementSlotsFilled(shiftId). Transactional: read current → check bounds → update. Export countActiveSlotsFilled(shiftId) for verification | slots_filled changes atomically |
| ENG-040 | POST /api/shifts/:id/apply | API | ENG-038, ENG-039 | Worker applies. Guards: shift PUBLISHED, no overlap, trust ≥ min, is_active, no existing application. Creates PENDING application | Application created or correct error |
| ENG-041 | GET /api/shifts/:id/applications | API | ENG-014 | List applications for shift. Include worker profile + trust_score. Separate active vs backup in response | Applicant list with trust scores |
| ENG-042 | PATCH /api/applications/:id/status | API | ENG-039 | Approve active (slots check), approve backup (no slots check), reject. Payloads per §8.3.1. On active approve: increment slots_filled, set approved_at | Correct transitions and slots_filled |
| ENG-043 | POST /api/applications/:id/cancel | API | ENG-039 | Worker cancels. Guard: status in APPROVED/CONFIRMED, before shift end. Decrement slots_filled. Set cancelled_at. Trigger trust recalc | Status → CANCELLED_BY_WORKER, slots decremented |
| ENG-044 | GET /api/worker/applications | API | ENG-014 | Worker's application history. Query: status filter. Join shift details | Worker sees their applications |
| ENG-045 | E5: Shift Detail (employer) UI | UI | ENG-041, ENG-042 | Applicant list with trust badges, approve/reject/approve-backup buttons, backup section | Employer can manage applicants |
| ENG-046 | W3: Apply button integration | UI | ENG-040 | Wire Apply button to POST endpoint. Show loading, success, error states in Hebrew | One-tap apply works |
| ENG-047 | W4: My Shifts UI | UI | ENG-044 | Tabs: Upcoming (APPROVED/CONFIRMED), History (CHECKED_OUT/RATED/NO_SHOW), Pending (PENDING) | Worker sees categorized applications |
| ENG-048 | W5: Shift Card UI | UI | ENG-043 | Status badge, confirm button (Sprint 4), cancel button, QR scan button (Sprint 4) | Card shows correct status and actions |
| ENG-049 | Shift cancel bulk-cancel integration | Logic | ENG-031, ENG-039 | Wire shift cancel to bulk-update all non-terminal applications → CANCELLED_BY_SYSTEM. Set slots_filled = 0. Create notifications per worker | All applications cancelled on shift cancel |

### WS-6: Attendance & Check-in

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-050 | Create /lib/qr.ts | Logic | ENG-006 | Functions: generateQRToken(shiftId, checkMode, secret), validateQRToken(token, secret). HMAC-SHA256. Token format: `{shift_id}:{check_mode}:{timestamp}:{hmac}` | Token generates and validates correctly |
| ENG-051 | POST /api/applications/:id/confirm | API | ENG-042 | Worker confirms. Guard: status = APPROVED, non-backup, within confirmation window. Set confirmed_at, status → CONFIRMED | Status changes, confirmed_at set |
| ENG-052 | GET /api/shifts/:id/qr | API | ENG-050 | Generate QR payload for shift. Query param: mode (CHECK_IN or CHECK_OUT). Returns token string | Valid HMAC token returned |
| ENG-053 | POST /api/checkin/scan | API | ENG-050, ENG-015 | Full validation per §8.4.1. Create checkin_event with source='QR', scanned_by_user_id=worker. Update application status + timestamps | Correct transitions, event created |
| ENG-054 | POST /api/applications/:id/manual-checkin | API | ENG-015, ENG-020 | Employer/admin manual check-in per §8.4.2. Create checkin_event source='MANUAL', scanned_by=caller | Status → CHECKED_IN, event with MANUAL source |
| ENG-055 | POST /api/applications/:id/manual-checkout | API | ENG-015, ENG-020 | Employer/admin manual checkout per §8.4.3. Create checkin_event source='MANUAL' | Status → CHECKED_OUT, event with MANUAL source |
| ENG-056 | GET /api/shifts/:id/attendance | API | ENG-041 | Live attendance data: applications with check-in status, timestamps. Supabase Realtime subscription setup | Attendance data returned with statuses |
| ENG-057 | Cron: requestConfirmations | Logic | ENG-051 | Query shifts starting within confirmation_window_hours. For APPROVED non-backup workers without existing confirmation notification: create notification | Notifications created for eligible workers |
| ENG-058 | Cron: flagUnconfirmed | Logic | ENG-039 | For shifts starting ≤ 2h: APPROVED non-backup with confirmed_at NULL → UNCONFIRMED. Decrement slots_filled each | Status changes, slots decremented |
| ENG-059 | Cron: cancelUnconfirmedAtStart | Logic | — | For IN_PROGRESS shifts: UNCONFIRMED → CANCELLED_BY_SYSTEM. No slots_filled change | UNCONFIRMED cleared at shift start |
| ENG-060 | W5: Confirm button | UI | ENG-051 | Wire confirm button on shift card | One-tap confirm works |
| ENG-061 | W6: QR Scanner UI | UI | ENG-053 | Camera scanner using html5-qrcode. Display success/error in Hebrew | Worker scans QR, sees result |
| ENG-062 | E7: QR Display UI | UI | ENG-052 | Full-screen QR code. Toggle between CHECK_IN/CHECK_OUT modes | Large QR renders, mode toggles |
| ENG-063 | E6: Live Shift View UI | UI | ENG-056, ENG-054, ENG-055 | Real-time attendance list. Manual check-in/out buttons per worker. SOS button. Backup section with promote. Supabase Realtime subscription | Live view updates, manual overrides work |

### WS-7: Trust Engine

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-064 | Create /lib/trust.ts | Logic | ENG-005, ENG-006 | `recalcTrustScore(workerId)`: query no_show_rate, late_cancel_rate, late_checkin_rate, avg_employer_rating per §9.2. Apply formula. Apply first-3-shifts protection (floor 4.0 if <3 completed). Update worker_profiles.trust_score | Score calculated correctly per formula |
| ENG-065 | Wire trust recalc to NO_SHOW | Logic | ENG-064 | Call recalcTrustScore after flagNoShows cron sets NO_SHOW | Trust updates after NO_SHOW |
| ENG-066 | Wire trust recalc to cancel | Logic | ENG-064, ENG-043 | Call recalcTrustScore in worker cancel endpoint | Trust updates after cancellation |
| ENG-067 | Wire trust recalc to rate | Logic | ENG-064 | Call recalcTrustScore after rating submitted | Trust updates after rating |
| ENG-068 | Trust score badge component | UI | ENG-064 | Reusable badge showing trust score (color-coded: green ≥ 4, yellow ≥ 3, red < 3) | Badge renders with correct color |
| ENG-069 | min_trust_score enforcement | Logic | ENG-040 | In apply endpoint: reject if worker.trust_score < shift.min_trust_score (403) | Low-trust workers blocked |
| ENG-070 | Cron: flagNoShows | Logic | ENG-064, ENG-039 | For IN_PROGRESS shifts past start + grace: APPROVED/CONFIRMED non-backup with no check-in → NO_SHOW. Decrement slots_filled. Create NO_SHOW incident. Recalc trust | NO_SHOW correctly flagged |
| ENG-071 | Cron: autoCompleteShifts | Logic | ENG-039, ENG-015 | For shifts past end + checkout_grace and IN_PROGRESS: auto-checkout CHECKED_IN workers (CHECKED_OUT, create checkin_event source='MANUAL', scanned_by=NULL). Shift → COMPLETED. Create SHIFT_UNFILLED incident if unfilled | Shifts auto-complete correctly |

### WS-8: SOS & Backup

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-072 | POST /api/shifts/:id/sos | API | ENG-064, ENG-016 | Create sos_broadcast. Query eligible workers (role match, distance, trust ≥ min, no existing app, active). Create notifications. If auto-approve: auto-create APPROVED applications up to remaining slots | SOS broadcast created, notifications enqueued |
| ENG-073 | POST /api/applications/:id/promote-backup | API | ENG-039 | Guard: is_backup = true, status = APPROVED, slots_filled < slots_total. Set is_backup = false, increment slots_filled, notify worker. If confirmation window open: create confirmation notification | Backup promoted, slots incremented |
| ENG-074 | Cron: expireSOS | Logic | — | Set sos_status = EXPIRED for shifts past start_time | SOS expires correctly |
| ENG-075 | SOS badge in W2 feed | UI | ENG-072 | Show urgency badge on shifts where sos_status = ACTIVE | Badge visible on SOS shifts |
| ENG-076 | Backup section in E5/E6 | UI | ENG-073 | Separate list of backup workers with "Promote" button | Promote button works |

### WS-9: Ratings

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-077 | POST /api/applications/:id/rate | API | ENG-016, ENG-067 | Create rating. Guard: application status = CHECKED_OUT, shift COMPLETED, employer owns shift. Set application status → RATED. Call recalcTrustScore | Rating created, status changes, trust recalced |
| ENG-078 | GET /api/workers/:id/ratings | API | ENG-016 | List ratings for worker, paginated | Ratings returned |
| ENG-079 | GET /api/workers/:id | API | ENG-012 | Worker profile with stats and trust score | Profile data returned |
| ENG-080 | E8: Rate Workers UI | UI | ENG-077 | Post-shift screen: list CHECKED_OUT workers, star rating + flag select + comment per worker | Employer can rate each worker |
| ENG-081 | E9: Worker Profile UI | UI | ENG-078, ENG-079 | Worker stats, trust score, rating history | Profile page renders |
| ENG-082 | W7: Worker Profile UI | UI | ENG-024 | Self-profile: name, photo, tags, trust score (read-only), shift stats | Worker sees own profile |

### WS-10: Incidents & Admin

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-083 | Create /lib/incidents.ts | Logic | ENG-017 | Helper functions: createIncident(type, severity, relatedIds), used by crons and endpoints | Incidents created with correct type/severity |
| ENG-084 | GET /api/admin/incidents | API | ENG-017 | List incidents. Query: status, type, severity. Paginated. Join related entities | Filtered incidents returned |
| ENG-085 | GET /api/admin/incidents/:id | API | ENG-017 | Single incident with full related data (user, shift, application details) | Incident detail returned |
| ENG-086 | PATCH /api/admin/incidents/:id | API | ENG-017 | Update severity, status, resolution_notes | Incident updated |
| ENG-087 | POST /api/admin/incidents/:id/assign | API | ENG-017 | Set assigned_admin_id, status → IN_REVIEW | Incident assigned |
| ENG-088 | POST /api/admin/incidents/:id/resolve | API | ENG-017 | Set status RESOLVED or DISMISSED, resolution_notes, resolved_at. Log admin_action | Incident resolved, action logged |
| ENG-089 | POST /api/admin/incidents | API | ENG-017 | Admin manually creates incident | Incident created |
| ENG-090 | GET /api/admin/users | API | ENG-010 | List users. Query: role, is_active, search (name/phone) | User list returned |
| ENG-091 | PATCH /api/admin/users/:id/suspend | API | ENG-010 | Toggle is_active. Log admin_action | User suspended/unsuspended |
| ENG-092 | PATCH /api/admin/users/:id/trust | API | ENG-012 | Set trust_score directly. Log admin_action. No formula recalc | Trust score overridden |
| ENG-093 | PATCH /api/admin/applications/:id/override | API | ENG-014, ENG-039 | Override application status (bypass transition rules). Adjust slots_filled if needed. Log admin_action | Status overridden, action logged |
| ENG-094 | PATCH /api/admin/shifts/:id/override | API | ENG-013 | Override shift status (including ending IN_PROGRESS). Log admin_action | Status overridden, action logged |
| ENG-095 | GET /api/admin/actions | API | ENG-017 | Paginated action log. Query: admin_id, target_type, date range | Log entries returned |
| ENG-096 | Cron: autoCreateLowTrustIncidents | Logic | ENG-083 | Workers with trust < 1.5 and no OPEN/IN_REVIEW LOW_TRUST incident → create incident | Incidents created for low-trust workers |
| ENG-097 | A1: Incidents Dashboard UI | UI | ENG-084–ENG-089 | Filterable incident list, assign/resolve actions, detail panel | Admin manages incidents |
| ENG-098 | A2: User Management UI | UI | ENG-090, ENG-091 | User table with search, suspend toggle | Admin manages users |
| ENG-099 | A3: Shift Override UI | UI | ENG-094, ENG-093 | Shift detail with override controls | Admin overrides statuses |
| ENG-100 | A4: Trust Editor UI | UI | ENG-092, ENG-079 | Worker profile with editable trust score, audit trail | Admin adjusts trust |
| ENG-101 | A5: Action Log UI | UI | ENG-095 | Searchable, filterable log table | Admin reviews actions |

### WS-11: Notifications

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-102 | Create /lib/notifications.ts | Logic | ENG-018 | `sendNotification(userId, type, title, body, payload, channel)`. Insert into notifications table. If channel = 'sms': call SMS adapter | Notification row created |
| ENG-103 | Create /lib/sms.ts | Logic | — | SMS adapter: interface with send(phone, message). Stub implementation that logs. Production swap to chosen provider | Stub logs, interface ready |
| ENG-104 | GET /api/notifications | API | ENG-018 | Current user's notifications, paginated, newest first | Notifications returned |
| ENG-105 | PATCH /api/notifications/:id/read | API | ENG-018 | Mark notification as read. Guard: notification belongs to current user | is_read set to true |
| ENG-106 | W8: Notifications UI | UI | ENG-104, ENG-105 | Notification list with read/unread styling, mark-as-read on tap | Worker sees and reads notifications |
| ENG-107 | Notification badge in nav | UI | ENG-104 | Unread count badge in worker/employer nav | Badge shows count |
| ENG-108 | Wire all notification triggers | Logic | ENG-102 | Connect sendNotification calls to: approval, rejection, confirmation request, SOS, backup promotion, shift cancel, NO_SHOW, trust low | All events produce notifications |

### WS-12: Polish & Seed

| ID | Title | Type | Depends | Description | Acceptance Output |
|---|---|---|---|---|---|
| ENG-109 | RTL polish pass | UI | All UI tasks | Review all screens on 375px viewport. Fix alignment, overflow, input direction, date display | No horizontal overflow, correct alignment |
| ENG-110 | Hebrew string review | UI | ENG-008 | Verify all user-facing strings are Hebrew, consistent, no English leaks in worker/employer UI | All strings Hebrew |
| ENG-111 | Seed data script | DB | All | Script per §9 of this doc. Creates demo users, shifts, applications in various statuses | Seed runs without error |
| ENG-112 | E2E test suite | QA | All | Tests for high-risk flows per §8 of this doc | All tests pass |
| ENG-113 | Vercel deployment config | Infra | All | vercel.json, env vars, cron config, production Supabase | App deploys and runs on Vercel |
| ENG-114 | Error handling pass | Logic | All | Global error boundary, API error standardization, Hebrew error messages | Errors return consistent shape |

---

## 4. File-by-File Implementation Map

### /lib core modules

| File | Purpose | Key Exports | Inputs | Outputs | Dependencies |
|---|---|---|---|---|---|
| `/lib/db.ts` | Supabase client factory | `supabaseServer()`, `supabaseClient()` | Env vars | Typed Supabase client | `@supabase/supabase-js` |
| `/lib/auth.ts` | Auth helpers | `extractUser(req)`, `requireAuth(req)`, `requireRole(req, role)` | Request object | User object or 401/403 | `/lib/db.ts` |
| `/lib/types.ts` | TypeScript types | All DB row types, API request/response types, enums | — | Types | — |
| `/lib/constants.ts` | Status enums, config | `ShiftStatus`, `ApplicationStatus`, `IncidentType`, `IncidentSeverity`, `CheckMode`, thresholds, grace periods | — | Constants | — |
| `/lib/validators.ts` | Zod schemas | `createShiftSchema`, `approveApplicationSchema`, `rateWorkerSchema`, etc. | — | Zod schemas | `zod` |
| `/lib/overlap.ts` | Shift overlap check | `checkOverlap(workerId, startTime, endTime): { conflicting: boolean, shiftId?: string }` | Worker ID, time range | Conflict result | `/lib/db.ts` |
| `/lib/slots.ts` | slots_filled mutations | `incrementSlotsFilled(shiftId)`, `decrementSlotsFilled(shiftId)`, `resetSlotsFilled(shiftId)`, `countActiveSlotsFilled(shiftId)` | Shift ID | Updated count | `/lib/db.ts` |
| `/lib/trust.ts` | Trust engine | `recalcTrustScore(workerId)`, `getCompletedShiftCount(workerId)` | Worker ID | Updated trust score | `/lib/db.ts`, `/lib/constants.ts` |
| `/lib/qr.ts` | QR token logic | `generateQRToken(shiftId, checkMode, secret)`, `validateQRToken(token, secret): { valid, shiftId, checkMode, error? }` | Token data | Token string / validation result | `crypto` |
| `/lib/notifications.ts` | Notification dispatch | `sendNotification(userId, type, title, body, payload, channel)` | Notification params | Created notification | `/lib/db.ts`, `/lib/sms.ts` |
| `/lib/sms.ts` | SMS adapter | `sendSMS(phone, message): Promise<{ success, messageId? }>` | Phone, message | Send result | SMS provider SDK |
| `/lib/incidents.ts` | Incident creation | `createIncident(type, severity, title, relatedIds)`, `hasOpenIncident(userId, type): boolean` | Incident params | Created incident | `/lib/db.ts` |
| `/lib/i18n/he.ts` | Hebrew strings | `t(key): string`, keyed string map | String key | Hebrew text | — |

### /api route files (key routes only)

| Route file | Key handler logic | Side effects |
|---|---|---|
| `/api/shifts/route.ts` | POST: validate → create shift → generate qr_secret if publishing. GET: filter/paginate query | — |
| `/api/shifts/[id]/status/route.ts` | PATCH: validate transition → if cancel: bulk-cancel applications, reset slots, create notifications, create SHIFT_UNFILLED incident if workers affected | Notifications, slots, incidents |
| `/api/shifts/[id]/apply/route.ts` | POST: check overlap → check trust → check slots → create PENDING application | — |
| `/api/applications/[id]/status/route.ts` | PATCH: validate payload per §8.3.1 → approve/reject → slots_filled if active approve | slots_filled, notification |
| `/api/applications/[id]/confirm/route.ts` | POST: guard status/window → CONFIRMED, set confirmed_at | — |
| `/api/applications/[id]/cancel/route.ts` | POST: guard status → CANCELLED_BY_WORKER → decrement slots → recalcTrust | slots_filled, trust |
| `/api/applications/[id]/promote-backup/route.ts` | POST: guard backup + slots → flip is_backup → increment slots → notify → send confirmation if window open | slots_filled, notification |
| `/api/checkin/scan/route.ts` | POST: validate HMAC → lookup app → validate status + window → update status + timestamps → create checkin_event(source=QR) | checkin_event, application status |
| `/api/applications/[id]/manual-checkin/route.ts` | POST: guard employer/admin auth → validate status + window → CHECKED_IN → checkin_event(source=MANUAL, scanned_by=caller) | checkin_event, application status |
| `/api/applications/[id]/rate/route.ts` | POST: guard CHECKED_OUT + COMPLETED → create rating → RATED → recalcTrust | rating, trust |
| `/api/shifts/[id]/sos/route.ts` | POST: query eligible workers → create sos_broadcast → notifications → auto-approve if enabled | sos_broadcast, notifications, applications |
| `/api/admin/applications/[id]/override/route.ts` | PATCH: any status change (bypass rules) → adjust slots_filled if needed → log admin_action | slots_filled, admin_action |

---

## 5. Data/Logic Ownership Map

| Rule / Logic | Source of Truth | Module/Function Owner | When Invoked |
|---|---|---|---|
| Application status transitions | §5.2.1 transition table | Each API route handler validates `from` status before applying `to` status. Constants in `/lib/constants.ts` | Every application status change |
| slots_filled mutations | `/lib/slots.ts` | `incrementSlotsFilled`, `decrementSlotsFilled`, `resetSlotsFilled` | On approve (active), promote, cancel, UNCONFIRMED, NO_SHOW, shift cancel |
| Trust recalculation | `/lib/trust.ts` → `recalcTrustScore` | Derives from applications + ratings tables per §9.2 | After NO_SHOW, CANCELLED_BY_WORKER, RATED |
| QR token validation | `/lib/qr.ts` → `validateQRToken` | HMAC verification + token parsing | `POST /api/checkin/scan` |
| Overlap checking | `/lib/overlap.ts` → `checkOverlap` | Query non-terminal applications for time overlap | `POST /api/shifts/:id/apply` |
| Incident creation (auto) | `/lib/incidents.ts` → `createIncident` | Called by crons: flagNoShows, autoCompleteShifts, autoCreateLowTrustIncidents, shift cancel | Cron execution, shift cancel endpoint |
| Incident creation (manual) | `POST /api/admin/incidents` | Direct admin endpoint | Admin action |
| Authorization checks | `/lib/auth.ts` → `requireAuth`, `requireRole` | Wraps every API route handler | Every API request |
| Employer owns shift | Each route handler | Check `shift.employer_id = currentUser.employer_profile.id` | Shift mutation, application management, QR gen, manual check-in/out |
| Admin action logging | Each admin route handler | Insert into `admin_actions` after every admin write operation | Every admin mutation |
| Bulk-cancel on shift cancel | `/api/shifts/[id]/status/route.ts` | Inline in cancel handler: update all non-terminal apps, reset slots, create notifications | Shift cancel |
| Confirmation request dedup | `requestConfirmations` cron | Check existing notification with type=confirmation_request and matching application_id in payload | Cron execution |
| First-3-shifts protection | `/lib/trust.ts` | Query count of CHECKED_OUT/RATED applications → if < 3, floor score at 4.0 | During recalcTrustScore |

---

## 6. API Contract Checklist

### Auth

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/auth/send-otp` | POST | No | `{ phone: string }` | 200 `{ sent: true }` | 429 rate limit (3/hr/phone), 400 invalid phone | OTP created/sent |
| `/api/auth/verify-otp` | POST | No | `{ phone, otp }` | 200 `{ token, user }` | 401 invalid OTP, 400 missing fields | Session created |
| `/api/auth/register` | POST | Yes (JWT) | `{ full_name, role, ...profile_fields }` | 201 `{ user, profile }` | 400 validation, 409 profile exists | User + profile rows |
| `/api/auth/me` | GET | Yes | — | 200 `{ user, profile }` | 401 | — |

### Shifts

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/shifts` | POST | Employer | `{ title, role_tag, start_time, end_time, address, lat, lng, pay_rate, pay_type?, slots_total, min_trust_score?, publish?: bool }` | 201 `{ shift }` | 400 validation, 401, 403 | Shift row; qr_code_secret if published |
| `/api/shifts/:id` | PATCH | Employer (owner) | Partial shift fields | 200 `{ shift }` | 400, 403 not owner, 409 has APPROVED apps | Shift updated |
| `/api/shifts` | GET | Any | Query: `status, role_tag, date_from, date_to, employer_id, lat, lng, radius_km, page, limit` | 200 `{ shifts[], total, page }` | 400 | — |
| `/api/shifts/:id` | GET | Any | — | 200 `{ shift, employer }` | 404 | — |
| `/api/shifts/:id/status` | PATCH | Employer (owner) | `{ status: "PUBLISHED" | "CANCELLED" }` | 200 `{ shift }` | 403 IN_PROGRESS cancel, 400 invalid transition | Bulk-cancel apps if cancelling, notifications, incidents |
| `/api/shifts/:id/sos` | POST | Employer (owner) | `{ radius_km?, min_trust?, auto_approve?: bool }` | 201 `{ broadcast, notified_count }` | 400 already ACTIVE, 409 fully filled | sos_broadcast row, notifications, auto-approved apps |
| `/api/shifts/:id/qr` | GET | Employer (owner) | Query: `mode=CHECK_IN|CHECK_OUT` | 200 `{ token, qr_data_url }` | 403 | — |
| `/api/shifts/employer/dashboard` | GET | Employer | — | 200 `{ today_shifts, fill_rate, upcoming[], alert_count }` | 401 | — |

### Applications

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/shifts/:id/apply` | POST | Worker | `{}` | 201 `{ application }` | 403 trust/suspended, 409 overlap/exists, 400 shift not PUBLISHED | Application row |
| `/api/shifts/:id/applications` | GET | Employer (owner) | — | 200 `{ active[], backup[] }` | 403 | — |
| `/api/applications/:id/status` | PATCH | Employer (shift owner) | `{ status, is_backup? }` per §8.3.1 | 200 `{ application }` | 400 invalid payload, 409 slots full, 403 | slots_filled, notification |
| `/api/applications/:id/confirm` | POST | Worker (applicant) | `{}` | 200 `{ application }` | 400 wrong status, 403 backup/window | confirmed_at set |
| `/api/applications/:id/cancel` | POST | Worker (applicant) | `{ reason?: string }` | 200 `{ application }` | 400 wrong status | slots_filled -1, trust recalc, cancelled_at |
| `/api/applications/:id/promote-backup` | POST | Employer (shift owner) | `{}` | 200 `{ application }` | 400 not backup, 409 slots full | is_backup=false, slots +1, notification, confirmation if window open |
| `/api/applications/:id/rate` | POST | Employer (shift owner) | `{ score: 1-5, flag?, comment? }` | 201 `{ rating }` | 400 wrong status/not COMPLETED | Rating row, RATED status, trust recalc |
| `/api/worker/applications` | GET | Worker | Query: `status?, page, limit` | 200 `{ applications[], total }` | 401 | — |

### Check-in

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/checkin/scan` | POST | Worker | `{ token: string }` | 200 `{ event_type, application }` | 400 + error code (INVALID_QR, EXPIRED_QR, NOT_APPROVED_FOR_SHIFT, OUTSIDE_CHECKIN_WINDOW, OUTSIDE_CHECKOUT_WINDOW, ALREADY_CHECKED_IN, ALREADY_CHECKED_OUT, NOT_CHECKED_IN) | checkin_event(source=QR), application status |
| `/api/applications/:id/manual-checkin` | POST | Employer (owner) / Admin | `{}` | 200 `{ application }` | 400 wrong status, 403, 400 outside window | checkin_event(source=MANUAL, scanned_by=caller) |
| `/api/applications/:id/manual-checkout` | POST | Employer (owner) / Admin | `{}` | 200 `{ application }` | 400 not CHECKED_IN, 403, 400 outside window | checkin_event(source=MANUAL, scanned_by=caller) |
| `/api/shifts/:id/attendance` | GET | Employer (owner) / Admin | — | 200 `{ applications[], shift_status }` | 403 | — |

### Workers

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/workers/:id` | GET | Employer / Admin | — | 200 `{ worker_profile, user }` | 404 | — |
| `/api/workers/:id/ratings` | GET | Employer / Admin | Query: `page, limit` | 200 `{ ratings[], total }` | 404 | — |

### Notifications

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/notifications` | GET | Any auth'd | Query: `page, limit` | 200 `{ notifications[], unread_count, total }` | 401 | — |
| `/api/notifications/:id/read` | PATCH | Owner | `{}` | 200 `{ notification }` | 403 not owner | is_read = true |

### Admin

| Route | Method | Auth | Request | Success | Errors | Side Effects |
|---|---|---|---|---|---|---|
| `/api/admin/incidents` | GET | Admin | Query: `status, type, severity, page, limit` | 200 `{ incidents[], total }` | 403 | — |
| `/api/admin/incidents/:id` | GET | Admin | — | 200 `{ incident, related_user?, related_shift?, related_application? }` | 404 | — |
| `/api/admin/incidents/:id` | PATCH | Admin | `{ severity?, status?, resolution_notes? }` | 200 `{ incident }` | 400 | updated_at |
| `/api/admin/incidents/:id/assign` | POST | Admin | `{ admin_user_id }` | 200 `{ incident }` | 400 | assigned_admin_id, status=IN_REVIEW |
| `/api/admin/incidents/:id/resolve` | POST | Admin | `{ status: "RESOLVED"|"DISMISSED", resolution_notes }` | 200 `{ incident }` | 400 | resolved_at, admin_action |
| `/api/admin/incidents` | POST | Admin | `{ incident_type, severity, title, description?, related_user_id?, related_shift_id?, related_application_id? }` | 201 `{ incident }` | 400 | Incident row |
| `/api/admin/users` | GET | Admin | Query: `role, is_active, search, page, limit` | 200 `{ users[], total }` | 403 | — |
| `/api/admin/users/:id/suspend` | PATCH | Admin | `{ is_active: bool }` | 200 `{ user }` | 404 | admin_action |
| `/api/admin/users/:id/trust` | PATCH | Admin | `{ trust_score: number }` | 200 `{ worker_profile }` | 400 out of range, 404 | admin_action (no formula recalc) |
| `/api/admin/applications/:id/override` | PATCH | Admin | `{ status: ApplicationStatus }` | 200 `{ application }` | 400 | slots_filled adjusted, admin_action |
| `/api/admin/shifts/:id/override` | PATCH | Admin | `{ status: ShiftStatus }` | 200 `{ shift }` | 400 | admin_action |
| `/api/admin/actions` | GET | Admin | Query: `admin_id, target_type, date_from, date_to, page, limit` | 200 `{ actions[], total }` | 403 | — |

---

## 7. DB Migration Plan

### Migration sequence

| Order | Migration name | Tables / Objects | Dependencies | Rollback |
|---|---|---|---|---|
| 001 | `create_users` | `users` table + index | None | Drop table |
| 002 | `create_employer_profiles` | `employer_profiles` table | 001 (FK to users) | Drop table |
| 003 | `create_worker_profiles` | `worker_profiles` table (with trust_score CHECK) | 001 (FK to users) | Drop table |
| 004 | `create_shifts` | `shifts` table + all shift indexes (status, start, employer, role_tag, location) | 002 (FK to employer_profiles) | Drop table + indexes |
| 005 | `create_applications` | `applications` table + indexes (shift, worker, status) | 003, 004 (FKs) | Drop table + indexes |
| 006 | `create_checkin_events` | `checkin_events` table + application index | 001, 005 (FKs) | Drop table + index |
| 007 | `create_ratings_and_sos` | `ratings` table, `sos_broadcasts` table | 002, 003, 004, 005 (FKs) | Drop both tables |
| 008 | `create_incidents_and_admin_actions` | `incidents` table + indexes (status, type, shift, assigned), `admin_actions` table | 001, 004, 005 (FKs) | Drop both tables + indexes |
| 009 | `create_notifications` | `notifications` table + user index | 001 (FK) | Drop table + index |

### Seed requirements

Run after all migrations. See §9 for dataset.

### Rollback approach

Migrations are sequential. To roll back migration N, drop its tables/indexes, then rerun from N. Supabase migration CLI handles ordering. No data-destructive transforms in MVP migrations (all CREATE, no ALTER), so rollback is always safe DROP.

---

## 8. Test Plan

### Test layers

| Layer | Tool | Coverage target | Focus |
|---|---|---|---|
| Unit | Vitest | `/lib/*` modules | Trust formula, QR token gen/validate, overlap check, slots logic, validators |
| Integration | Vitest + Supabase test DB | API routes with real DB | State transitions, side effects, auth guards |
| API | Vitest + supertest (or fetch) | All routes | Request/response contracts, error cases, auth |
| E2E | Playwright | High-risk flows | Full browser flows on mobile viewport (375px) |

### High-risk flow test matrix

#### T-001: Worker applies to shift

| Item | Value |
|---|---|
| Preconditions | PUBLISHED shift exists, worker registered, trust ≥ min, no overlap, is_active |
| Action | POST `/api/shifts/:id/apply` |
| DB changes | applications row created (PENDING) |
| API result | 201, application object |
| Error cases | 409 overlap (return conflicting shift_id), 403 trust too low, 409 already applied, 400 shift not PUBLISHED, 403 suspended |

#### T-002: Employer approves active worker

| Item | Value |
|---|---|
| Preconditions | PENDING application exists, shift PUBLISHED, slots_filled < slots_total |
| Action | PATCH `/api/applications/:id/status` `{ status: "APPROVED", is_backup: false }` |
| DB changes | application.status = APPROVED, approved_at set, shift.slots_filled += 1 |
| API result | 200, updated application |
| Error cases | 409 slots full, 400 not PENDING |

#### T-003: Employer approves backup worker

| Item | Value |
|---|---|
| Preconditions | PENDING application exists, shift PUBLISHED |
| Action | PATCH `/api/applications/:id/status` `{ status: "APPROVED", is_backup: true }` |
| DB changes | application.status = APPROVED, is_backup = true, approved_at set, slots_filled unchanged |
| API result | 200, updated application |
| Error cases | 400 not PENDING |

#### T-004: Promote backup to active

| Item | Value |
|---|---|
| Preconditions | APPROVED application with is_backup = true, slots_filled < slots_total |
| Action | POST `/api/applications/:id/promote-backup` |
| DB changes | is_backup = false, slots_filled += 1, notification created |
| API result | 200, updated application |
| Error cases | 400 not backup, 409 slots full |

#### T-005: Worker confirms attendance

| Item | Value |
|---|---|
| Preconditions | APPROVED application, non-backup, shift starts within 12h but hasn't started |
| Action | POST `/api/applications/:id/confirm` |
| DB changes | status = CONFIRMED, confirmed_at set |
| API result | 200 |
| Error cases | 400 wrong status, 400 outside window, 400 is backup |

#### T-006: QR check-in

| Item | Value |
|---|---|
| Preconditions | CONFIRMED application, shift IN_PROGRESS or within 15min of start, valid QR token |
| Action | POST `/api/checkin/scan` with CHECK_IN token |
| DB changes | status = CHECKED_IN, checked_in_at set, checkin_event (source=QR, scanned_by=worker user_id) |
| API result | 200, event_type = CHECK_IN |
| Error cases | 400 INVALID_QR, 400 EXPIRED_QR, 400 NOT_APPROVED_FOR_SHIFT, 400 OUTSIDE_CHECKIN_WINDOW, 400 ALREADY_CHECKED_IN |

#### T-007: Manual check-in

| Item | Value |
|---|---|
| Preconditions | APPROVED or CONFIRMED application, employer owns shift |
| Action | POST `/api/applications/:id/manual-checkin` |
| DB changes | status = CHECKED_IN, checked_in_at, checkin_event (source=MANUAL, scanned_by=employer user_id) |
| API result | 200 |
| Error cases | 403 not shift owner/admin, 400 wrong status, 400 outside window |

#### T-008: UNCONFIRMED handling

| Item | Value |
|---|---|
| Preconditions | APPROVED non-backup worker, shift starts in ≤ 2h, confirmed_at IS NULL |
| Action | `flagUnconfirmed` cron runs |
| DB changes | status = UNCONFIRMED, slots_filled -= 1 |
| Follow-up | If still UNCONFIRMED at shift start → `cancelUnconfirmedAtStart` → CANCELLED_BY_SYSTEM (no slots change) |

#### T-009: NO_SHOW handling

| Item | Value |
|---|---|
| Preconditions | APPROVED or CONFIRMED worker (non-backup), shift IN_PROGRESS, past start + grace, checked_in_at IS NULL |
| Action | `flagNoShows` cron runs |
| DB changes | status = NO_SHOW, slots_filled -= 1, NO_SHOW incident created, trust recalculated |
| Verify | UNCONFIRMED workers are NOT touched by this cron (they go through cancelUnconfirmedAtStart instead) |

#### T-010: SOS auto-approve

| Item | Value |
|---|---|
| Preconditions | PUBLISHED shift with unfilled slots, sos_auto_approve = true, eligible workers exist |
| Action | POST `/api/shifts/:id/sos` |
| DB changes | sos_broadcast created, notifications created, auto-approved applications created (APPROVED, is_sos=true), slots_filled incremented per auto-approval |
| Verify | Only workers matching role, distance, trust, no existing app, is_active are included |

#### T-011: Shift cancel with workers

| Item | Value |
|---|---|
| Preconditions | PUBLISHED shift with APPROVED and CONFIRMED workers |
| Action | PATCH `/api/shifts/:id/status` `{ status: "CANCELLED" }` |
| DB changes | shift.status = CANCELLED, all non-terminal apps → CANCELLED_BY_SYSTEM, slots_filled = 0, notifications per worker |
| Verify | IN_PROGRESS shift cancel returns 403. CANCELLED_BY_SYSTEM from shift cancel does NOT trigger trust recalc |

#### T-012: Trust recalculation

| Item | Value |
|---|---|
| Preconditions | Worker with known history: 10 assigned shifts, 2 NO_SHOW, 1 late cancel, 1 late check-in, avg rating 4.0 |
| Action | Call `recalcTrustScore(workerId)` |
| DB changes | trust_score updated per formula |
| Verify | no_show_rate = 2/10, late_cancel_rate = 1/10, late_checkin_rate = 1/(checked_in_count), avg_rating = 4.0. Score = clamp(5.0 - 0.6 - 0.15 - (0.5/n) + 0.5, 0, 5). CANCELLED_BY_SYSTEM apps excluded from denominator |

#### T-013: Incident auto-creation

| Item | Value |
|---|---|
| Preconditions | Worker flagged NO_SHOW; worker with trust < 1.5 and no open incident; shift completed with unfilled slots |
| Action | Respective crons run |
| DB changes | incidents created with correct type, severity, related IDs |
| Verify | No duplicate LOW_TRUST incidents for same worker while one is OPEN/IN_REVIEW |

---

## 9. Seed Demo Plan

### Users

| Role | Count | Details |
|---|---|---|
| Employer | 3 | "מסעדת השף" (restaurant), "מחסני לוגיסטיקה" (warehouse), "אירועי גולד" (events) |
| Worker | 12 | Mix of experience tags (waiter ×4, cook ×2, bartender ×2, loader ×2, general ×2). Trust scores: 2 at 5.0, 4 at 4.2-4.8, 3 at 3.0-3.5, 2 at 2.0-2.5, 1 at 1.2 |
| Admin | 1 | Platform admin |

### Businesses

| Business | Type | Location |
|---|---|---|
| מסעדת השף | restaurant | Tel Aviv |
| מחסני לוגיסטיקה | warehouse | Rishon LeZion |
| אירועי גולד | events | Herzliya |

### Shifts

| Status | Count | Details |
|---|---|---|
| DRAFT | 1 | Future shift, no applications |
| PUBLISHED | 3 | 1 with open slots (for demo apply), 1 with SOS active, 1 fully filled |
| IN_PROGRESS | 2 | 1 normal (some checked in, some missing), 1 with NO_SHOW workers |
| COMPLETED | 4 | With ratings, mix of outcomes |
| CANCELLED | 1 | Was published, had workers, cancelled |

### Applications (across all shifts)

| Status | Count |
|---|---|
| PENDING | 3 |
| APPROVED (active) | 4 |
| APPROVED (backup) | 2 |
| CONFIRMED | 3 |
| UNCONFIRMED | 1 |
| CHECKED_IN | 3 |
| CHECKED_OUT | 4 |
| RATED | 6 |
| NO_SHOW | 2 |
| CANCELLED_BY_WORKER | 2 |
| CANCELLED_BY_SYSTEM | 2 |
| REJECTED | 2 |

### Incidents

| Type | Count | Status |
|---|---|---|
| NO_SHOW | 2 | 1 OPEN, 1 RESOLVED |
| LOW_TRUST | 1 | OPEN |
| SHIFT_UNFILLED | 1 | DISMISSED |
| EMPLOYER_COMPLAINT | 1 | IN_REVIEW |

### Notifications

~30 notifications across workers/employers covering all types: approval, rejection, confirmation request, SOS, backup promotion, shift cancel, NO_SHOW.

### Ratings

6 ratings across completed shifts. Scores: 5, 5, 4, 4, 3, 2. One with flag "late".

### Seed script location

`/scripts/seed.ts` — runnable via `npx tsx scripts/seed.ts`. Uses Supabase service role key.

---

## 10. Coding-Agent Guardrails

### Rules

1. **State machine is law.** Do not transition an application to a status not permitted by §5.2.1 of the spec. The only exception is admin override routes (`/api/admin/applications/:id/override`, `/api/admin/shifts/:id/override`), which bypass transition rules and must log an admin_action.

2. **slots_filled through /lib/slots.ts only.** Never write `UPDATE shifts SET slots_filled = ...` directly in a route handler. Always use `incrementSlotsFilled`, `decrementSlotsFilled`, or `resetSlotsFilled`. These functions handle bounds checking.

3. **Trust logic lives in /lib/trust.ts only.** UI components display `worker_profiles.trust_score` read-only. No trust formula logic in frontend code. No trust recalculation outside the three defined triggers (NO_SHOW, CANCELLED_BY_WORKER, RATED).

4. **Business rules in /lib, not in components.** Status transition validation, overlap checking, eligibility queries, and slot counting belong in `/lib/` modules. Route handlers orchestrate calls to these modules. React components call API routes — they do not contain business logic.

5. **Hebrew strings centralized.** All user-facing text in `/lib/i18n/he.ts`. Components call `t('key')`. No Hebrew string literals in JSX. Admin UI uses a language toggle; worker/employer UI is Hebrew-only.

6. **Status constants from /lib/constants.ts.** Never hardcode status strings ('APPROVED', 'CONFIRMED', etc.) in route handlers or components. Import from constants.

7. **Every admin write operation must log.** Insert into `admin_actions` with admin_user_id, target_type, target_id, action description, and JSONB details. This is not optional.

8. **checkin_events must have source and scanned_by.** Every insert into `checkin_events` must specify `source` ('QR' or 'MANUAL') and `scanned_by_user_id` (worker for QR, employer/admin for manual, NULL for cron auto-checkout).

9. **Notifications via /lib/notifications.ts only.** Do not insert directly into the notifications table. Use `sendNotification()` which handles both DB insert and SMS dispatch.

10. **No direct Supabase calls in components.** Components use API routes via fetch. Server-side route handlers use `/lib/db.ts` Supabase client.

---

## 11. Open Technical Decisions

| # | Decision | Options | Impact | Decide by |
|---|---|---|---|---|
| 1 | SMS provider for OTP and notifications | InforUMobile (Israeli, cheaper) vs. Twilio (broader, more docs) | Blocks auth flow and SOS notifications | Sprint 1 start |
| 2 | QR token TTL | 5-minute rolling tokens (more secure, QR refreshes) vs. session-scoped tokens (one QR per shift, simpler) | Affects E7 UX (refresh interval) and scan validation logic | Sprint 4 start |
| 3 | Cron execution engine | Vercel Cron (HTTP-triggered, 1/min minimum) vs. Supabase pg_cron (DB-native, supports seconds-level) | Affects 15-min cron granularity and cold-start latency | Sprint 4 start |
| 4 | Supabase Realtime scope | E6 only (via Realtime channel per shift) vs. also W4 (worker application updates) | Affects Sprint 4 complexity and client-side code | Sprint 4 start |
| 5 | Distance filtering implementation | PostGIS extension (accurate, more setup) vs. bounding-box lat/lng approximation (simple, good enough for MVP) | Affects migration 004 and worker feed query performance | Sprint 2 start |
| 6 | HMAC secret strategy | Per-shift random secret (stored in shifts.qr_code_secret) vs. app-wide key (env var, simpler) | Per-shift is more secure but requires DB lookup on scan. App-wide is simpler but one leak exposes all QR tokens | Sprint 4 start |
