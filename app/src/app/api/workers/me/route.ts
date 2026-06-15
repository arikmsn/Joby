import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { workerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";
import { updateWorkerMeSchema } from "@/lib/validators";
import { t } from "@/lib/i18n/he";

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
  const updates: Record<string, unknown> = {};
  if (data.experience_tags !== undefined) updates.experience_tags = data.experience_tags;
  if (data.preferred_cities !== undefined) updates.preferred_cities = data.preferred_cities;
  if (data.languages !== undefined) updates.languages = data.languages;
  if (data.has_vehicle !== undefined) updates.has_vehicle = data.has_vehicle;
  if (data.has_license !== undefined) updates.has_license = data.has_license;
  if (data.license_types !== undefined) updates.license_types = data.license_types;
  if (data.vehicle_types !== undefined) updates.vehicle_types = data.vehicle_types;
  if (data.min_pay !== undefined) updates.min_pay = data.min_pay === null ? null : data.min_pay.toString();
  if (data.bio !== undefined) updates.bio = data.bio;
  if (data.city !== undefined) updates.city = data.city;
  if (data.date_of_birth !== undefined) updates.date_of_birth = data.date_of_birth;
  if (data.onboarding_completed) updates.onboarding_completed_at = new Date();
  if (data.onboarding_skipped) updates.onboarding_skipped_at = new Date();
  if (data.reminders_enabled !== undefined) updates.reminders_enabled = data.reminders_enabled;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const updated = await db
    .update(workerProfiles)
    .set(updates)
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
