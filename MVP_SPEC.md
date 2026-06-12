# Joby / ShiftMatch — MVP Specification v1.2

> A shift-operations platform for businesses managing temporary workers, with a worker marketplace layer.
> Target: pilot-ready MVP, executable by a coding agent.

---

## 1. MVP Scope

### IN scope

| Domain | What's included |
|---|---|
| Employer dashboard | Shift overview, worker roster, fill-rate metrics, upcoming shifts |
| Live shift management | Real-time shift status, worker attendance view, manual overrides |
| Shift creation | Single + bulk shift creation, role/location/time/pay, auto-publish |
| Worker discovery & apply | Browse/filter available shifts, one-tap apply, application status |
| Attendance commitment | Worker confirms attendance 12h before shift, no-show penalty flag |
| QR check-in/out | Employer generates QR per shift, worker scans to clock in/out |
| Backup & SOS fill | Designate backup workers, employer triggers SOS broadcast for urgent fill |
| Trust/reliability engine | Simple score based on: show-up rate, cancellation rate, check-in punctuality, employer rating |
| Admin intervention | View incidents, override statuses, resolve disputes, suspend accounts |

### OUT of scope (deferred)

- Payroll processing, tax forms (101), salary slips
- Wallet / in-app payments / invoicing
- Background GPS tracking
- AI/ML matching or recommendations
- Chat/messaging between employer and worker
- Multi-language beyond Hebrew + English
- Advanced analytics / BI dashboards
- SSO / enterprise auth integrations
- Background checks / identity verification pipeline
- Push notification service (use SMS for MVP, or basic FCM)
- Rating of employers by workers (keep one-directional for MVP)

---

## 2. Core Personas

### Employer (Business Manager)
- Manages a physical location (restaurant, warehouse, event venue)
- Needs to fill shifts fast, track who showed up, rate workers
- Desktop-first but must work on mobile
- Hebrew-speaking, RTL UI

### Worker (Temp / Gig worker)
- Looking for flexible shift work
- Mobile-only user
- Needs to find shifts near them, apply quickly, know when/where to show up
- Hebrew-speaking, RTL UI

### Platform Admin
- Joby operations team member
- Resolves disputes, handles incidents, manages trust scores
- Desktop-only
- Hebrew + English UI

---

## 3. Operational Invariants

These rules hold at all times and are enforced at the application/service level. Every module, cron job, and API route must respect them.

1. **One application per worker per shift.** Enforced by UNIQUE(shift_id, worker_id) DB constraint.
2. **No overlapping active applications.** Before creating an application, the service checks for existing non-terminal applications on shifts whose time range overlaps. Terminal statuses for this check: REJECTED, CANCELLED_BY_WORKER, CANCELLED_BY_SYSTEM, NO_SHOW.
3. **Backup workers never count toward slots_filled.** Only non-backup workers in statuses APPROVED, CONFIRMED, CHECKED_IN, CHECKED_OUT, or RATED count. See §7.1 for full slots_filled rules.
4. **Only non-backup workers receive confirmation requests.** The `requestConfirmations` cron skips all applications where is_backup = true.
5. **Only non-backup APPROVED or CONFIRMED workers can become NO_SHOW.** UNCONFIRMED workers are handled separately via CANCELLED_BY_SYSTEM. See §4.2.2.
6. **Incidents are append-and-resolve records.** They are never deleted. `admin_actions` is the immutable audit log of all admin interventions (overrides, suspensions, trust adjustments).
7. **Employer can cancel only DRAFT or PUBLISHED shifts.** IN_PROGRESS and COMPLETED shifts cannot be cancelled by the employer; only admin override can change their status.

---

## 4. Main User Flows

### 4.1 Employer: Create & Fill a Shift

```
1.  Employer logs in → sees dashboard with upcoming shifts
2.  Taps "Create Shift" → fills: role, date, start/end time, location,
    pay rate, slots count, required experience tags
3.  Submits → shift status = PUBLISHED
4.  Workers apply → employer sees applicant list with trust scores
5.  Employer approves/rejects applicants → approved workers get status APPROVED
6.  Employer may also approve backup workers (is_backup = true, APPROVED);
    these do not count toward slots_filled
7.  If unfilled slots remain → employer can trigger SOS broadcast
8.  12h before shift: system sends confirmation request to all APPROVED
    (non-backup) workers
9.  Workers who don't confirm by 2h before shift → status = UNCONFIRMED;
    employer can promote a backup worker to fill the gap
10. If worker is still UNCONFIRMED at shift start_time → CANCELLED_BY_SYSTEM
11. Shift start time reached → shift status = IN_PROGRESS;
    employer opens QR check-in screen
12. Workers scan QR → status = CHECKED_IN
    (employer can also use manual check-in button for workers with QR issues)
13. APPROVED or CONFIRMED workers who have not checked in after
    start_time + checkin_grace_minutes → NO_SHOW
14. Shift ends → employer opens QR check-out screen
    (or auto-closes after shift end + checkout grace period)
15. Employer rates each worker who checked in (1-5 stars + optional flag)
16. Shift status = COMPLETED
```

### 4.2 Worker: Find & Work a Shift

```
1.  Worker logs in → sees available shifts (filtered by location/role/date)
2.  Taps shift → sees details (role, time, location, pay, employer name)
3.  Taps "Apply" → application status = PENDING
4.  Gets notified of approval → status = APPROVED
5.  12h before shift → gets confirmation request
6.  Worker confirms → status = CONFIRMED
7.  Arrives at location → scans QR code → status = CHECKED_IN
8.  Shift ends → scans QR or auto-checkout → status = CHECKED_OUT
9.  Worker sees shift in history with employer rating
```

### 4.3 SOS / Emergency Fill

```
1.  Employer sees unfilled slot (or worker cancelled last-minute)
2.  Taps "SOS Fill" on the shift
3.  System creates notification records for all eligible workers
    (matching role, location radius, available, trust score ≥ SOS threshold)
4.  Workers see SOS shift with urgency badge in feed
5.  If sos_auto_approve is on: first N workers to apply are auto-approved
    up to remaining slots
6.  Normal flow continues from APPROVED
```

### 4.4 Backup Worker Flow

```
1.  Worker applies to a shift → status = PENDING
2.  Employer approves as backup → status = APPROVED, is_backup = true
    (worker is notified they are on the backup list)
3.  Backup worker does NOT count toward slots_filled
4.  If an active (non-backup) worker cancels, becomes UNCONFIRMED,
    or is marked NO_SHOW:
    a. Employer sees available backup workers on the shift detail screen
    b. Employer taps "Promote" on a backup worker
    c. POST /api/applications/:id/promote-backup
    d. System sets is_backup = false, increments slots_filled
    e. Promoted worker is notified they are now active for the shift
5.  Promoted backup follows normal confirmation/check-in flow from their
    current status
```

### 4.5 Admin: Intervene

```
1.  Admin sees incidents dashboard (auto-generated + manually created incidents)
2.  Opens an incident → sees incident details, related shift/worker/application data
3.  Can: override shift/application status, suspend worker/employer,
    adjust trust score, add resolution notes
4.  Marks incident as RESOLVED or DISMISSED
5.  All actions logged in admin_actions table
```

---

## 5. State Machines

### 5.1 Shift Status

```
DRAFT → PUBLISHED → IN_PROGRESS → COMPLETED
                  → CANCELLED
       ↳ (employer can revert to DRAFT only if zero applications exist)
```

| State | Trigger |
|---|---|
| DRAFT | Employer saves without publishing |
| PUBLISHED | Employer publishes (or creates with publish = true) |
| IN_PROGRESS | Shift start_time reached (cron), or first worker checks in (whichever is first) |
| COMPLETED | Shift end_time + checkout_grace_minutes passed (cron), or employer manually completes |
| CANCELLED | Employer cancels a DRAFT or PUBLISHED shift. IN_PROGRESS shifts can only be ended by admin override or normal completion |

