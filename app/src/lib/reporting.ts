// ============================================================
// Joby — Shared reporting helpers (Sprint 6)
//
// All figures produced here are operational ESTIMATES derived from
// existing shift/application/checkin data. They are NOT final payroll,
// invoicing, or accounting records. See CLAUDE.md: Joby is not the
// legal employer — avoid payroll/tax/compliance framing in UI copy.
// ============================================================

export type ReportRange = "today" | "week" | "month";

export function getRangeBounds(range: ReportRange, now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);

  if (range === "today") {
    end.setDate(end.getDate() + 1);
  } else if (range === "week") {
    // Monday-start week
    const dow = start.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - diffToMonday);
    end.setDate(start.getDate() + 7);
  } else {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 1);
  }

  return { start, end };
}

/**
 * Compute worked hours for a single application from its check-in/check-out
 * events. Falls back to the shift's scheduled duration if events are missing
 * (e.g. legacy/seeded data) — kept conservative for estimate purposes.
 */
export function computeHours(
  checkIn: Date | null,
  checkOut: Date | null,
  shiftStart: Date,
  shiftEnd: Date
): number {
  if (checkIn && checkOut) {
    const ms = checkOut.getTime() - checkIn.getTime();
    return ms > 0 ? ms / 3_600_000 : 0;
  }
  const ms = shiftEnd.getTime() - shiftStart.getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

/** Estimated pay for one worked application. */
export function computePay(hours: number, payRate: number, payType: string): number {
  return payType === "fixed" ? payRate : hours * payRate;
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
