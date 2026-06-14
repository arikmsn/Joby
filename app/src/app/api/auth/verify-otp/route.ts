import { NextRequest, NextResponse } from "next/server";
import { verifyOtpSchema } from "@/lib/validators";
import { verifyOTP } from "@/lib/otp";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, employerProfiles, workerProfiles } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { t } from "@/lib/i18n/he";
import { UserRole } from "@/lib/constants";
import { phoneVariants } from "@/lib/phone";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const { phone, otp } = parsed.data;
  const otpResult = await verifyOTP(phone, otp);

  if (!otpResult.valid) {
    const message =
      otpResult.error === "OTP_EXPIRED"
        ? t("error.otp_expired")
        : t("error.otp_invalid");

    return NextResponse.json(
      { error: otpResult.error, message },
      { status: 401 }
    );
  }

  // Check if user exists
  const existingRows = await db
    .select({
      id: users.id,
      phone: users.phone,
      role: users.role,
      full_name: users.full_name,
      is_active: users.is_active,
    })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  const existingUser = existingRows[0];

  if (existingUser) {
    if (!existingUser.is_active) {
      return NextResponse.json(
        { error: "SUSPENDED", message: t("error.user_suspended") },
        { status: 403 }
      );
    }

    // The same real-world phone number may exist as more than one user
    // record under different formats (e.g. "+972502463555" vs "0502463555"),
    // representing separate role accounts (employer + admin). If the
    // phone has access to more than one such account, let the user choose
    // which one to enter instead of silently picking one.
    const variants = phoneVariants(phone);
    const accountRows = await db
      .select({
        id: users.id,
        phone: users.phone,
        role: users.role,
        full_name: users.full_name,
        is_active: users.is_active,
      })
      .from(users)
      .where(
        and(
          inArray(users.phone, variants),
          inArray(users.role, [UserRole.EMPLOYER, UserRole.ADMIN]),
          eq(users.is_active, true)
        )
      );

    if (accountRows.length > 1) {
      const accounts = await Promise.all(
        accountRows.map(async (u) => {
          const accountToken = await signToken({
            userId: u.id,
            role: u.role as UserRole,
          });
          let accountProfile = null;
          if (u.role === UserRole.EMPLOYER) {
            const rows = await db
              .select()
              .from(employerProfiles)
              .where(eq(employerProfiles.user_id, u.id))
              .limit(1);
            accountProfile = rows[0] ?? null;
          }
          return { token: accountToken, user: u, profile: accountProfile };
        })
      );

      return NextResponse.json({
        token: null,
        user: null,
        profile: null,
        isNewUser: false,
        accounts,
      });
    }

    const token = await signToken({
      userId: existingUser.id,
      role: existingUser.role as UserRole,
    });

    // Fetch profile
    let profile = null;
    if (existingUser.role === UserRole.EMPLOYER) {
      const rows = await db
        .select()
        .from(employerProfiles)
        .where(eq(employerProfiles.user_id, existingUser.id))
        .limit(1);
      profile = rows[0] ?? null;
    } else if (existingUser.role === UserRole.WORKER) {
      const rows = await db
        .select()
        .from(workerProfiles)
        .where(eq(workerProfiles.user_id, existingUser.id))
        .limit(1);
      profile = rows[0] ?? null;
    }

    return NextResponse.json({
      token,
      user: existingUser,
      profile,
      isNewUser: false,
    });
  }

  // User doesn't exist -- return for registration
  return NextResponse.json({
    token: null,
    user: null,
    profile: null,
    isNewUser: true,
    phone,
  });
}