#### 5.1.1 Shift Cancellation Side Effects

When an employer cancels a PUBLISHED shift, all non-terminal applications are bulk-transitioned:

| Application status before cancel | Transition |
|---|---|
| PENDING | → CANCELLED_BY_SYSTEM |
| APPROVED (active or backup) | → CANCELLED_BY_SYSTEM |
| CONFIRMED | → CANCELLED_BY_SYSTEM |
| UNCONFIRMED | → CANCELLED_BY_SYSTEM |

For each affected worker: a notification is created, and slots_filled is set to 0. CANCELLED_BY_SYSTEM from employer-initiated shift cancellation does NOT count against the worker's trust score (excluded from `total_assigned_shifts` denominator — see §9.2).

DRAFT shifts with zero applications can also be cancelled; no side effects.

### 5.2 Application Status

```
PENDING → APPROVED → CONFIRMED → CHECKED_IN → CHECKED_OUT → RATED
       → REJECTED (terminal)

APPROVED → CANCELLED_BY_WORKER (terminal)
APPROVED → UNCONFIRMED → CANCELLED_BY_SYSTEM (terminal)
APPROVED → NO_SHOW (terminal, non-backup only)

CONFIRMED → CANCELLED_BY_WORKER (terminal)
CONFIRMED → CHECKED_IN
CONFIRMED → NO_SHOW (terminal)

UNCONFIRMED → CONFIRMED (worker confirms late, before shift start)
UNCONFIRMED → CANCELLED_BY_SYSTEM (terminal, at shift start)

Bulk-cancel on shift cancellation:
PENDING → CANCELLED_BY_SYSTEM (terminal)
APPROVED → CANCELLED_BY_SYSTEM (terminal)
CONFIRMED → CANCELLED_BY_SYSTEM (terminal)
UNCONFIRMED → CANCELLED_BY_SYSTEM (terminal)

RATED (terminal)
```

#### 5.2.1 Application Transition Rules (Exhaustive)

| From | To | Trigger | Guard |
|---|---|---|---|
| PENDING | APPROVED | Employer approves, or SOS auto-approve | Shift is PUBLISHED; if is_backup = false: slots_filled < slots_total; if is_backup = true: no slot check |
| PENDING | REJECTED | Employer rejects | — |
| PENDING | CANCELLED_BY_SYSTEM | Shift cancelled by employer | Shift transitioning to CANCELLED |
| APPROVED | CONFIRMED | Worker confirms attendance | Confirmation window is open (≤ 12h before, > shift start); non-backup only (backup workers are not sent confirmation requests) |
| APPROVED | CANCELLED_BY_WORKER | Worker cancels | Before shift end_time |
| APPROVED | UNCONFIRMED | Confirmation window closed without response | Cron: 2h before shift start; non-backup only |
| APPROVED | NO_SHOW | Worker never checked in | Cron: shift start + checkin_grace_minutes passed; non-backup only; is_backup = false |
| APPROVED | CANCELLED_BY_SYSTEM | Shift cancelled by employer | Shift transitioning to CANCELLED |
| CONFIRMED | CHECKED_IN | Worker scans QR or manual check-in | Shift is IN_PROGRESS or within 15min before start |
| CONFIRMED | CANCELLED_BY_WORKER | Worker cancels | Before shift end_time |
| CONFIRMED | NO_SHOW | Worker never checked in | Cron: shift start + checkin_grace_minutes passed |
| CONFIRMED | CANCELLED_BY_SYSTEM | Shift cancelled by employer | Shift transitioning to CANCELLED |
| UNCONFIRMED | CONFIRMED | Worker late-confirms | Before shift start_time |
| UNCONFIRMED | CANCELLED_BY_SYSTEM | System auto-cancels at shift start, or shift cancelled by employer | Cron: shift start_time reached and worker still UNCONFIRMED |
| CHECKED_IN | CHECKED_OUT | Worker scans QR out, manual checkout, or auto-checkout | Shift end window or cron auto-complete |
| CHECKED_OUT | RATED | Employer submits rating | Shift is COMPLETED |

**Terminal statuses** (no further transitions): REJECTED, CANCELLED_BY_WORKER, CANCELLED_BY_SYSTEM, NO_SHOW, RATED.

**Backup-specific rules:**
- A backup worker (is_backup = true) can hold status APPROVED only.
- Backup workers are NOT sent confirmation requests and do NOT transition to UNCONFIRMED.
- Backup workers do NOT transition to NO_SHOW.
- Promotion via `/api/applications/:id/promote-backup` sets is_backup = false and increments slots_filled. Status remains APPROVED and normal flow continues.
- After promotion, if the confirmation window is still open, a confirmation request notification is sent immediately.

#### 5.2.2 NO_SHOW Source Statuses (Definitive)

NO_SHOW can be reached from: **APPROVED** (non-backup) and **CONFIRMED** only.

UNCONFIRMED workers are **never** transitioned to NO_SHOW. They go to CANCELLED_BY_SYSTEM at shift start_time instead.

The trigger in all cases: shift start_time + checkin_grace_minutes has passed and checked_in_at IS NULL and is_backup = false.

### 5.3 Shift SOS Status

```
INACTIVE → ACTIVE → FILLED → EXPIRED
```

| State | Trigger |
|---|---|
| INACTIVE | Default |
| ACTIVE | Employer triggers SOS |
| FILLED | All slots filled (slots_filled = slots_total) |
| EXPIRED | Shift start_time reached |

### 5.4 Incident Status

```
OPEN → IN_REVIEW → RESOLVED
                 → DISMISSED
```

| State | Trigger |
|---|---|
| OPEN | Auto-created by cron/system, or manually by admin |
| IN_REVIEW | Admin assigns themselves or another admin |
| RESOLVED | Admin resolves with notes |
| DISMISSED | Admin dismisses (false positive / no action needed) |

---

## 6. Database Schema

All tables use UUID PKs. Timestamps in UTC. Soft-delete via `deleted_at` where needed.

### DB-level constraints

```
-- shifts.end_time > shifts.start_time (CHECK)
-- shifts.slots_total >= 1 (CHECK)
-- shifts.slots_filled >= 0 (CHECK)
-- worker_profiles.trust_score BETWEEN 0.00 AND 5.00 (CHECK)
-- ratings.score BETWEEN 1 AND 5 (CHECK)
-- applications UNIQUE(shift_id, worker_id)
-- checkin_events.source IN ('QR', 'MANUAL') (CHECK)
```

### Application-level constraints

```
-- slots_filled <= slots_total: enforce transactionally when approving/promoting
-- Overlapping shift check: block at service level (see §3 Invariant #2)
-- slots_filled counting rules: see §7.1
```

