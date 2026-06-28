// ============================================================
// Joby — Payout service (centralized payout business rules)
//
// All payout eligibility, fee calculation, ledger creation, and
// duplicate prevention logic lives here. No real money movement —
// this module prepares internal bookkeeping only.
// ============================================================

import { db } from "@/lib/db";
import {
  applications,
  shifts,
  workerProfiles,
  payoutLedger,
  payoutBatches,
  checkinEvents,
} from "@/lib/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { PAYABLE_STATUSES, Config, PaymentStatus } from "@/lib/constants";
import { computeHours, computePay } from "@/lib/reporting";

// ── Fee calculation ─────────────────────────────────────────
// Centralized platform fee logic. Currently uses a flat percentage
// from Config. When fee tiers, worker-specific rates, or promo
// codes are needed, this is the single place to change.

export function calculateFee(grossAmount: number): {
  platform_fee: number;
  net_amount: number;
} {
  const feeRate = Config.PLATFORM_FEE_PERCENT / 100;
  const platform_fee = Math.round(grossAmount * feeRate * 100) / 100;
  const net_amount = Math.round((grossAmount - platform_fee) * 100) / 100;
  return { platform_fee, net_amount };
}

// ── Eligibility query ───────────────────────────────────────
// Returns completed applications that are eligible to become
// payout ledger items. An application is eligible when:
//   1. Application status is in PAYABLE_STATUSES (CHECKED_OUT or RATED)
//   2. Payment status is APPROVED_FOR_PAYMENT
//   3. Worker is payout_ready (supplier details complete)
//   4. No existing payout_ledger row for this application

export interface EligibleItem {
  application_id: string;
  worker_id: string;
  shift_id: string;
  pay_rate: number;
  pay_type: string;
  start_at: Date;
  end_at: Date;
}

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

// ── Ledger creation ─────────────────────────────────────────
// Creates payout_ledger rows for a set of eligible applications.
// Fetches check-in/check-out events to compute actual hours worked.
// Returns the number of rows created.

export interface PrepareResult {
  created: number;
  skipped: number;
  batch_id: string | null;
  total_gross: number;
  total_fees: number;
  total_net: number;
}

export async function prepareLedgerItems(
  eligible: EligibleItem[],
  options?: { createBatch?: boolean; preparedBy?: string }
): Promise<PrepareResult> {
  if (eligible.length === 0) {
    return { created: 0, skipped: 0, batch_id: null, total_gross: 0, total_fees: 0, total_net: 0 };
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
  }[] = [];

  for (const item of eligible) {
    const ev = eventsByApp.get(item.application_id) || { checkIn: null, checkOut: null };
    const hours = computeHours(ev.checkIn, ev.checkOut, item.start_at, item.end_at);
    const gross = computePay(hours, item.pay_rate, item.pay_type);
    const { platform_fee, net_amount } = calculateFee(gross);

    totalGross += gross;
    totalFees += platform_fee;
    totalNet += net_amount;

    ledgerRows.push({
      worker_id: item.worker_id,
      application_id: item.application_id,
      shift_id: item.shift_id,
      gross_amount: gross.toFixed(2),
      platform_fee: platform_fee.toFixed(2),
      net_amount: net_amount.toFixed(2),
      status: "PENDING",
      batch_id: batchId,
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

  if (batchId && created > 0) {
    await db
      .update(payoutBatches)
      .set({
        items_count: created,
        total_gross: totalGross.toFixed(2),
        total_fees: totalFees.toFixed(2),
        total_net: totalNet.toFixed(2),
      })
      .where(eq(payoutBatches.id, batchId));
  }

  if (created > 0) {
    const createdAppIds = ledgerRows
      .slice(0, created)
      .map((r) => r.application_id);
    await db
      .update(applications)
      .set({ payment_status: PaymentStatus.PAYABLE })
      .where(inArray(applications.id, createdAppIds));
  }

  return {
    created,
    skipped,
    batch_id: batchId,
    total_gross: Math.round(totalGross * 100) / 100,
    total_fees: Math.round(totalFees * 100) / 100,
    total_net: Math.round(totalNet * 100) / 100,
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
  recent_items: {
    id: string;
    worker_id: string;
    worker_name: string;
    application_id: string;
    gross_amount: number;
    net_amount: number;
    status: string;
    batch_id: string | null;
    created_at: string;
  }[];
  batches: {
    id: string;
    batch_date: string;
    status: string;
    items_count: number;
    total_gross: number;
    total_net: number;
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
      created_at: payoutLedger.created_at,
    })
    .from(payoutLedger)
    .orderBy(sql`${payoutLedger.created_at} DESC`)
    .limit(100);

  const workerIds = Array.from(new Set(items.map((i) => i.worker_id)));
  let workerNames = new Map<string, string>();
  if (workerIds.length > 0) {
    const { users } = await import("@/lib/schema");
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

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    totalGross += Number(item.gross_amount);
    totalFees += Number(item.platform_fee);
    totalNet += Number(item.net_amount);
  }

  const batches = await db
    .select({
      id: payoutBatches.id,
      batch_date: payoutBatches.batch_date,
      status: payoutBatches.status,
      items_count: payoutBatches.items_count,
      total_gross: payoutBatches.total_gross,
      total_net: payoutBatches.total_net,
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
    recent_items: items.map((i) => ({
      id: i.id,
      worker_id: i.worker_id,
      worker_name: workerNames.get(i.worker_id) || "",
      application_id: i.application_id,
      gross_amount: Number(i.gross_amount),
      net_amount: Number(i.net_amount),
      status: i.status,
      batch_id: i.batch_id,
      created_at: i.created_at ? new Date(i.created_at).toISOString() : "",
    })),
    batches: batches.map((b) => ({
      id: b.id,
      batch_date: b.batch_date,
      status: b.status,
      items_count: b.items_count,
      total_gross: Number(b.total_gross),
      total_net: Number(b.total_net),
      created_at: b.created_at ? new Date(b.created_at).toISOString() : "",
    })),
  };
}
