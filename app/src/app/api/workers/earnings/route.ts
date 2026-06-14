import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, checkinEvents } from "@/lib/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { UserRole, PAYABLE_STATUSES } from "@/lib/constants";
import { reportRangeSchema } from "@/lib/validators";
import { getRangeBounds, computeHours, computePay, type ReportRange } from "@/lib/reporting";

// GET /api/workers/earnings?range=today|week|month
// Worker-facing earnings/payment-status visibility. Figures are current
// operational estimates, not a final payslip.
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const parsed = reportRangeSchema.safeParse({ range: req.nextUrl.searchParams.get("range") || undefined });
  const range: ReportRange = parsed.success ? parsed.data.range : "today";
  const { start, end } = getRangeBounds(range);

  const completedApps = await db
    .select({
      app_id: applications.id,
      shift_id: applications.shift_id,
      shift_title: shifts.title,
      payment_status: applications.payment_status,
      pay_rate: shifts.pay_rate,
      pay_type: shifts.pay_type,
      start_at: shifts.start_at,
      end_at: shifts.end_at,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        eq(applications.worker_id, user.id),
        inArray(applications.status, PAYABLE_STATUSES),
        gte(shifts.start_at, start),
        lt(shifts.start_at, end)
      )
    )
    .orderBy(shifts.start_at);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (completedApps.length === 0) {
    return NextResponse.json({
      range,
      totals: { shifts_completed: 0, hours_worked: 0, estimated_earnings: 0 },
      shifts: [],
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

  let totalHours = 0;
  let totalEarnings = 0;
  const shiftRows = completedApps.map((a) => {
    const ev = eventsByApp.get(a.app_id) || { checkIn: null, checkOut: null };
    const shiftStart = new Date(a.start_at);
    const shiftEnd = new Date(a.end_at);
    const hours = computeHours(ev.checkIn, ev.checkOut, shiftStart, shiftEnd);
    const pay = computePay(hours, Number(a.pay_rate), a.pay_type);
    totalHours += hours;
    totalEarnings += pay;
    return {
      application_id: a.app_id,
      shift_id: a.shift_id,
      title: a.shift_title,
      start_at: a.start_at,
      end_at: a.end_at,
      hours: round2(hours),
      estimated_pay: round2(pay),
      payment_status: a.payment_status,
    };
  });

  return NextResponse.json({
    range,
    totals: {
      shifts_completed: completedApps.length,
      hours_worked: round2(totalHours),
      estimated_earnings: round2(totalEarnings),
    },
    shifts: shiftRows,
  });
}
