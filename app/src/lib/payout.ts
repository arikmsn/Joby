// ============================================================
// Joby — Payout service (centralized payout business rules)
//
// All payout eligibility, fee calculation, ledger creation,
// duplicate prevention, and audit logic lives here. No real money
// movement — this module prepares internal bookkeeping only.
// ============================================================

import { db } from "@/lib/db";
import {
  applications,
  shifts,
  users,
  workerProfiles,
  payoutLedger,
  payoutBatches,
  checkinEvents,
} from "@/lib/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { PAYABLE_STATUSES, Config, PaymentStatus } from "@/lib/constants";
import { computeHours, computePay } from "@/lib/reporting";

// ── Types ───────────────────────────────────────────────────

export interface CalculationSnapshot {
  duration_source: "actual" | "scheduled";
  check_in_at: string | null;
  check_out_at: string | null;
  shift_start_at: string;
  shift_end_at: string;
  duration_hours: number;
  pay_type: string;
  pay_rate: number;
  gross_amount: number;
  fee_percent: number;
  platform_fee: number;
  net_amount: number;
  warnings: string[];
}

export interface EligibleItem {
  application_id: string;
  worker_id: string;
  shift_id: string;
  pay_rate: number;
  pay_type: string;
  start_at: Date;
  end_at: Date;
}

export interface PrepareResult {
  created: number;
  skipped: number;
  batch_id: string | null;
  total_gross: number;
  total_fees: number;
  total_net: number;
  total_warnings: number;
  audit_note: string;
}

// ── Fee calculation ─────────────────────────────────────────

export function calculateFee(grossAmount: number): {
  platform_fee: number;
  net_amount: number;
} {
  const feeRate = Config.PLATFORM_FEE_PERCENT / 100;
  const platform_fee = Math.round(grossAmount * feeRate * 100) / 100;
  const net_amount = Math.round((grossAmount - platform_fee) * 100) / 100;
  return { platform_fee, net_amount };
}

// ── Guardrails ──────────────────────────────────────────────

function checkWarnings(
  checkIn: Date | null,
  checkOut: Date | null,
  shiftStart: Date,
  shiftEnd: Date,
  hours: number,
  gross: number
): string[] {
  const warnings: string[] = [];

  if (!checkIn || !checkOut) {
    warnings.push("NO_ATTENDANCE_DATA");
  }

  if (hours <= 0) {
    warnings.push("ZERO_DURATION");
  }

  if (gross <= 0) {
    warnings.push("ZERO_GROSS");
  }

  if (checkIn && checkOut) {
    const scheduledMs = shiftEnd.getTime() - shiftStart.getTime();
    const actualMs = checkOut.getTime() - checkIn.getTime();
    if (scheduledMs > 0) {
      const ratio = actualMs / scheduledMs;
      if (ratio > 1.5) warnings.push("ACTUAL_MUCH_LONGER_THAN_SCHEDULED");
      if (ratio < 0.5 && ratio > 0) warnings.push("ACTUAL_MUCH_SHORTER_THAN_SCHEDULED");
    }
  }

  return warnings;
}

// ── Eligibility query ───────────────────────────────────────

