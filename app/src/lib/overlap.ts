// ============================================================
// Joby — Shift overlap detection
// ============================================================

import { db } from "./db";
import { applications, shifts } from "./schema";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { TERMINAL_STATUSES } from "./constants";

export interface OverlapResult {
  id: string;
  title: string;
}

/**
 * Check if a worker has any non-terminal applications for shifts
 * that overlap with the given time range.
 * Returns the overlapping shift's id and title if found, null otherwise.
 */
export async function findOverlap(
  workerId: string,
  shiftStartAt: Date,
  shiftEndAt: Date,
  excludeShiftId?: string
): Promise<OverlapResult | null> {
  const terminalStatuses = TERMINAL_STATUSES as string[];

  const overlapping = await db
    .select({ id: shifts.id, title: shifts.title })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .where(
      and(
        eq(applications.worker_id, workerId),
        notInArray(applications.status, terminalStatuses),
        // Overlap: existing.start < new.end AND existing.end > new.start
        sql`${shifts.start_at} < ${shiftEndAt.toISOString()}`,
        sql`${shifts.end_at} > ${shiftStartAt.toISOString()}`,
        ...(excludeShiftId
          ? [sql`${shifts.id} != ${excludeShiftId}`]
          : [])
      )
    )
    .limit(1);

  return overlapping.length > 0 ? overlapping[0] : null;
}
