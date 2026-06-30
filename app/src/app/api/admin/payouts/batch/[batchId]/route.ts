import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/lib/constants";
import { isUuid } from "@/lib/validators";
import { getBatchDetail } from "@/lib/payout";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const userOrRes = await requireRole(req, UserRole.ADMIN);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const { batchId } = await params;
  if (!isUuid(batchId)) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const batch = await getBatchDetail(batchId);

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json(batch);
}
