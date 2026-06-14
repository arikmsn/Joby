import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validators";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, employerProfiles, workerProfiles, workerInvites } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { UserRole, Config } from "@/lib/constants";
import { t } from "@/lib/i18n/he";
import { normalizePhone } from "@/lib/phone";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const phone = body.phone as string;
  if (!phone) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.phone_invalid") },
      { status: 400 }
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "VALIDATION",
        message: firstError?.message || t("error.validation"),
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check if user already exists
  const existingRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  if (existingRows.length > 0) {
    return NextResponse.json(
      { error: "USER_EXISTS", message: t("error.user_exists") },
      { status: 409 }
    );
  }

  // Create user
  let user;
  try {
    const inserted = await db
      .insert(users)
      .values({
        phone,
        full_name: data.full_name,
        role: data.role,
      })
      .returning({
        id: users.id,
        phone: users.phone,
        role: users.role,
        full_name: users.full_name,
        is_active: users.is_active,
      });
    user = inserted[0];
  } catch (err) {
    console.error("[Register] User creation failed:", err);
    return NextResponse.json(
      { error: "DB_ERROR", message: t("error.generic") },
      { status: 500 }
    );
  }

  // Create role-specific profile
  let profile = null;

  try {
    if (data.role === UserRole.EMPLOYER) {
      const inserted = await db
        .insert(employerProfiles)
        .values({
          user_id: user.id,
          business_name: data.business_name!,
          business_type: data.business_type || null,
          address: data.address || null,
          lat: data.lat?.toString() || null,
          lng: data.lng?.toString() || null,
        })
        .returning();
      profile = inserted[0];
    } else if (data.role === UserRole.WORKER) {
      const inserted = await db
        .insert(workerProfiles)
        .values({
          user_id: user.id,
          city: data.city || null,
          experience_tags: data.experience_tags || [],
          date_of_birth: data.date_of_birth || null,
          bio: data.bio || null,
          trust_score: Config.TRUST_BASE_SCORE.toString(),
        })
        .returning();
      profile = inserted[0];
    }
  } catch (err) {
    console.error("[Register] Profile creation failed:", err);
    await db.delete(users).where(eq(users.id, user.id));
    return NextResponse.json(
      { error: "DB_ERROR", message: t("error.generic") },
      { status: 500 }
    );
  }

  if (data.role === UserRole.WORKER) {
    await db
      .update(workerInvites)
      .set({ status: "JOINED", joined_at: sql`now()`, updated_at: sql`now()` })
      .where(and(eq(workerInvites.normalized_phone, normalizePhone(phone)), eq(workerInvites.status, "PENDING")));
  }

  const token = await signToken({
    userId: user.id,
    role: user.role as UserRole,
  });

  return NextResponse.json({ token, user, profile }, { status: 201 });
}
