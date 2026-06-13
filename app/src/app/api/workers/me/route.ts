import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { t } from "@/lib/i18n/he";
import { z } from "zod";

const updateWorkerMeSchema = z.object({
  experience_tags: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await req.json().catch(() => null);
  const parsed = updateWorkerMeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.experience_tags === undefined) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const updated = await db
    .update(workerProfiles)
    .set({ experience_tags: data.experience_tags })
    .where(eq(workerProfiles.user_id, userOrRes.id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: t("error.not_found") },
      { status: 404 }
    );
  }

  return NextResponse.json({ profile: updated[0] });
}