export async function findEligibleApplications(): Promise<EligibleItem[]> {
  const alreadyLedgered = db
    .select({ application_id: payoutLedger.application_id })
    .from(payoutLedger);

  const rows = await db
    .select({
      application_id: applications.id,
      worker_id: applications.worker_id,
      shift_id: applications.shift_id,
      pay_rate: shifts.pay_rate,
      pay_type: shifts.pay_type,
      start_at: shifts.start_at,
      end_at: shifts.end_at,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .innerJoin(
      workerProfiles,
      eq(applications.worker_id, workerProfiles.user_id)
    )
    .where(
      and(
        inArray(applications.status, PAYABLE_STATUSES),
        eq(applications.payment_status, PaymentStatus.APPROVED_FOR_PAYMENT),
        eq(workerProfiles.payout_ready, true),
        sql`${applications.id} NOT IN (${alreadyLedgered})`
      )
    );

  return rows.map((r) => ({
    application_id: r.application_id,
    worker_id: r.worker_id,
    shift_id: r.shift_id,
    pay_rate: Number(r.pay_rate),
    pay_type: r.pay_type,
    start_at: new Date(r.start_at),
    end_at: new Date(r.end_at),
  }));
}

// ── Ledger creation with traceability ───────────────────────

export async function prepareLedgerItems(
  eligible: EligibleItem[],
  options?: { createBatch?: boolean; preparedBy?: string }
): Promise<PrepareResult> {
  if (eligible.length === 0) {
    return { created: 0, skipped: 0, batch_id: null, total_gross: 0, total_fees: 0, total_net: 0, total_warnings: 0, audit_note: "No eligible items" };
  }

  const appIds = eligible.map((e) => e.application_id);
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

  let batchId: string | null = null;
  let totalGross = 0;
  let totalFees = 0;
  let totalNet = 0;
  let totalWarnings = 0;

  if (options?.createBatch) {
    const today = new Date().toISOString().slice(0, 10);
    const [batch] = await db
      .insert(payoutBatches)
      .values({
        batch_date: today,
        status: "PREPARED",
        items_count: 0,
        prepared_by: options.preparedBy || null,
      })
      .returning({ id: payoutBatches.id });
    batchId = batch.id;
  }

  const ledgerRows: {
    worker_id: string;
    application_id: string;
    shift_id: string;
    gross_amount: string;
    platform_fee: string;
    net_amount: string;
    status: string;
    batch_id: string | null;
    calculation: CalculationSnapshot;
  }[] = [];

  for (const item of eligible) {
    const ev = eventsByApp.get(item.application_id) || { checkIn: null, checkOut: null };
    const hours = computeHours(ev.checkIn, ev.checkOut, item.start_at, item.end_at);
    const gross = computePay(hours, item.pay_rate, item.pay_type);
    const { platform_fee, net_amount } = calculateFee(gross);
    const warnings = checkWarnings(ev.checkIn, ev.checkOut, item.start_at, item.end_at, hours, gross);

    totalGross += gross;
    totalFees += platform_fee;
    totalNet += net_amount;
    totalWarnings += warnings.length;

    const calc: CalculationSnapshot = {
      duration_source: ev.checkIn && ev.checkOut ? "actual" : "scheduled",
      check_in_at: ev.checkIn?.toISOString() || null,
      check_out_at: ev.checkOut?.toISOString() || null,
      shift_start_at: item.start_at.toISOString(),
      shift_end_at: item.end_at.toISOString(),
      duration_hours: Math.round(hours * 100) / 100,
      pay_type: item.pay_type,
      pay_rate: item.pay_rate,
      gross_amount: Math.round(gross * 100) / 100,
      fee_percent: Config.PLATFORM_FEE_PERCENT,
      platform_fee: platform_fee,
      net_amount: net_amount,
      warnings,
    };

    ledgerRows.push({
      worker_id: item.worker_id,
      application_id: item.application_id,
      shift_id: item.shift_id,
      gross_amount: gross.toFixed(2),
      platform_fee: platform_fee.toFixed(2),
      net_amount: net_amount.toFixed(2),
      status: "PENDING",
      batch_id: batchId,
      calculation: calc,
    });
  }

  let created = 0;
  let skipped = 0;

  for (const row of ledgerRows) {
    try {
      await db.insert(payoutLedger).values(row);
      created++;
    } catch {
      skipped++;
    }
  }

  const auditNote = `Prepared by ${options?.preparedBy || "system"} at ${new Date().toISOString()}: ${created} created, ${skipped} skipped, ${totalWarnings} warnings. Gross: ${totalGross.toFixed(2)}, Fees: ${totalFees.toFixed(2)}, Net: ${totalNet.toFixed(2)}`;

  if (batchId) {
    await db
      .update(payoutBatches)
      .set({
        items_count: created,
        total_gross: totalGross.toFixed(2),
        total_fees: totalFees.toFixed(2),
        total_net: totalNet.toFixed(2),
        warnings_count: totalWarnings,
        notes: auditNote,
      })
      .where(eq(payoutBatches.id, batchId));
  }

  if (created > 0) {
    const createdAppIds = eligible
      .filter((_, i) => i < created + skipped)
      .map((e) => e.application_id)
      .slice(0, created);
    if (createdAppIds.length > 0) {
      await db
        .update(applications)
        .set({ payment_status: PaymentStatus.PAYABLE })
        .where(inArray(applications.id, createdAppIds));
    }
  }

  return {
    created,
    skipped,
    batch_id: batchId,
    total_gross: Math.round(totalGross * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    total_net: Math.round(totalNet * 100) / 100,
    total_warnings: totalWarnings,
    audit_note: auditNote,
  };
}

// ── Payout readiness summary ────────────────────────────────

export interface ReadinessSummary {
  total_workers: number;
  payout_ready: number;
  not_ready: number;
  ready_workers: { user_id: string; full_name: string }[];
  not_ready_workers: { user_id: string; full_name: string; missing: string[] }[];
}

export async function getPayoutReadinessSummary(): Promise<ReadinessSummary> {
  const rows = await db
    .select({
      user_id: workerProfiles.user_id,
      full_name: sql<string>`(SELECT full_name FROM users WHERE id = ${workerProfiles.user_id})`,
      payout_ready: workerProfiles.payout_ready,
      payout_legal_name: workerProfiles.payout_legal_name,
      payout_id_number: workerProfiles.payout_id_number,
      payout_bank_name: workerProfiles.payout_bank_name,
      payout_bank_branch: workerProfiles.payout_bank_branch,
      payout_account_number: workerProfiles.payout_account_number,
      payout_account_holder: workerProfiles.payout_account_holder,
      supplier_type: workerProfiles.supplier_type,
      tax_id: workerProfiles.tax_id,
    })
    .from(workerProfiles);

  const ready: ReadinessSummary["ready_workers"] = [];
  const notReady: ReadinessSummary["not_ready_workers"] = [];

  for (const r of rows) {
    if (r.payout_ready) {
      ready.push({ user_id: r.user_id, full_name: r.full_name });
    } else {
      const missing: string[] = [];
      if (!r.payout_legal_name) missing.push("legal_name");
      if (!r.payout_id_number) missing.push("id_number");
      if (!r.payout_bank_name || !r.payout_bank_branch || !r.payout_account_number || !r.payout_account_holder) {
        missing.push("bank_details");
      }
      if (!r.supplier_type) missing.push("supplier_type");
      if ((r.supplier_type === "freelancer_licensed" || r.supplier_type === "company") && !r.tax_id) {
        missing.push("tax_id");
      }
      notReady.push({ user_id: r.user_id, full_name: r.full_name, missing });
    }
  }

  return {
    total_workers: rows.length,
    payout_ready: ready.length,
    not_ready: notReady.length,
    ready_workers: ready,
    not_ready_workers: notReady,
  };
}

// ── Ledger summary ──────────────────────────────────────────

export interface LedgerSummary {
  total_items: number;
  by_status: Record<string, number>;
  total_gross: number;
  total_fees: number;
  total_net: number;
  total_warnings: number;
  recent_items: {
    id: string;
    worker_id: string;
    worker_name: string;
    application_id: string;
    gross_amount: number;
    net_amount: number;
    status: string;
    batch_id: string | null;
    has_warnings: boolean;
    calculation: CalculationSnapshot | null;
    created_at: string;
  }[];
  batches: {
    id: string;
    batch_date: string;
    status: string;
    items_count: number;
    total_gross: number;
    total_net: number;
    warnings_count: number;
    notes: string | null;
    created_at: string;
  }[];
}

export async function getLedgerSummary(): Promise<LedgerSummary> {
  const items = await db
    .select({
      id: payoutLedger.id,
      worker_id: payoutLedger.worker_id,
      application_id: payoutLedger.application_id,
      gross_amount: payoutLedger.gross_amount,
      platform_fee: payoutLedger.platform_fee,
      net_amount: payoutLedger.net_amount,
      status: payoutLedger.status,
      batch_id: payoutLedger.batch_id,
      calculation: payoutLedger.calculation,
      created_at: payoutLedger.created_at,
    })
    .from(payoutLedger)
    .orderBy(sql`${payoutLedger.created_at} DESC`)
    .limit(100);

  const workerIds = Array.from(new Set(items.map((i) => i.worker_id)));
  let workerNames = new Map<string, string>();
  if (workerIds.length > 0) {
    const nameRows = await db
      .select({ id: users.id, full_name: users.full_name })
      .from(users)
      .where(inArray(users.id, workerIds));
    workerNames = new Map(nameRows.map((n) => [n.id, n.full_name]));
  }

  const byStatus: Record<string, number> = {};
  let totalGross = 0;
  let totalFees = 0;
  let totalNet = 0;
  let totalWarnings = 0;

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    totalGross += Number(item.gross_amount);
    totalFees += Number(item.platform_fee);
    totalNet += Number(item.net_amount);
    const calc = item.calculation as CalculationSnapshot | null;
    if (calc?.warnings?.length) totalWarnings += calc.warnings.length;
  }

  const batches = await db
    .select({
      id: payoutBatches.id,
      batch_date: payoutBatches.batch_date,
      status: payoutBatches.status,
      items_count: payoutBatches.items_count,
      total_gross: payoutBatches.total_gross,
      total_net: payoutBatches.total_net,
      warnings_count: payoutBatches.warnings_count,
      notes: payoutBatches.notes,
      provider_name: payoutBatches.provider_name,
      provider_batch_id: payoutBatches.provider_batch_id,
      provider_status: payoutBatches.provider_status,
      created_at: payoutBatches.created_at,
    })
    .from(payoutBatches)
    .orderBy(sql`${payoutBatches.created_at} DESC`)
    .limit(20);

  return {
    total_items: items.length,
    by_status: byStatus,
    total_gross: Math.round(totalGross * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    total_net: Math.round(totalNet * 100) / 100,
    total_warnings: totalWarnings,
    recent_items: items.map((i) => {
      const calc = i.calculation as CalculationSnapshot | null;
      return {
        id: i.id,
        worker_id: i.worker_id,
        worker_name: workerNames.get(i.worker_id) || "",
        application_id: i.application_id,
        gross_amount: Number(i.gross_amount),
        net_amount: Number(i.net_amount),
        status: i.status,
        batch_id: i.batch_id,
        has_warnings: (calc?.warnings?.length ?? 0) > 0,
        calculation: calc,
        created_at: i.created_at ? new Date(i.created_at).toISOString() : "",
      };
    }),
    batches: batches.map((b) => ({
      id: b.id,
      batch_date: b.batch_date,
      status: b.status,
      items_count: b.items_count,
      total_gross: Number(b.total_gross),
      total_net: Number(b.total_net),
      warnings_count: b.warnings_count,
      notes: b.notes,
      provider_name: b.provider_name,
      provider_batch_id: b.provider_batch_id,
      provider_status: b.provider_status,
      created_at: b.created_at ? new Date(b.created_at).toISOString() : "",
    })),
  };
}

// ── Batch detail ────────────────────────────────────────────

export async function getBatchDetail(batchId: string) {
  const [batch] = await db
    .select({
      id: payoutBatches.id,
      batch_date: payoutBatches.batch_date,
      status: payoutBatches.status,
      items_count: payoutBatches.items_count,
      total_gross: payoutBatches.total_gross,
      total_fees: payoutBatches.total_fees,
      total_net: payoutBatches.total_net,
      warnings_count: payoutBatches.warnings_count,
      prepared_by: payoutBatches.prepared_by,
      notes: payoutBatches.notes,
      provider_name: payoutBatches.provider_name,
      provider_batch_id: payoutBatches.provider_batch_id,
      provider_status: payoutBatches.provider_status,
      provider_message: payoutBatches.provider_message,
      submitted_at: payoutBatches.submitted_at,
      confirmed_at: payoutBatches.confirmed_at,
      failed_at: payoutBatches.failed_at,
      created_at: payoutBatches.created_at,
    })
    .from(payoutBatches)
    .where(eq(payoutBatches.id, batchId))
    .limit(1);

  if (!batch) return null;

  let preparedByName = "";
  if (batch.prepared_by) {
    const [u] = await db
      .select({ full_name: users.full_name })
      .from(users)
      .where(eq(users.id, batch.prepared_by))
      .limit(1);
    if (u) preparedByName = u.full_name;
  }

  const items = await db
    .select({
      id: payoutLedger.id,
      worker_id: payoutLedger.worker_id,
      application_id: payoutLedger.application_id,
      shift_id: payoutLedger.shift_id,
      gross_amount: payoutLedger.gross_amount,
      platform_fee: payoutLedger.platform_fee,
      net_amount: payoutLedger.net_amount,
      status: payoutLedger.status,
      calculation: payoutLedger.calculation,
      provider_transfer_id: payoutLedger.provider_transfer_id,
      provider_status: payoutLedger.provider_status,
      provider_message: payoutLedger.provider_message,
      created_at: payoutLedger.created_at,
    })
    .from(payoutLedger)
    .where(eq(payoutLedger.batch_id, batchId))
    .orderBy(sql`${payoutLedger.created_at} DESC`);

  const workerIds = Array.from(new Set(items.map((i) => i.worker_id)));
  let workerNames = new Map<string, string>();
  if (workerIds.length > 0) {
    const nameRows = await db
      .select({ id: users.id, full_name: users.full_name })
      .from(users)
      .where(inArray(users.id, workerIds));
    workerNames = new Map(nameRows.map((n) => [n.id, n.full_name]));
  }

  return {
    ...batch,
    total_gross: Number(batch.total_gross),
    total_fees: Number(batch.total_fees),
    total_net: Number(batch.total_net),
    prepared_by_name: preparedByName,
    submitted_at: batch.submitted_at ? new Date(batch.submitted_at).toISOString() : null,
    confirmed_at: batch.confirmed_at ? new Date(batch.confirmed_at).toISOString() : null,
    failed_at: batch.failed_at ? new Date(batch.failed_at).toISOString() : null,
    created_at: batch.created_at ? new Date(batch.created_at).toISOString() : "",
    items: items.map((i) => {
      const calc = i.calculation as CalculationSnapshot | null;
      return {
        id: i.id,
        worker_id: i.worker_id,
        worker_name: workerNames.get(i.worker_id) || "",
        application_id: i.application_id,
        shift_id: i.shift_id,
        gross_amount: Number(i.gross_amount),
        platform_fee: Number(i.platform_fee),
        net_amount: Number(i.net_amount),
        status: i.status,
        calculation: calc,
        provider_transfer_id: i.provider_transfer_id,
        provider_status: i.provider_status,
        provider_message: i.provider_message,
        created_at: i.created_at ? new Date(i.created_at).toISOString() : "",
      };
    }),
  };
}
