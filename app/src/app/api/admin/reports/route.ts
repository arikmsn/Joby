import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, employerProfiles, checkinEvents } from "@/lib/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { UserRole, PAYABLE_STATUSES, Config } from "@/lib/constants";
import { reportRangeSchema } from "@/lib/validators";
import { getRangeBounds, computeHours, computePay, type ReportRange } from "@/lib/reporting";

// GET /api/admin/reports?range=today|month
// Platform-wide operational + financial overview. All financial figures are
// internal estimates derived from a parameterized platform fee
// (Config.PLATFORM_FEE_PERCENT) — not a real billing engine, invoice, or
// payroll record.
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const rangeParam = req.nextUrl.searchParams.get("range") || undefined;
  const parsed = reportRangeSchema.safeParse({ range: rangeParam === "month" ? "month" : "today" });
  const range: ReportRange = parsed.success ? parsed.data.range : "today";
  const { start, end } = getRangeBounds(range);

  const completedApps = await db
    .select({
      app_id: applications.id,
      worker_id: applications.worker_id,
      shift_id: applications.shift_id,
      employer_id: shifts.employer_id,
      pay_rate: shifts.pay_rate,
      pay_type: shifts.pay_type,
      start_at: shifts.start_at,
      end_at: shifts.end_at,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        inArray(applications.status, PAYABLE_STATUSES),
        gte(shifts.start_at, start),
        lt(shifts.start_at, end)
      )
    );

  const feePercent = Config.PLATFORM_FEE_PERCENT;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (completedApps.length === 0) {
    return NextResponse.json({
      range,
      fee_percent: feePercent,
      totals: {
        workers_worked: 0,
        employers_active: 0,
        total_hours: 0,
        estimated_worker_payout: 0,
        estimated_employer_billing: 0,
        estimated_platform_margin: 0,
      },
      by_employer: [],
      by_worker: [],
    });
  }

  const appIds = completedApps.map((a) => a.app_id);
  const events = await db
    .select({
      application_id: checkinEvents.application_id,
      event_type: checkinEvents.event_type,
      created_at: checkinEvents.created_at,
    })
    .from(checkinEvents)
    .where(inArray(checkinEvents.application_id, appIds));

  const eventsByApp = new Map<string, { checkIn: Date | null; checkOut: Date | null }>();
  for (const e of events) {
    const entry = eventsByApp.get(e.application_id) || { checkIn: null, checkOut: null };
    if (e.event_type === "CHECK_IN") entry.checkIn = new Date(e.created_at!);
    if (e.event_type === "CHECK_OUT") entry.checkOut = new Date(e.created_at!);
    eventsByApp.set(e.application_id, entry);
  }

  const workerIds = Array.from(new Set(completedApps.map((a) => a.worker_id)));
  const employerIds = Array.from(new Set(completedApps.map((a) => a.employer_id)));

  const [workerRows, employerRows] = await Promise.all([
    db.select({ id: users.id, full_name: users.full_name }).from(users).where(inArray(users.id, workerIds)),
    db
      .select({ id: employerProfiles.user_id, business_name: employerProfiles.business_name })
      .from(employerProfiles)
      .where(inArray(employerProfiles.user_id, employerIds)),
  ]);
  const workerNames = new Map(workerRows.map((w) => [w.id, w.full_name]));
  const employerNames = new Map(employerRows.map((e) => [e.id, e.business_name]));

  let totalHours = 0;
  let totalPayout = 0;
  const byEmployer = new Map<
    string,
    { employer_id: string; business_name: string; workers: Set<string>; shifts: number; hours: number; estimated_payout: number }
  >();
  const byWorker = new Map<string, { worker_id: string; full_name: string; shifts: number; hours: number; estimated_payout: number }>();

  for (const a of completedApps) {
    const ev = eventsByApp.get(a.app_id) || { checkIn: null, checkOut: null };
    const shiftStart = new Date(a.start_at);
    const shiftEnd = new Date(a.end_at);
    const hours = computeHours(ev.checkIn, ev.checkOut, shiftStart, shiftEnd);
    const pay = computePay(hours, Number(a.pay_rate), a.pay_type);

    totalHours += hours;
    totalPayout += pay;

    const empEntry = byEmployer.get(a.employer_id) || {
      employer_id: a.employer_id,
      business_name: employerNames.get(a.employer_id) || "",
      workers: new Set<string>(),
      shifts: 0,
      hours: 0,
      estimated_payout: 0,
    };
    empEntry.workers.add(a.worker_id);
    empEntry.shifts += 1;
    empEntry.hours += hours;
    empEntry.estimated_payout += pay;
    byEmployer.set(a.employer_id, empEntry);

    const workerEntry = byWorker.get(a.worker_id) || {
      worker_id: a.worker_id,
      full_name: workerNames.get(a.worker_id) || "",
      shifts: 0,
      hours: 0,
      estimated_payout: 0,
    };
    workerEntry.shifts += 1;
    workerEntry.hours += hours;
    workerEntry.estimated_payout += pay;
    byWorker.set(a.worker_id, workerEntry);
  }

  const totalBilling = totalPayout * (1 + feePercent / 100);
  const totalMargin = totalBilling - totalPayout;

  return NextResponse.json({
    range,
    fee_percent: feePercent,
    totals: {
      workers_worked: workerIds.length,
      employers_active: employerIds.length,
      total_hours: round2(totalHours),
      estimated_worker_payout: round2(totalPayout),
      estimated_employer_billing: round2(totalBilling),
      estimated_platform_margin: round2(totalMargin),
    },
    by_employer: Array.from(byEmployer.values())
      .map((e) => {
        const billing = e.estimated_payout * (1 + feePercent / 100);
        return {
          employer_id: e.employer_id,
          business_name: e.business_name,
          unique_workers: e.workers.size,
          shifts: e.shifts,
          hours: round2(e.hours),
          estimated_billed: round2(billing),
          estimated_payout: round2(e.estimated_payout),
          estimated_platform_remainder: round2(billing - e.estimated_payout),
        };
      })
      .sort((a, b) => b.estimated_billed - a.estimated_billed),
    by_worker: Array.from(byWorker.values())
      .map((w) => ({ ...w, hours: round2(w.hours), estimated_payout: round2(w.estimated_payout) }))
      .sort((a, b) => b.estimated_payout - a.estimated_payout),
  });
}
