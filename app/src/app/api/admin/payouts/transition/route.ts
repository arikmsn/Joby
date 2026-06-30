import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import { payoutTransitionSchema } from "@/lib/validators";
import {
  transitionLedgerItem,
  transitionBatch,
  getValidLedgerTransitions,
  getValidBatchTransitions,
} from "@/lib/payout-lifecycle";

// POST /api/admin/payouts/transition — manual admin state transition.
// Internal testing of the payout lifecycle before a real provider exists.
// The lifecycle module is the source of truth for which transitions are
// legal; this route only validates the request shape and delegates.
export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = payoutTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const auditMessage = `Manual transition by admin ${userOrRes.id}`;

  if (data.entity_type === "item") {
    const result = await transitionLedgerItem(data.entity_id, data.target_status, {
      adminId: userOrRes.id,
      providerMessage: auditMessage,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  const result = await transitionBatch(data.entity_id, data.target_status, {
    adminId: userOrRes.id,
    cascadeToItems: data.cascade_to_items ?? true,
    providerName: "manual",
    providerMessage: auditMessage,
  });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

// GET /api/admin/payouts/transition?entity_type=item&status=PENDING
// Returns valid transitions for a given current status.
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entity_type") === "batch" ? "batch" : "item";
  const currentStatus = searchParams.get("status") || "";

  const transitions = entityType === "batch"
    ? getValidBatchTransitions(currentStatus)
    : getValidLedgerTransitions(currentStatus);

  return NextResponse.json({ current: currentStatus, valid_transitions: transitions });
}