```sql
-- === USERS ===
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  email         VARCHAR(255),
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('employer', 'worker', 'admin')),
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- === EMPLOYER PROFILES ===
CREATE TABLE employer_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id),
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100),
  address       TEXT,
  lat           DECIMAL(10, 7),
  lng           DECIMAL(10, 7),
  logo_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- === WORKER PROFILES ===
CREATE TABLE worker_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id),
  date_of_birth DATE,
  city          VARCHAR(100),
  lat           DECIMAL(10, 7),
  lng           DECIMAL(10, 7),
  experience_tags TEXT[],
  bio           TEXT,
  trust_score   DECIMAL(3, 2) DEFAULT 5.00
                CHECK (trust_score >= 0.00 AND trust_score <= 5.00),
  total_shifts  INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  cancel_count  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- === SHIFTS ===
CREATE TABLE shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id   UUID NOT NULL REFERENCES employer_profiles(id),
  title         VARCHAR(255) NOT NULL,
  role_tag      VARCHAR(100) NOT NULL,
  description   TEXT,
  address       TEXT NOT NULL,
  lat           DECIMAL(10, 7) NOT NULL,
  lng           DECIMAL(10, 7) NOT NULL,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  pay_rate      DECIMAL(10, 2) NOT NULL,
  pay_type      VARCHAR(20) DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'fixed')),
  slots_total   INTEGER NOT NULL CHECK (slots_total >= 1),
  slots_filled  INTEGER NOT NULL DEFAULT 0 CHECK (slots_filled >= 0),
  status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                CHECK (status IN ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  sos_status    VARCHAR(20) DEFAULT 'INACTIVE'
                CHECK (sos_status IN ('INACTIVE', 'ACTIVE', 'FILLED', 'EXPIRED')),
  sos_auto_approve BOOLEAN DEFAULT false,
  min_trust_score DECIMAL(3, 2) DEFAULT 0.00,
  confirmation_window_hours INTEGER DEFAULT 12,
  checkin_grace_minutes INTEGER DEFAULT 15,
  checkout_grace_minutes INTEGER DEFAULT 30,
  qr_code_secret VARCHAR(64),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_shift_times CHECK (end_time > start_time)
);

-- === APPLICATIONS ===
CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES shifts(id),
  worker_id     UUID NOT NULL REFERENCES worker_profiles(id),
  status        VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN (
                  'PENDING', 'APPROVED', 'REJECTED',
                  'CONFIRMED', 'UNCONFIRMED',
                  'CANCELLED_BY_WORKER', 'CANCELLED_BY_SYSTEM',
                  'CHECKED_IN', 'CHECKED_OUT',
                  'NO_SHOW', 'RATED'
                )),
  is_backup     BOOLEAN DEFAULT false,
  is_sos        BOOLEAN DEFAULT false,
  applied_at    TIMESTAMPTZ DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  confirmed_at  TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shift_id, worker_id)
);

-- === RATINGS ===
CREATE TABLE ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE NOT NULL REFERENCES applications(id),
  shift_id      UUID NOT NULL REFERENCES shifts(id),
  worker_id     UUID NOT NULL REFERENCES worker_profiles(id),
  employer_id   UUID NOT NULL REFERENCES employer_profiles(id),
  score         INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  flag          VARCHAR(50),
  comment       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- === QR CHECK-IN EVENTS ===
CREATE TABLE checkin_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES applications(id),
  shift_id            UUID NOT NULL REFERENCES shifts(id),
  worker_id           UUID NOT NULL REFERENCES worker_profiles(id),
  event_type          VARCHAR(10) NOT NULL CHECK (event_type IN ('CHECK_IN', 'CHECK_OUT')),
  source              VARCHAR(10) NOT NULL DEFAULT 'QR' CHECK (source IN ('QR', 'MANUAL')),
  scanned_by_user_id  UUID REFERENCES users(id),
  scanned_at          TIMESTAMPTZ DEFAULT now(),
  lat                 DECIMAL(10, 7),
  lng                 DECIMAL(10, 7)
);

-- === SOS BROADCASTS ===
CREATE TABLE sos_broadcasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES shifts(id),
  employer_id   UUID NOT NULL REFERENCES employer_profiles(id),
  slots_needed  INTEGER NOT NULL,
  radius_km     INTEGER DEFAULT 20,
  min_trust     DECIMAL(3, 2) DEFAULT 3.00,
  sent_to_count INTEGER DEFAULT 0,
  filled_count  INTEGER DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'FILLED', 'EXPIRED')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

-- === INCIDENTS ===
CREATE TABLE incidents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type         VARCHAR(30) NOT NULL
                        CHECK (incident_type IN (
                          'NO_SHOW', 'LOW_TRUST', 'QR_FAILURE',
                          'SHIFT_UNFILLED', 'EMPLOYER_COMPLAINT',
                          'WORKER_COMPLAINT', 'MANUAL_REVIEW'
                        )),
  severity              VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                        CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status                VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
  title                 VARCHAR(255) NOT NULL,
  description           TEXT,
  related_user_id       UUID REFERENCES users(id),
  related_shift_id      UUID REFERENCES shifts(id),
  related_application_id UUID REFERENCES applications(id),
  created_by_user_id    UUID REFERENCES users(id),
  assigned_admin_id     UUID REFERENCES users(id),
  resolution_notes      TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  resolved_at           TIMESTAMPTZ
);

-- === ADMIN ACTIONS LOG ===
CREATE TABLE admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  target_type   VARCHAR(20) NOT NULL,
  target_id     UUID NOT NULL,
  action        VARCHAR(50) NOT NULL,
  details       JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- === NOTIFICATIONS (simple queue) ===
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT,
  payload       JSONB,
  channel       VARCHAR(20) DEFAULT 'in_app' CHECK (channel IN ('in_app', 'sms', 'push')),
  is_read       BOOLEAN DEFAULT false,
  sent_at       TIMESTAMPTZ DEFAULT now()
);

-- === INDEXES ===
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_start ON shifts(start_time);
CREATE INDEX idx_shifts_employer ON shifts(employer_id);
CREATE INDEX idx_shifts_role_tag ON shifts(role_tag);
CREATE INDEX idx_shifts_location ON shifts(lat, lng);
CREATE INDEX idx_applications_shift ON applications(shift_id);
CREATE INDEX idx_applications_worker ON applications(worker_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_type ON incidents(incident_type);
CREATE INDEX idx_incidents_related_shift ON incidents(related_shift_id);
CREATE INDEX idx_incidents_assigned ON incidents(assigned_admin_id);
CREATE INDEX idx_checkin_events_application ON checkin_events(application_id);
```

---

## 7. Slots-Filled Counting Rules

### 7.1 Who counts toward slots_filled

`slots_filled` counts **active non-backup** workers in these statuses:

| Status | Counted? |
|---|---|
| PENDING | No |
| APPROVED (is_backup = false) | **Yes** |
| APPROVED (is_backup = true) | No |
| REJECTED | No |
| CONFIRMED | **Yes** |
| UNCONFIRMED | No |
| CANCELLED_BY_WORKER | No |
| CANCELLED_BY_SYSTEM | No |
| CHECKED_IN | **Yes** |
| CHECKED_OUT | **Yes** |
| RATED | **Yes** |
| NO_SHOW | No |

### 7.2 When slots_filled changes

| Event | Change |
|---|---|
| Active (non-backup) worker APPROVED | +1 |
| Backup promoted to active (is_backup false → true) | +1 |
| APPROVED/CONFIRMED → CANCELLED_BY_WORKER | -1 |
| APPROVED → UNCONFIRMED | -1 |
| APPROVED/CONFIRMED → NO_SHOW | -1 |
| UNCONFIRMED → CANCELLED_BY_SYSTEM | No change (already decremented on APPROVED → UNCONFIRMED) |
| Shift cancelled (bulk cancel) | Set to 0 |
| CHECKED_IN → CHECKED_OUT | No change |
| CHECKED_OUT → RATED | No change |

---

## 8. API / Module Breakdown

Tech stack: **Next.js 14+ (App Router)** with **Supabase** (Postgres + Auth + Realtime). Mobile workers use responsive PWA.

### 8.1 Auth Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| POST | `/api/auth/send-otp` | Send OTP via SMS | Login |
| POST | `/api/auth/verify-otp` | Verify OTP, return JWT | Login |
| POST | `/api/auth/register` | Create user + role-specific profile | Register |
| GET | `/api/auth/me` | Get current user + profile | All (session check) |

### 8.2 Shifts Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| POST | `/api/shifts` | Create shift | E4 |
| PATCH | `/api/shifts/:id` | Update shift (only DRAFT/PUBLISHED with no APPROVED workers) | E4 |
| GET | `/api/shifts` | List shifts (query: role_tag, lat/lng/radius, status, date_from, date_to, employer_id) | W2, E3 |
| GET | `/api/shifts/:id` | Get shift details | W3, E5, E6, A3 |
| PATCH | `/api/shifts/:id/status` | Change shift status (publish, cancel, complete). Cancel allowed only for DRAFT/PUBLISHED. | E5 |
| POST | `/api/shifts/:id/sos` | Trigger SOS broadcast | E6 |
| GET | `/api/shifts/:id/qr` | Generate QR code payload | E7 |
| GET | `/api/shifts/employer/dashboard` | Employer dashboard aggregation | E2 |

