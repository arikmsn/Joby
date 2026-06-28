import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import {
  transitionLedgerItem,
  transitionBatch,
  getValidLedgerTransitions,
  getValidBatchTransitions,
} from "@/lib/payout-lifecycle";

// POST /api/admin/payouts/transition — manual admin state transition
// For internal testing of the payout lifecycle before a real provider exists.
export async function POST(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { entity_type, entity_id, target_status, cascade_to_items } = body as {
    entity_type: "item" | "batch";
    entity_id: string;
    target_status: string;
    cascade_to_items?: boolean;
  };

  if (!entity_type || !entity_id || !target_status) {
    return NextResponse.json(
      { error: "Missing entity_type, entity_id, or target_status" },
      { status: 400 }
    );
  }

  if (entity_type === "item") {
    const result = await transitionLedgerItem(entity_id, target_status, {
      adminId: userOrRes.id,
      providerMessage: `Manual transition by admin ${userOrRes.id}`,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (entity_type === "batch") {
    const result = await transitionBatch(entity_id, target_status, {
      adminId: userOrRes.id,
      cascadeToItems: cascade_to_items ?? true,
      providerName: "manual",
      providerMessage: `Manual transition by admin ${userOrRes.id}`,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  return NextResponse.json({ error: "entity_type must be 'item' or 'batch'" }, { status: 400 });
}

// GET /api/admin/payouts/transition?entity_type=item&status=PENDING
// Returns valid transitions for a given current status
export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entity_type") || "item";
  const currentStatus = searchParams.get("status") || "";

  const transitions = entityType === "batch"
    ? getValidBatchTransitions(currentStatus)
    : getValidLedgerTransitions(currentStatus);

  return NextResponse.json({ current: currentStatus, valid_transitions: transitions });
}
