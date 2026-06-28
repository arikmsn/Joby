import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import {
  findEligibleApplications,
  getPayoutReadinessSummary,
  getLedgerSummary,
} from "@/lib/payout";

// GET /api/admin/payouts — payout dashboard data
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const [readiness, eligible, ledger] = await Promise.all([
    getPayoutReadinessSummary(),
    findEligibleApplications(),
    getLedgerSummary(),
  ]);

  return NextResponse.json({
    readiness,
    eligible_count: eligible.length,
    ledger,
  });
}