### 8.3 Applications Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| POST | `/api/shifts/:id/apply` | Worker applies to shift | W3 |
| GET | `/api/shifts/:id/applications` | List applications for a shift | E5, E6, E8 |
| PATCH | `/api/applications/:id/status` | Approve/reject application (employer). See §8.3.1 for allowed payloads | E5 |
| POST | `/api/applications/:id/confirm` | Worker confirms attendance | W5 |
| POST | `/api/applications/:id/cancel` | Worker cancels | W5 |
| POST | `/api/applications/:id/promote-backup` | Promote backup worker to active | E5, E6 |
| GET | `/api/worker/applications` | Worker's own application history (query: status filter) | W4 |

#### 8.3.1 PATCH `/api/applications/:id/status` — Allowed Payloads

| Action | Request body | Guards |
|---|---|---|
| Approve (active) | `{ "status": "APPROVED", "is_backup": false }` | Shift status = PUBLISHED; slots_filled < slots_total |
| Approve (backup) | `{ "status": "APPROVED", "is_backup": true }` | Shift status = PUBLISHED (no slot check) |
| Reject | `{ "status": "REJECTED" }` | Application status = PENDING |

All other payloads return HTTP 400. Approve calls that would exceed slots_total return HTTP 409.

### 8.4 Check-in Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| POST | `/api/checkin/scan` | Worker scans QR → validates + records check-in or check-out | W6 |
| POST | `/api/applications/:id/manual-checkin` | Employer manually checks in a worker (bypasses QR) | E6 |
| POST | `/api/applications/:id/manual-checkout` | Employer manually checks out a worker (bypasses QR) | E6 |
| GET | `/api/shifts/:id/attendance` | Live attendance view for a shift | E6 |

#### 8.4.1 POST `/api/checkin/scan` — Request and Validation Contract

**Request body:**
```json
{
  "token": "<scanned QR string>"
}
```

**Token format (decoded):**
```
{shift_id}:{check_mode}:{timestamp}:{hmac}
```

Where `check_mode` ∈ `{ "CHECK_IN", "CHECK_OUT" }`.

**Validation steps (in order):**

