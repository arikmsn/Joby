// ============================================================
// Joby — Trust Engine (deterministic, explainable)
// ============================================================
//
// Score range: 0.00 – 5.00
// New workers start at 5.00 (benefit of the doubt).
// First-3-shifts protection: score cannot drop below TRUST_NEW_WORKER_FLOOR
// until the worker has completed at least TRUST_NEW_WORKER_SHIFT_THRESHOLD shifts.
//
// Formula:
//   base = 5.00
//   - noShowPenalty   = noShowRate * 3.0     (heavy: 1 no-show in 5 shifts = -0.60)
//   - lateCancelPenalty = lateCancelRate * 1.5 (lighter: late cancels matter less)
//   + completionBonus  = min(completedShifts * 0.02, 0.50)  (cap at +0.50 for reliability)
//   clamp to [0.00, 5.00]
//   if completedShifts < 3, clamp floor to TRUST_NEW_WORKER_FLOOR
//
// "Late cancel" = CANCELLED_BY_WORKER on an APPROVED application
// where the shift starts within 24 hours of cancellation.
// Since we don't currently store the exact cancel timestamp relative to shift start
// in a queryable way, we approximate: any CANCELLED_BY_WORKER on an approved-stage
// application counts. This is intentionally conservative for MVP.

import { db } from "./db";
import { applications, workerProfiles } from "./schema";
import { eq, and, sql } from "drizzle-orm";
import { Config } from "./constants";

interface TrustInputs {
  totalApplications: number;
  completedShifts: number;   // CHECKED_OUT or RATED
  noShowCount: number;
  cancelByWorkerCount: number;
}

async function getTrustInputs(workerId: string): Promise<TrustInputs> {
  // Single query to count relevant statuses
  const rows = await db
    .select({
      status: applications.status,
    })
    .from(applications)
    .where(
      and(
        eq(applications.worker_id, workerId),
        sql`${applications.status} IN ('CHECKED_OUT', 'RATED', 'NO_SHOW', 'CANCELLED_BY_WORKER')`
      )
    );

  let completedShifts = 0;
  let noShowCount = 0;
  let cancelByWorkerCount = 0;

  for (const row of rows) {
    if (row.status === "CHECKED_OUT" || row.status === "RATED") completedShifts++;
    else if (row.status === "NO_SHOW") noShowCount++;
    else if (row.status === "CANCELLED_BY_WORKER") cancelByWorkerCount++;
  }

  return {
    totalApplications: rows.length,
    completedShifts,
    noShowCount,
    cancelByWorkerCount,
  };
}

function computeScore(inputs: TrustInputs): number {
  const { completedShifts, noShowCount, cancelByWorkerCount } = inputs;
  const totalOutcomes = completedShifts + noShowCount + cancelByWorkerCount;

  if (totalOutcomes === 0) return Config.TRUST_BASE_SCORE;

  const noShowRate = noShowCount / totalOutcomes;
  const cancelRate = cancelByWorkerCount / totalOutcomes;

  let score: number = Config.TRUST_BASE_SCORE;
  score -= noShowRate * 3.0;
  score -= cancelRate * 1.5;
  score += Math.min(completedShifts * 0.02, 0.5);

  // Clamp to [0, 5]
  score = Math.max(0, Math.min(5, score));

  // First-3-shifts protection
  if (completedShifts < Config.TRUST_NEW_WORKER_SHIFT_THRESHOLD) {
    score = Math.max(score, Config.TRUST_NEW_WORKER_FLOOR);
  }

  // Round to 2 decimal places
  return Math.round(score * 100) / 100;
}

/**
 * Recalculate and persist a worker's trust score.
 * Returns the new score.
 */
export async function recalcTrustScore(workerId: string): Promise<number> {
  const inputs = await getTrustInputs(workerId);
  const score = computeScore(inputs);

  await db
    .update(workerProfiles)
    .set({ trust_score: score.toFixed(2) })
    .where(eq(workerProfiles.user_id, workerId));

  // Also update counters for quick access
  await db
    .update(workerProfiles)
    .set({
      total_shifts: inputs.completedShifts,
      no_show_count: inputs.noShowCount,
      cancel_count: inputs.cancelByWorkerCount,
    })
    .where(eq(workerProfiles.user_id, workerId));

  return score;
}
