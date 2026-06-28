// ============================================================
// Joby — Payout lifecycle transitions
//
// Explicit state machine for ledger items and batches.
// All payout state mutations go through this module.
// ============================================================

import { db } from "@/lib/db";
import { payoutLedger, payoutBatches, applications } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { LedgerStatus, BatchStatus, PaymentStatus } from "@/lib/constants";

// ── Valid transitions ───────────────────────────────────────

const LEDGER_TRANSITIONS: Record<string, string[]> = {
  [LedgerStatus.PENDING]:   [LedgerStatus.SUBMITTED, LedgerStatus.HELD],
  [LedgerStatus.SUBMITTED]: [LedgerStatus.CONFIRMED, LedgerStatus.FAILED],
  [LedgerStatus.HELD]:      [LedgerStatus.PENDING, LedgerStatus.SUBMITTED],
  [LedgerStatus.FAILED]:    [LedgerStatus.PENDING, LedgerStatus.SUBMITTED],
  [LedgerStatus.CONFIRMED]: [],
};

const BATCH_TRANSITIONS: Record<string, string[]> = {
  [BatchStatus.PREPARED]:               [BatchStatus.SUBMITTED],
  [BatchStatus.SUBMITTED]:              [BatchStatus.CONFIRMED, BatchStatus.FAILED, BatchStatus.PARTIALLY_CONFIRMED],
  [BatchStatus.FAILED]:                 [BatchStatus.PREPARED, BatchStatus.SUBMITTED],
  [BatchStatus.PARTIALLY_CONFIRMED]:    [BatchStatus.CONFIRMED, BatchStatus.FAILED],
  [BatchStatus.CONFIRMED]:              [],
};

export function isValidLedgerTransition(from: string, to: string): boolean {
  return (LEDGER_TRANSITIONS[from] || []).includes(to);
}

export function isValidBatchTransition(from: string, to: string): boolean {
  return (BATCH_TRANSITIONS[from] || []).includes(to);
}

export function getValidLedgerTransitions(from: string): string[] {
  return LEDGER_TRANSITIONS[from] || [];
}

export function getValidBatchTransitions(from: string): string[] {
  return BATCH_TRANSITIONS[from] || [];
}

// ── Ledger item transition ──────────────────────────────────

export interface TransitionResult {
  success: boolean;
  error?: string;
  from: string;
  to: string;
}

export async function transitionLedgerItem(
  itemId: string,
  targetStatus: string,
  opts?: {
    adminId?: string;
    providerTransferId?: string;
    providerStatus?: string;
    providerMessage?: string;
  }
): Promise<TransitionResult> {
  const [item] = await db
    .select({
      status: payoutLedger.status,
      application_id: payoutLedger.application_id,
    })
    .from(payoutLedger)
    .where(eq(payoutLedger.id, itemId))
    .limit(1);

  if (!item) return { success: false, error: "Item not found", from: "", to: targetStatus };

  if (!isValidLedgerTransition(item.status, targetStatus)) {
    return {
      success: false,
      error: `Invalid transition: ${item.status} → ${targetStatus}`,
      from: item.status,
      to: targetStatus,
    };
  }

  const now = new Date();
  const updates: Record<string, unknown> = { status: targetStatus };

  if (opts?.providerTransferId) updates.provider_transfer_id = opts.providerTransferId;
  if (opts?.providerStatus) updates.provider_status = opts.providerStatus;
  if (opts?.providerMessage !== undefined) updates.provider_message = opts.providerMessage;

  if (targetStatus === LedgerStatus.SUBMITTED) {
    updates.submitted_at = now;
  } else if (targetStatus === LedgerStatus.CONFIRMED) {
    updates.confirmed_at = now;
    updates.transferred_at = now;
  } else if (targetStatus === LedgerStatus.FAILED) {
    updates.failed_at = now;
  }

  await db.update(payoutLedger).set(updates).where(eq(payoutLedger.id, itemId));

  // Sync application payment_status
  if (targetStatus === LedgerStatus.SUBMITTED) {
    await db.update(applications)
      .set({ payment_status: PaymentStatus.PAYOUT_PENDING })
      .where(eq(applications.id, item.application_id));
  } else if (targetStatus === LedgerStatus.CONFIRMED) {
    await db.update(applications)
      .set({ payment_status: PaymentStatus.PAID, paid_at: now })
      .where(eq(applications.id, item.application_id));
  } else if (targetStatus === LedgerStatus.FAILED) {
    await db.update(applications)
      .set({ payment_status: PaymentStatus.FAILED })
      .where(eq(applications.id, item.application_id));
  }

  return { success: true, from: item.status, to: targetStatus };
}

// ── Batch transition ────────────────────────────────────────

export async function transitionBatch(
  batchId: string,
  targetStatus: string,
  opts?: {
    adminId?: string;
    providerBatchId?: string;
    providerName?: string;
    providerStatus?: string;
    providerMessage?: string;
    cascadeToItems?: boolean;
  }
): Promise<TransitionResult> {
  const [batch] = await db
    .select({ status: payoutBatches.status })
    .from(payoutBatches)
    .where(eq(payoutBatches.id, batchId))
    .limit(1);

  if (!batch) return { success: false, error: "Batch not found", from: "", to: targetStatus };

  if (!isValidBatchTransition(batch.status, targetStatus)) {
    return {
      success: false,
      error: `Invalid transition: ${batch.status} → ${targetStatus}`,
      from: batch.status,
      to: targetStatus,
    };
  }

  const now = new Date();
  const updates: Record<string, unknown> = { status: targetStatus };

  if (opts?.providerBatchId) updates.provider_batch_id = opts.providerBatchId;
  if (opts?.providerName) updates.provider_name = opts.providerName;
  if (opts?.providerStatus) updates.provider_status = opts.providerStatus;
  if (opts?.providerMessage !== undefined) updates.provider_message = opts.providerMessage;

  if (targetStatus === BatchStatus.SUBMITTED) {
    updates.submitted_at = now;
  } else if (targetStatus === BatchStatus.CONFIRMED) {
    updates.confirmed_at = now;
    updates.transferred_at = now;
  } else if (targetStatus === BatchStatus.FAILED) {
    updates.failed_at = now;
  }

  await db.update(payoutBatches).set(updates).where(eq(payoutBatches.id, batchId));

  // Cascade to ledger items if requested
  if (opts?.cascadeToItems) {
    const items = await db
      .select({ id: payoutLedger.id, status: payoutLedger.status })
      .from(payoutLedger)
      .where(eq(payoutLedger.batch_id, batchId));

    let itemTargetStatus: string | null = null;
    if (targetStatus === BatchStatus.SUBMITTED) itemTargetStatus = LedgerStatus.SUBMITTED;
    else if (targetStatus === BatchStatus.CONFIRMED) itemTargetStatus = LedgerStatus.CONFIRMED;
    else if (targetStatus === BatchStatus.FAILED) itemTargetStatus = LedgerStatus.FAILED;

    if (itemTargetStatus) {
      for (const item of items) {
        if (isValidLedgerTransition(item.status, itemTargetStatus)) {
          await transitionLedgerItem(item.id, itemTargetStatus, {
            adminId: opts.adminId,
            providerStatus: opts.providerStatus,
            providerMessage: opts.providerMessage,
          });
        }
      }
    }
  }

  return { success: true, from: batch.status, to: targetStatus };
}