1. Verify HMAC signature against shift's qr_code_secret → `INVALID_QR` on failure
2. Verify token timestamp is within 5 minutes of current time → `EXPIRED_QR` on failure
3. Look up application for authenticated worker + shift_id → `NOT_APPROVED_FOR_SHIFT` if no non-terminal application found
4. Verify is_backup = false → `NOT_APPROVED_FOR_SHIFT` if backup
5. If check_mode = CHECK_IN:
   - Valid prior statuses: APPROVED, CONFIRMED → `ALREADY_CHECKED_IN` if CHECKED_IN
   - Time window: shift start_time - 15min to start_time + checkin_grace_minutes → `OUTSIDE_CHECKIN_WINDOW` if outside
   - On success: set status = CHECKED_IN, checked_in_at = now(), create checkin_event (source = QR, scanned_by_user_id = worker's user_id)
6. If check_mode = CHECK_OUT:
   - Valid prior status: CHECKED_IN → `ALREADY_CHECKED_OUT` if CHECKED_OUT; `NOT_CHECKED_IN` if not CHECKED_IN
   - Time window: shift end_time - 30min to end_time + checkout_grace_minutes → `OUTSIDE_CHECKOUT_WINDOW` if outside
   - On success: set status = CHECKED_OUT, checked_out_at = now(), create checkin_event (source = QR, scanned_by_user_id = worker's user_id)

**Error response format:**
```json
{
  "error": "<ERROR_CODE>",
  "message": "<Hebrew error message>"
}
```

#### 8.4.2 POST `/api/applications/:id/manual-checkin` — Contract

**Auth:** Employer who owns the shift, or admin.

**Validation:**
- Application must be for a shift owned by the authenticated employer (or caller is admin)
- Application is_backup = false
- Valid prior statuses: APPROVED, CONFIRMED
- Time window: shift start_time - 15min to start_time + checkin_grace_minutes (same as QR)

**Side effects:**
- Set status = CHECKED_IN, checked_in_at = now()
- Create checkin_event with source = 'MANUAL', scanned_by_user_id = employer/admin user_id

#### 8.4.3 POST `/api/applications/:id/manual-checkout` — Contract

**Auth:** Employer who owns the shift, or admin.

**Validation:**
- Application must be for a shift owned by the authenticated employer (or caller is admin)
- Valid prior status: CHECKED_IN
- Time window: shift end_time - 30min to end_time + checkout_grace_minutes

**Side effects:**
- Set status = CHECKED_OUT, checked_out_at = now()
- Create checkin_event with source = 'MANUAL', scanned_by_user_id = employer/admin user_id

### 8.5 Ratings Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| POST | `/api/applications/:id/rate` | Employer rates worker after shift | E8 |
| GET | `/api/workers/:id/ratings` | Get worker's rating history | E9, A2 |

### 8.6 Workers Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| GET | `/api/workers/:id` | Get worker profile + stats + trust score | E9, A2, A4 |

### 8.7 Notifications Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| GET | `/api/notifications` | Get current user's notifications (paginated) | W8 |
| PATCH | `/api/notifications/:id/read` | Mark as read | W8 |
| POST (internal) | `sendNotification(userId, type, payload)` | Create notification + trigger SMS/push | Internal |

### 8.8 Admin Module

| Method | Route | Description | Used by screens |
|---|---|---|---|
| GET | `/api/admin/incidents` | List incidents (query: status, type, severity) | A1 |
| GET | `/api/admin/incidents/:id` | Get incident details with related entities | A1 |
| PATCH | `/api/admin/incidents/:id` | Update incident (status, severity, resolution_notes) | A1 |
| POST | `/api/admin/incidents/:id/assign` | Assign incident to an admin | A1 |
| POST | `/api/admin/incidents/:id/resolve` | Resolve or dismiss incident with notes | A1 |
| POST | `/api/admin/incidents` | Manually create an incident | A1 |
| GET | `/api/admin/users` | User management list (query: role, is_active, search) | A2 |
| PATCH | `/api/admin/users/:id/suspend` | Suspend/unsuspend user | A2 |
| PATCH | `/api/admin/users/:id/trust` | Manually set trust score (stored directly, no formula recalc) | A4 |
| PATCH | `/api/admin/applications/:id/override` | Override application status (bypasses transition rules; logged) | A3 |
| PATCH | `/api/admin/shifts/:id/override` | Override shift status (logged; this is the only way to end an IN_PROGRESS shift early) | A3 |
| GET | `/api/admin/actions` | Paginated action log (query: admin_id, target_type, date range) | A5 |

### 8.9 Trust Engine (internal service, not exposed as API)

| Function | Trigger | Logic |
|---|---|---|
| `recalcTrustScore(workerId)` | After: NO_SHOW flagged, CANCELLED_BY_WORKER recorded, rating submitted | Weighted formula (see §9) |
| `getEligibleWorkers(shiftId)` | On SOS broadcast | Filter by: role tag match, distance ≤ radius, trust ≥ min, not already applied, is_active |

### 8.10 Cron Jobs (background)

| Job | Schedule | Action | Statuses affected |
|---|---|---|---|
| `requestConfirmations` | Every hour | For shifts starting within confirmation_window_hours: send confirmation request notification to workers with status = APPROVED, is_backup = false, no existing confirmation_request notification for this application | APPROVED (no status change) |
| `flagUnconfirmed` | Every hour | For shifts starting in ≤ 2h: change APPROVED workers (non-backup, confirmed_at IS NULL) to UNCONFIRMED. Decrement slots_filled for each. Create SHIFT_UNFILLED incident if slots_filled < slots_total | APPROVED → UNCONFIRMED; slots_filled -1 per worker |
| `cancelUnconfirmedAtStart` | Every 15 min | For IN_PROGRESS shifts: change remaining UNCONFIRMED workers to CANCELLED_BY_SYSTEM. No slots_filled change (already decremented when they became UNCONFIRMED) | UNCONFIRMED → CANCELLED_BY_SYSTEM |
| `flagNoShows` | Every 15 min | For IN_PROGRESS shifts past start_time + checkin_grace_minutes: change APPROVED and CONFIRMED workers (non-backup, checked_in_at IS NULL) to NO_SHOW. Decrement slots_filled for each. Create NO_SHOW incident per worker. Call recalcTrustScore per worker | APPROVED/CONFIRMED → NO_SHOW; slots_filled -1 per worker |
| `autoCompleteShifts` | Every 15 min | For shifts past end_time + checkout_grace_minutes and still IN_PROGRESS: auto-checkout all CHECKED_IN workers (status = CHECKED_OUT, checked_out_at = now(), create checkin_event with source = 'MANUAL', scanned_by_user_id = NULL). Set shift status = COMPLETED. If slots_filled < slots_total, create SHIFT_UNFILLED incident | CHECKED_IN → CHECKED_OUT; shift → COMPLETED |
| `expireSOS` | Every 15 min | For SOS broadcasts on shifts that reached start_time: set sos_status = EXPIRED | SOS ACTIVE → EXPIRED |
| `autoCreateLowTrustIncidents` | Every hour | For workers with trust_score < 1.5 and no existing OPEN/IN_REVIEW LOW_TRUST incident: create LOW_TRUST incident | — (creates incident) |

---

## 9. Trust / Reliability Engine

### 9.1 Formula

```
trust_score = clamp(
  base_score
  - (no_show_rate × 3.0)
  - (late_cancel_rate × 1.5)
  - (late_checkin_rate × 0.5)
  + (avg_employer_rating - 3.0) × 0.5,
  0.00,
  5.00
)
```

Where `base_score` = 5.0 (new workers start at max).

### 9.2 Trust Inputs Mapping

| Formula Input | Type | Source query | Notes |
|---|---|---|---|
| `no_show_rate` | Derived | `COUNT(applications WHERE worker_id = :wid AND status = 'NO_SHOW') / total_assigned_shifts` | — |
| `late_cancel_rate` | Derived | `COUNT(applications WHERE worker_id = :wid AND status = 'CANCELLED_BY_WORKER' AND cancelled_at >= (shift.start_time - INTERVAL '4 hours')) / total_assigned_shifts` | Only cancellations within 4h of shift start; join to shifts table for start_time |
| `late_checkin_rate` | Derived | `COUNT(applications WHERE worker_id = :wid AND checked_in_at > (shift.start_time + shift.checkin_grace_minutes * INTERVAL '1 minute')) / total_checked_in_shifts` | Only workers who did check in but were late |
| `avg_employer_rating` | Derived | `AVG(ratings.score WHERE worker_id = :wid)` | Returns NULL if no ratings; treat as 3.0 (neutral) |

**Denominator definitions:**

| Denominator | Definition |
|---|---|
| `total_assigned_shifts` | `COUNT(applications WHERE worker_id = :wid AND status IN ('APPROVED', 'CONFIRMED', 'UNCONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'RATED', 'NO_SHOW', 'CANCELLED_BY_WORKER'))`. Explicitly **excludes** PENDING, REJECTED, and CANCELLED_BY_SYSTEM (system/employer-caused cancellations should not penalize the worker). |
| `total_checked_in_shifts` | `COUNT(applications WHERE worker_id = :wid AND checked_in_at IS NOT NULL)` |

**Stored vs. derived:** `worker_profiles.trust_score` is the stored current value, updated by `recalcTrustScore(workerId)`. The source of truth for recalculation is always the relational data above. The stored counters (`total_shifts`, `no_show_count`, `cancel_count`) are denormalized caches for display; the trust formula always re-derives from applications/ratings tables.

### 9.3 First-3-shifts protection rule

- **Trigger:** based on **completed shifts** — applications with status in (CHECKED_OUT, RATED).
- While a worker has fewer than 3 completed shifts, `recalcTrustScore` applies `max(calculated_score, 4.0)` — the score cannot drop below 4.0.
- After the 3rd completed shift, the floor is removed.

### 9.4 Thresholds

| Threshold | Value | Effect |
|---|---|---|
| SOS eligibility floor | 3.0 | Workers below this don't receive SOS broadcasts |
| Employer-configurable min | 0.0 - 5.0 | Per-shift minimum trust score to apply |
| Auto-flag for review | 1.5 | System creates LOW_TRUST incident |
| New worker protection | 4.0 floor for first 3 completed shifts | Prevents cold-start penalty |

### 9.5 Recalculation triggers

`recalcTrustScore(workerId)` is called:
1. When an application transitions to NO_SHOW (via `flagNoShows` cron)
2. When an application transitions to CANCELLED_BY_WORKER (via worker cancel endpoint)
3. When a rating is submitted (application → RATED, via rate endpoint)

**Not triggered by:**
- Auto-checkout (no material formula impact — worker showed up and worked the shift)
- Admin manual trust override (admin sets value directly, bypassing formula)
- CANCELLED_BY_SYSTEM (not the worker's fault)

---

## 10. Screens List by Role

### 10.1 Worker (Mobile PWA — RTL)

| # | Screen | Key Elements | Backing API routes |
|---|---|---|---|
| W1 | Login / Register | Phone + OTP, name, city, experience tags | `/api/auth/*` |
| W2 | Shift Feed | Filterable list (role, date, distance, pay), SOS badge | `GET /api/shifts` |
| W3 | Shift Details | Full info, employer name, map, pay, "Apply" button | `GET /api/shifts/:id`, `POST /api/shifts/:id/apply` |
| W4 | My Shifts | Tabs: Upcoming / History / Pending | `GET /api/worker/applications` |
| W5 | Shift Card (in My Shifts) | Status badge, confirm button, cancel button, QR scan button | `POST /api/applications/:id/confirm`, `POST /api/applications/:id/cancel` |
| W6 | QR Scanner | Camera-based QR scanner, success/error feedback in Hebrew | `POST /api/checkin/scan` |
| W7 | Profile | Name, photo, experience tags, trust score (read-only), shift stats | `GET /api/auth/me` |
| W8 | Notifications | List of notifications with read/unread | `GET /api/notifications`, `PATCH /api/notifications/:id/read` |

### 10.2 Employer (Desktop + Mobile — RTL)

| # | Screen | Key Elements | Backing API routes |
|---|---|---|---|
| E1 | Login / Register | Phone + OTP, business name, type, address | `/api/auth/*` |
| E2 | Dashboard | Today's shifts summary, fill rate, upcoming shifts, alerts | `GET /api/shifts/employer/dashboard` |
| E3 | Shift List | All shifts with filters (status, date range) | `GET /api/shifts` |
| E4 | Create/Edit Shift | Form: role, date, times, pay, slots, tags, min trust, publish toggle | `POST /api/shifts`, `PATCH /api/shifts/:id` |
| E5 | Shift Detail | Status, applicant list with trust scores, approve/reject, approve-as-backup, promote backup buttons | `GET /api/shifts/:id`, `GET /api/shifts/:id/applications`, `PATCH /api/applications/:id/status`, `POST /api/applications/:id/promote-backup` |
| E6 | Live Shift View | Real-time attendance: who's checked in/missing, SOS button, manual check-in/out buttons per worker, promote backup | `GET /api/shifts/:id/attendance`, `POST /api/shifts/:id/sos`, `POST /api/applications/:id/manual-checkin`, `POST /api/applications/:id/manual-checkout`, `POST /api/applications/:id/promote-backup` |
| E7 | QR Display | Large QR code for workers to scan; toggle between CHECK_IN and CHECK_OUT modes | `GET /api/shifts/:id/qr` |
| E8 | Rate Workers | Post-shift: star rating + flag + comment per CHECKED_OUT worker | `GET /api/shifts/:id/applications`, `POST /api/applications/:id/rate` |
| E9 | Worker Profile View | Worker stats, past ratings, trust score | `GET /api/workers/:id`, `GET /api/workers/:id/ratings` |

### 10.3 Admin (Desktop — RTL + LTR)

| # | Screen | Key Elements | Backing API routes |
|---|---|---|---|
| A1 | Incidents Dashboard | List of OPEN/IN_REVIEW incidents, filterable by type/severity, assign/resolve actions | `GET /api/admin/incidents`, `GET /api/admin/incidents/:id`, `PATCH /api/admin/incidents/:id`, `POST /api/admin/incidents/:id/assign`, `POST /api/admin/incidents/:id/resolve`, `POST /api/admin/incidents` |
| A2 | User Management | Search/filter users, view profiles, suspend toggle | `GET /api/admin/users`, `PATCH /api/admin/users/:id/suspend`, `GET /api/workers/:id` |
| A3 | Shift Override | View any shift, override shift/application status | `GET /api/shifts/:id`, `PATCH /api/admin/shifts/:id/override`, `PATCH /api/admin/applications/:id/override` |
| A4 | Trust Score Editor | View/adjust worker trust scores with audit log | `GET /api/workers/:id`, `PATCH /api/admin/users/:id/trust` |
| A5 | Action Log | Searchable log of all admin interventions | `GET /api/admin/actions` |

---

## 11. Acceptance Criteria

### Shift Creation

- [ ] Employer can create a shift with all required fields: title, role_tag, start_time, end_time, address, lat/lng, pay_rate, slots_total
- [ ] API rejects shifts where end_time ≤ start_time (HTTP 400)
- [ ] API rejects shifts where slots_total < 1 (HTTP 400)
- [ ] Shift defaults to status DRAFT when created without `publish: true`
- [ ] When employer sets `publish: true`, shift is created with status PUBLISHED
- [ ] A PUBLISHED shift is returned by `GET /api/shifts?status=PUBLISHED` on the next API call (max visibility latency for workers = 30s polling interval)
- [ ] Employer can edit a shift only while status is DRAFT, or PUBLISHED with zero APPROVED applications
- [ ] PATCH to a PUBLISHED shift with any APPROVED applications returns HTTP 409
- [ ] Employer can cancel a DRAFT shift (no side effects) or a PUBLISHED shift (bulk-cancels all non-terminal applications to CANCELLED_BY_SYSTEM, notifications created)
- [ ] Employer CANNOT cancel an IN_PROGRESS shift (HTTP 403); only admin override can change IN_PROGRESS shift status

### Worker Application

- [ ] `GET /api/shifts?status=PUBLISHED` returns only PUBLISHED shifts
- [ ] Worker can filter shifts by role_tag (exact match), date range, and distance (city-based radius)
- [ ] Worker can apply with one `POST /api/shifts/:id/apply` call
- [ ] API rejects application if worker has a non-terminal application for an overlapping shift (HTTP 409 with conflicting shift_id)
- [ ] API rejects application if worker's trust_score < shift's min_trust_score (HTTP 403)
- [ ] Worker can view their application status via `GET /api/worker/applications`; response reflects current DB status (max propagation = 30s polling interval)
- [ ] API rejects application if worker is_active = false (HTTP 403)

### Attendance Confirmation

- [ ] `requestConfirmations` cron creates a notification of type `confirmation_request` for each APPROVED (non-backup) worker on shifts starting within confirmation_window_hours
- [ ] Each worker receives at most one confirmation request per application (deduplicated by checking existing notification with matching type + application_id in payload)
- [ ] Worker can confirm via `POST /api/applications/:id/confirm` → status changes to CONFIRMED, confirmed_at set
- [ ] `flagUnconfirmed` cron changes APPROVED workers (non-backup, confirmed_at IS NULL) to UNCONFIRMED for shifts starting in ≤ 2h; decrements slots_filled for each
- [ ] UNCONFIRMED workers who late-confirm (before shift start) transition back to CONFIRMED; slots_filled re-incremented
- [ ] UNCONFIRMED workers still UNCONFIRMED at shift start_time → CANCELLED_BY_SYSTEM (via `cancelUnconfirmedAtStart` cron); no further slots_filled change
- [ ] Employer sees confirmation status per worker on E5/E6 screens

### QR Check-in/out

- [ ] `GET /api/shifts/:id/qr` returns a QR payload containing HMAC-signed token: `{shift_id}:{check_mode}:{timestamp}:{hmac}`
- [ ] Employer E7 screen has a toggle to switch check_mode between CHECK_IN and CHECK_OUT
- [ ] `POST /api/checkin/scan` validates token per §8.4.1 contract (HMAC, timestamp, application lookup, status, time window)
- [ ] Check-in window: shift start_time - 15min through start_time + checkin_grace_minutes
- [ ] Check-out window: shift end_time - 30min through end_time + checkout_grace_minutes
- [ ] On valid check-in: application → CHECKED_IN, checked_in_at set, checkin_event row created with source = 'QR'
- [ ] On valid check-out: application → CHECKED_OUT, checked_out_at set, checkin_event row created with source = 'QR'
- [ ] On invalid scan: API returns HTTP 400 with error code and Hebrew message (codes: INVALID_QR, EXPIRED_QR, NOT_APPROVED_FOR_SHIFT, OUTSIDE_CHECKIN_WINDOW, OUTSIDE_CHECKOUT_WINDOW, ALREADY_CHECKED_IN, ALREADY_CHECKED_OUT, NOT_CHECKED_IN)

### Manual Check-in/out

- [ ] E6 screen shows a "Manual Check-in" button per worker in APPROVED or CONFIRMED status
- [ ] `POST /api/applications/:id/manual-checkin` requires employer auth (shift owner) or admin auth
- [ ] On success: application → CHECKED_IN, checked_in_at set, checkin_event created with source = 'MANUAL', scanned_by_user_id = caller's user_id
- [ ] E6 screen shows a "Manual Check-out" button per worker in CHECKED_IN status
- [ ] `POST /api/applications/:id/manual-checkout` requires employer auth (shift owner) or admin auth
- [ ] On success: application → CHECKED_OUT, checked_out_at set, checkin_event created with source = 'MANUAL', scanned_by_user_id = caller's user_id
- [ ] Manual check-in/out respects the same time windows as QR (but employer/admin can use admin override endpoint to bypass if needed)

### SOS Fill

- [ ] Employer can trigger SOS on any PUBLISHED shift with slots_filled < slots_total
- [ ] `POST /api/shifts/:id/sos` creates an sos_broadcasts row and enqueues notification records for all eligible workers within 1 API request cycle
- [ ] Eligible = role_tag match AND worker distance ≤ radius_km AND trust_score ≥ sos_broadcasts.min_trust AND no existing application for this shift AND is_active = true
- [ ] Notification records are created in DB (third-party SMS/push delivery timing is not guaranteed)
- [ ] If sos_auto_approve = true: applications from SOS-eligible workers are auto-approved (status = APPROVED, is_sos = true, is_backup = false) up to remaining slots
- [ ] SOS badge visible on shift cards in W2 feed when shift.sos_status = 'ACTIVE'
- [ ] `expireSOS` cron sets sos_status = EXPIRED for shifts that reached start_time

### Backup Workers

- [ ] Employer can approve a worker as backup: `PATCH /api/applications/:id/status` with `{ "status": "APPROVED", "is_backup": true }` — no slots_total check
- [ ] Backup-approved workers are NOT counted in slots_filled
- [ ] Backup workers are NOT sent confirmation requests by `requestConfirmations` cron
- [ ] Backup workers are NOT transitioned to UNCONFIRMED by `flagUnconfirmed` cron
- [ ] Backup workers are NOT transitioned to NO_SHOW by `flagNoShows` cron
- [ ] Employer can promote a backup via `POST /api/applications/:id/promote-backup` → sets is_backup = false, increments slots_filled, notifies worker
- [ ] Promotion returns HTTP 409 if slots_filled >= slots_total
- [ ] After promotion, if confirmation window is open, a confirmation request notification is immediately created
- [ ] Backup workers appear in a separate "Backup" section on E5/E6 screens

### Trust Engine

- [ ] New workers are created with trust_score = 5.00
- [ ] `recalcTrustScore` is called after NO_SHOW, CANCELLED_BY_WORKER, and RATED transitions
- [ ] `recalcTrustScore` is NOT called after auto-checkout or CANCELLED_BY_SYSTEM
- [ ] `total_assigned_shifts` denominator excludes PENDING, REJECTED, and CANCELLED_BY_SYSTEM
- [ ] Workers with < 3 completed shifts (CHECKED_OUT or RATED) have trust_score floored at 4.00
- [ ] Workers with trust_score < 1.5 trigger a LOW_TRUST incident (if no OPEN/IN_REVIEW one exists)
- [ ] Workers with trust_score < shift.min_trust_score receive HTTP 403 when applying
- [ ] Admin manual trust adjustment stores value directly without running formula

### Admin / Incidents

- [ ] Incidents are auto-created by: flagNoShows (NO_SHOW), autoCreateLowTrustIncidents (LOW_TRUST), autoCompleteShifts with unfilled slots (SHIFT_UNFILLED), shift cancellation with affected workers (SHIFT_UNFILLED)
- [ ] Admin can create incidents manually via `POST /api/admin/incidents`
- [ ] `GET /api/admin/incidents` returns incidents filterable by status, incident_type, severity
- [ ] Admin can assign via `POST /api/admin/incidents/:id/assign` → status = IN_REVIEW, assigned_admin_id set
- [ ] Admin can resolve via `POST /api/admin/incidents/:id/resolve` with resolution_notes → status = RESOLVED or DISMISSED, resolved_at set
- [ ] Admin can override any application status via `PATCH /api/admin/applications/:id/override` (bypasses transition rules; logged in admin_actions)
- [ ] Admin can override any shift status via `PATCH /api/admin/shifts/:id/override` — this is the only way to end an IN_PROGRESS shift early; logged in admin_actions
- [ ] Admin can suspend/unsuspend a user; suspended users (is_active = false) cannot log in or apply to shifts
- [ ] Every admin action creates a row in admin_actions

### RTL / Hebrew / Localization

- [ ] All page layouts use CSS `direction: rtl`; verified by: text inputs are right-aligned, form labels appear to the right of inputs, navigation sidebar/header items flow right-to-left
- [ ] All user-facing UI strings are in Hebrew; admin screens support English toggle
- [ ] Date/time inputs and displays use DD/MM/YYYY format and 24h clock
- [ ] Currency displays use ₪ symbol (e.g., "₪45/שעה")
- [ ] Form validation error messages are in Hebrew
- [ ] QR scan error messages are in Hebrew (mapped from error codes in §8.4.1)
- [ ] Worker screens (W1-W8) render without horizontal overflow on viewports 320px-428px wide

---

## 12. Pilot Metrics

### Primary (Week 1-4)

| Metric | Target | Source query |
|---|---|---|
| Shift fill rate | ≥ 70% | `AVG(slots_filled / slots_total) WHERE status IN ('COMPLETED', 'IN_PROGRESS')` |
| Worker show-up rate | ≥ 85% | `COUNT(status IN ('CHECKED_IN','CHECKED_OUT','RATED')) / COUNT(status IN ('CONFIRMED','NO_SHOW','CHECKED_IN','CHECKED_OUT','RATED'))` per shift |
| Time to fill (avg) | < 24h | `AVG(last_approval_time - shift.created_at) for COMPLETED shifts` |
| SOS fill rate | ≥ 50% | `AVG(sos_broadcasts.filled_count / sos_broadcasts.slots_needed)` |
| Employer retention | ≥ 3 shifts/employer/month | `COUNT(shifts) GROUP BY employer_id` |

### Secondary

| Metric | Target | Source query |
|---|---|---|
| Worker activation | ≥ 60% complete 1+ shift | `COUNT(DISTINCT worker_id WHERE status IN ('CHECKED_OUT','RATED')) / COUNT(worker_profiles)` |
| QR check-in success rate | ≥ 95% | `checkin_events WHERE source='QR' / total POST /api/checkin/scan calls (200 vs 400 responses)` |
| Avg employer rating | ≥ 3.5 | `AVG(ratings.score)` |
| Late cancellation rate | < 10% | `COUNT(CANCELLED_BY_WORKER WHERE cancelled_at >= start_time - 4h) / total_assigned` |
| Admin intervention rate | < 5% | `COUNT(DISTINCT related_shift_id FROM incidents WHERE status='RESOLVED') / COUNT(shifts WHERE status='COMPLETED')` |

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Workers don't confirm attendance → empty shifts | High | SOS fallback, backup worker system, UNCONFIRMED → slots_filled decremented so SOS/backup can act |
| QR scanning fails (bad camera, lighting) | Medium | Dedicated manual check-in/out endpoints on E6 |
| Low initial worker supply | High | Seed pilot with known worker pool, employer invites workers directly |
| Employers game ratings to blacklist workers | Medium | Admin monitoring via incidents, require comment with ratings ≤ 2 |
| SMS costs for OTP + notifications | Low | Rate limit OTP (max 3/hour/phone), batch notifications, move to push post-MVP |
| Trust score cold-start inaccuracy | Low | First-3-shifts protection floor at 4.0, admin can override |

---

## 14. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Project setup: Next.js + Supabase + Tailwind (RTL configured via `dir="rtl"`)
- DB schema migration (all tables including incidents, checkin_events with source field)
- Auth flow (phone OTP)
- User registration (employer + worker profiles)
- Basic layout shells for all 3 roles
- i18n setup (Hebrew strings file)

### Phase 2: Core Shift Flow (Week 3-4)
- Shift CRUD (create, edit, publish, cancel with bulk-cancel side effects)
- Worker shift feed with filters (role, date, distance)
- Application flow (apply, approve active, approve backup, reject)
- Overlap check on application creation
- Employer dashboard (E2)
- Notification system (in-app table + polling)

### Phase 3: Attendance & Check-in (Week 5)
- Confirmation request cron + worker confirm UI
- QR code generation (employer) + scanner (worker)
- Check-in/out recording with source field + validation per §8.4.1
- Manual check-in/out endpoints + E6 buttons
- Live shift attendance view (E6) with Supabase Realtime
- slots_filled increment/decrement logic per §7

### Phase 4: Trust, SOS & Backup (Week 6)
- Trust score calculation with §9.2 queries + first-3-shifts protection
- Trust display on worker cards
- SOS broadcast trigger + eligible worker query + auto-approve
- Backup worker promotion flow with slots_filled update
- Backup notification chain

### Phase 5: Admin & Incidents (Week 7)
- Incidents table + auto-creation crons (NO_SHOW, LOW_TRUST, SHIFT_UNFILLED)
- Admin incidents dashboard (A1) with filters, assign, resolve
- Admin intervention tools (override, suspend, trust adjust)
- Admin action logging
- All remaining cron jobs (cancelUnconfirmedAtStart, autoCompleteShifts, expireSOS)

### Phase 6: Polish & Pilot (Week 8)
- RTL polish pass (all screens, viewport 320-428px)
- Hebrew string review
- Error handling + edge cases
- SMS integration for critical notifications (OTP, SOS, confirmation)
- Seed data for demo
- Deploy to production
- Onboard 2-3 pilot employers
- Monitor metrics

---

## 15. Tech Stack Summary

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | SSR, RTL support, fast dev |
| UI Components | shadcn/ui + custom RTL adjustments | Accessible, composable |
| Backend | Next.js API Routes (Route Handlers) | Co-located with frontend |
| Database | Supabase (PostgreSQL) | Auth, DB, Realtime in one |
| Auth | Supabase Auth (phone OTP) | Built-in phone auth |
| File Storage | Supabase Storage | Avatars, logos |
| QR Generation | `qrcode` npm package | Simple, client-side |
| QR Scanning | `html5-qrcode` npm package | Camera-based, mobile-friendly |
| SMS | TBD (see Open Decisions) | — |
| Hosting | Vercel | Zero-config Next.js deploys |
| Cron Jobs | Vercel Cron / Supabase pg_cron | Scheduled background tasks |

---

## 16. File / Folder Structure

```
/app
  /(auth)
    /login/page.tsx
    /register/page.tsx
  /(worker)
    /shifts/page.tsx              # W2: Shift feed
    /shifts/[id]/page.tsx         # W3: Shift details
    /my-shifts/page.tsx           # W4: My shifts
    /scan/page.tsx                # W6: QR scanner
    /profile/page.tsx             # W7: Profile
    /notifications/page.tsx       # W8: Notifications
  /(employer)
    /dashboard/page.tsx           # E2: Dashboard
    /shifts/page.tsx              # E3: Shift list
    /shifts/new/page.tsx          # E4: Create shift
    /shifts/[id]/page.tsx         # E5: Shift detail
    /shifts/[id]/live/page.tsx    # E6: Live shift view
    /shifts/[id]/qr/page.tsx     # E7: QR display
    /shifts/[id]/rate/page.tsx   # E8: Rate workers
    /workers/[id]/page.tsx       # E9: Worker profile view
  /(admin)
    /incidents/page.tsx           # A1: Incidents dashboard
    /users/page.tsx               # A2: User management
    /users/[id]/page.tsx          # A4: Trust editor
    /shifts/[id]/page.tsx         # A3: Shift override
    /log/page.tsx                 # A5: Action log
/api
  /auth/send-otp/route.ts
  /auth/verify-otp/route.ts
  /auth/register/route.ts
  /auth/me/route.ts
  /shifts/route.ts
  /shifts/[id]/route.ts
  /shifts/[id]/status/route.ts
  /shifts/[id]/sos/route.ts
  /shifts/[id]/qr/route.ts
  /shifts/[id]/apply/route.ts
  /shifts/[id]/applications/route.ts
  /shifts/[id]/attendance/route.ts
  /shifts/employer/dashboard/route.ts
  /applications/[id]/status/route.ts
  /applications/[id]/confirm/route.ts
  /applications/[id]/cancel/route.ts
  /applications/[id]/rate/route.ts
  /applications/[id]/promote-backup/route.ts
  /applications/[id]/manual-checkin/route.ts
  /applications/[id]/manual-checkout/route.ts
  /checkin/scan/route.ts
  /notifications/route.ts
  /notifications/[id]/read/route.ts
  /workers/[id]/route.ts
  /workers/[id]/ratings/route.ts
  /worker/applications/route.ts
  /admin/incidents/route.ts
  /admin/incidents/[id]/route.ts
  /admin/incidents/[id]/assign/route.ts
  /admin/incidents/[id]/resolve/route.ts
  /admin/users/route.ts
  /admin/users/[id]/suspend/route.ts
  /admin/users/[id]/trust/route.ts
  /admin/applications/[id]/override/route.ts
  /admin/shifts/[id]/override/route.ts
  /admin/actions/route.ts
  /cron/request-confirmations/route.ts
  /cron/flag-unconfirmed/route.ts
  /cron/cancel-unconfirmed-at-start/route.ts
  /cron/flag-noshows/route.ts
  /cron/auto-complete/route.ts
  /cron/expire-sos/route.ts
  /cron/low-trust-incidents/route.ts
/lib
  /db.ts
  /auth.ts
  /trust.ts
  /qr.ts
  /notifications.ts
  /sms.ts
  /incidents.ts
  /slots.ts                      # slots_filled increment/decrement logic
  /types.ts
  /constants.ts
  /validators.ts
  /overlap.ts
/components
  /ui/
  /layout/
  /shifts/
  /applications/
  /qr/
  /trust/
  /admin/
  /incidents/
```

---

## 17. Open Decisions Before Build

| # | Decision | Options | Impact if deferred |
|---|---|---|---|
| 1 | SMS provider | Twilio vs. InforUMobile (Israeli) | Blocks OTP + SOS notifications; decide in Phase 1 |
| 2 | PWA vs React Native | PWA (fast, limited camera) vs. Expo RN (better QR, slower build) | Affects QR scanner quality and worker onboarding; decide before Phase 1 |
| 3 | Supabase Realtime scope | E6 only vs. also W4 worker applications | Affects Phase 3 complexity; start with E6-only |
| 4 | QR token expiry window | 5 min (current spec) vs. session-based (one QR per shift) | Shorter = more secure but employer must keep screen active; decide in Phase 3 |
| 5 | Cron execution method | Vercel Cron (HTTP-triggered, max 1/min) vs. Supabase pg_cron (DB-native, more granular) | Affects "every 15 min" jobs; either works for MVP, pick based on deployment |
| 6 | HMAC secret management | Per-shift random secret (current) vs. app-wide signing key | Per-shift is more secure but requires DB lookup on scan; decide in Phase 3 |

---

## 18. Change Summary from v1.1

| # | Change | What was done |
|---|---|---|
| 1 | Fixed UNCONFIRMED→NO_SHOW race | Removed UNCONFIRMED→NO_SHOW transition entirely. UNCONFIRMED workers go to CANCELLED_BY_SYSTEM at shift start. Only APPROVED (non-backup) and CONFIRMED can become NO_SHOW. Updated transition table, cron jobs, acceptance criteria, §5.2.2 |
| 2 | Fixed employer shift cancel scope | Employer can now cancel only DRAFT or PUBLISHED shifts. IN_PROGRESS requires admin override. Added §5.1.1 bulk-cancel side effects table. Updated acceptance criteria with HTTP 403 for IN_PROGRESS cancel attempts |
| 3 | Created manual check-in/out endpoints | Added `POST /api/applications/:id/manual-checkin` and `manual-checkout` with full contracts (§8.4.2, §8.4.3). Removed "calls same scan endpoint" language. Added separate acceptance criteria section for manual check-in/out |
| 4 | Updated checkin_events schema | Added `source VARCHAR(10) CHECK ('QR', 'MANUAL')` and `scanned_by_user_id UUID REFERENCES users(id)`. Updated all checkin_event creation points to specify source and scanned_by |
| 5 | Fixed trust recalc on auto-checkout | Removed auto-checkout as a trust recalculation trigger. Trust recalc now fires only on NO_SHOW, CANCELLED_BY_WORKER, and RATED. Documented rationale in §9.5 |
| 6 | Tightened total_assigned_shifts | Excluded CANCELLED_BY_SYSTEM from denominator (system/employer-caused, not worker's fault). Explicit inclusion list in §9.2 denominator table |
| 7 | Added §7 slots_filled counting rules | New section with explicit table of which statuses count and when slots_filled increments/decrements. Referenced from transition rules, cron jobs, and acceptance criteria |
| 8 | Documented approve-as-backup contract | Added §8.3.1 with exact allowed payloads and guards for `PATCH /api/applications/:id/status` (approve active, approve backup, reject) |
| 9 | Formalized QR scan contract | Added §8.4.1 with complete request/validation/response contract for `POST /api/checkin/scan`, including check_mode semantics, validation order, error codes, and side effects |
| 10 | Added §3 Operational Invariants | New section with 7 invariants that all modules must respect, covering uniqueness, overlap, backup counting, confirmation targeting, NO_SHOW eligibility, incident immutability, and shift cancellation rules |
| — | Structural | Moved Risks out of combined section; added §17 Open Decisions Before Build (capped at 6); renumbered sections for clarity |
