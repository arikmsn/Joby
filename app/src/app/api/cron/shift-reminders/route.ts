import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, shifts, workerProfiles, users, notifications } from "@/lib/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ApplicationStatus, Config } from "@/lib/constants";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { t } from "@/lib/i18n/he";
import { sendSMS } from "@/lib/sms";

// GET /api/cron/shift-reminders
// Sends a reminder (in-app + WhatsApp) shortly before a shift starts and
// shortly before it ends, prompting the worker to scan the QR code.
// Skips workers who disabled reminders in their profile, and is idempotent
// per application+type via a check against existing notifications.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let startReminders = 0;
  let endReminders = 0;

  // --- Start reminders: shift begins within the check-in window ---
  const startWindowEnd = new Date(now.getTime() + Config.CHECKIN_WINDOW_BEFORE_MINUTES * 60 * 1000);

  const upcoming = await db
    .select({
      application_id: applications.id,
      worker_id: applications.worker_id,
      shift_title: shifts.title,
      start_at: shifts.start_at,
      phone: users.phone,
      reminders_enabled: workerProfiles.reminders_enabled,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .innerJoin(users, eq(applications.worker_id, users.id))
    .innerJoin(workerProfiles, eq(workerProfiles.user_id, applications.worker_id))
    .where(
      and(
        sql`${applications.status} IN ('APPROVED', 'CONFIRMED')`,
        eq(applications.is_backup, false),
        gte(shifts.start_at, now),
        lte(shifts.start_at, startWindowEnd)
      )
    );

  for (const row of upcoming) {
    if (!row.reminders_enabled) continue;

    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, row.worker_id),
          eq(notifications.type, "SHIFT_REMINDER_START"),
          sql`${notifications.payload}->>'application_id' = ${row.application_id}`
        )
      )
      .limit(1);
    if (existing.length > 0) continue;

    const minutes = Math.max(1, Math.round((new Date(row.start_at).getTime() - now.getTime()) / 60000));

    await db.insert(notifications).values({
      user_id: row.worker_id,
      type: "SHIFT_REMINDER_START",
      title: t("notification.shift_reminder_start.title"),
      body: t("notification.shift_reminder_start.body")
        .replace("{title}", row.shift_title)
        .replace("{minutes}", String(minutes)),
      payload: { application_id: row.application_id },
    });

    if (row.phone) {
      const message = t("notification.shift_reminder_start.whatsapp")
        .replace("{title}", row.shift_title)
        .replace("{minutes}", String(minutes));
      await sendSMS(row.phone, message);
    }

    startReminders++;
  }

  // --- End reminders: checked-in shift ends within 15 minutes ---
  const endWindowEnd = new Date(now.getTime() + 15 * 60 * 1000);

  const ending = await db
    .select({
      application_id: applications.id,
      worker_id: applications.worker_id,
      shift_title: shifts.title,
      end_at: shifts.end_at,
      phone: users.phone,
      reminders_enabled: workerProfiles.reminders_enabled,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .innerJoin(users, eq(applications.worker_id, users.id))
    .innerJoin(workerProfiles, eq(workerProfiles.user_id, applications.worker_id))
    .where(
      and(
        eq(applications.status, ApplicationStatus.CHECKED_IN),
        eq(applications.is_backup, false),
        gte(shifts.end_at, now),
        lte(shifts.end_at, endWindowEnd)
      )
    );

  for (const row of ending) {
    if (!row.reminders_enabled) continue;

    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, row.worker_id),
          eq(notifications.type, "SHIFT_REMINDER_END"),
          sql`${notifications.payload}->>'application_id' = ${row.application_id}`
        )
      )
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(notifications).values({
      user_id: row.worker_id,
      type: "SHIFT_REMINDER_END",
      title: t("notification.shift_reminder_end.title"),
      body: t("notification.shift_reminder_end.body").replace("{title}", row.shift_title),
      payload: { application_id: row.application_id },
    });

    if (row.phone) {
      const message = t("notification.shift_reminder_end.whatsapp").replace("{title}", row.shift_title);
      await sendSMS(row.phone, message);
    }

    endReminders++;
  }

  return NextResponse.json({
    message: `Sent ${startReminders} start reminders, ${endReminders} end reminders`,
    startReminders,
    endReminders,
  });
}
