import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, checkinEvents } from "@/lib/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { UserRole, PAYABLE_STATUSES } from "@/lib/constants";
import { reportRangeSchema } from "@/lib/validators";
import { getRangeBounds, computeHours, computePay, dateKey, type ReportRange } from "@/lib/reporting";

// GET /api/employers/reports?range=today|week|month
// Operational workforce + cost reporting for the employer's own shifts.
// All totals are current operational ESTIMATES, not final payroll/accounting.
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.EMPLOYER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const parsed = reportRangeSchema.safeParse({ range: req.nextUrl.searchParams.get("range") || undefined });
  const range: ReportRange = parsed.success ? parsed.data.range : "today";
  const { start, end } = getRangeBounds(range);

  const completedApps = await db
    .select({
      app_id: applications.id,
      worker_id: applications.worker_id,
      shift_id: applications.shift_id,
      shift_title: shifts.title,
      pay_rate: shifts.pay_rate,
      pay_type: shifts.pay_type,
      start_at: shifts.start_at,
      end_at: shifts.end_at,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        eq(shifts.employer_id, user.id),
        inArray(applications.status, PAYABLE_STATUSES),
        gte(shifts.start_at, start),
        lt(shifts.start_at, end)
      )
    );

  if (completedApps.length === 0) {
    return NextResponse.json({
      range,
      totals: { unique_workers: 0, completed_shifts: 0, total_hours: 0, estimated_pay: 0 },
      by_worker: [],
      by_day: [],
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
  const workerRows = await db
    .select({ id: users.id, full_name: users.full_name })
    .from(users)
    .where(inArray(users.id, workerIds));
  const workerNames = new Map(workerRows.map((w) => [w.id, w.full_name]));

  let totalHours = 0;
  let totalPay = 0;
  const byWorker = new Map<string, { worker_id: string; full_name: string; shifts: number; hours: number; estimated_pay: number }>();
  const byDay = new Map<string, { date: string; shifts: number; hours: number; estimated_pay: number }>();

  for (const a of completedApps) {
    const ev = eventsByApp.get(a.app_id) || { checkIn: null, checkOut: null };
    const shiftStart = new Date(a.start_at);
    const shiftEnd = new Date(a.end_at);
    const hours = computeHours(ev.checkIn, ev.checkOut, shiftStart, shiftEnd);
    const pay = computePay(hours, Number(a.pay_rate), a.pay_type);

    totalHours += hours;
    totalPay += pay;

    const workerEntry = byWorker.get(a.worker_id) || {
      worker_id: a.worker_id,
      full_name: workerNames.get(a.worker_id) || "",
      shifts: 0,
      hours: 0,
      estimated_pay: 0,
    };
    workerEntry.shifts += 1;
    workerEntry.hours += hours;
    workerEntry.estimated_pay += pay;
    byWorker.set(a.worker_id, workerEntry);

    const day = dateKey(shiftStart);
    const dayEntry = byDay.get(day) || { date: day, shifts: 0, hours: 0, estimated_pay: 0 };
    dayEntry.shifts += 1;
    dayEntry.hours += hours;
    dayEntry.estimated_pay += pay;
    byDay.set(day, dayEntry);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return NextResponse.json({
    range,
    totals: {
      unique_workers: workerIds.length,
      completed_shifts: completedApps.length,
      total_hours: round2(totalHours),
      estimated_pay: round2(totalPay),
    },
    by_worker: Array.from(byWorker.values())
      .map((w) => ({ ...w, hours: round2(w.hours), estimated_pay: round2(w.estimated_pay) }))
      .sort((a, b) => b.estimated_pay - a.estimated_pay),
    by_day: Array.from(byDay.values())
      .map((d) => ({ ...d, hours: round2(d.hours), estimated_pay: round2(d.estimated_pay) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
}
