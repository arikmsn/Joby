import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import { findEligibleApplications, prepareLedgerItems } from "@/lib/payout";

// POST /api/admin/payouts/prepare — prepare payout ledger items
// This scans for eligible completed work, creates ledger rows,
// and optionally groups them into a batch. NO real transfer happens.
export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => ({}));
  const createBatch = body?.create_batch !== false;

  const eligible = await findEligibleApplications();

  if (eligible.length === 0) {
    return NextResponse.json({
      message: "No eligible applications found",
      result: { created: 0, skipped: 0, batch_id: null, total_gross: 0, total_fees: 0, total_net: 0 },
    });
  }

  const result = await prepareLedgerItems(eligible, {
    createBatch,
    preparedBy: userOrRes.id,
  });

  return NextResponse.json({
    message: `Prepared ${result.created} payout items${result.batch_id ? ` in batch` : ""}`,
    result,
  });
}
