// ============================================================
// Joby — Slot management for shifts
// ============================================================

import { db } from "./db";
import { shifts } from "./schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Increment slots_filled for a shift (active approval).
 * Returns false if shift is already full.
 * Uses atomic check: only increments if slots_filled < workers_needed.
 */
export async function incrementSlot(shiftId: string): Promise<boolean> {
  const result = await db
    .update(shifts)
    .set({
      slots_filled: sql`${shifts.slots_filled} + 1`,
      updated_at: sql`now()`,
    })
    .where(
      and(
        eq(shifts.id, shiftId),
        sql`${shifts.slots_filled} < ${shifts.workers_needed}`
      )
    )
    .returning({ slots_filled: shifts.slots_filled });

  return result.length > 0;
}

/**
 * Decrement slots_filled for a shift (cancel active approval).
 */
export async function decrementSlot(shiftId: string): Promise<void> {
  await db
    .update(shifts)
    .set({
      slots_filled: sql`GREATEST(${shifts.slots_filled} - 1, 0)`,
      updated_at: sql`now()`,
    })
    .where(eq(shifts.id, shiftId));
}
