import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workerProfiles, employerProfiles, workerInvites } from "@/lib/schema";
import { requireRole } from "@/lib/auth";
import { adminCreateWorkerSchema, adminListQuerySchema } from "@/lib/validators";
import { UserRole, Config } from "@/lib/constants";
import { eq, or, ilike, and, sql, desc } from "drizzle-orm";
import { t } from "@/lib/i18n/he";
import { normalizePhone } from "@/lib/phone";

// GET /api/admin/workers — unified workforce list: registered workers + employer-invited phones
// that have not signed up yet (admin only)
export async function GET(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  const url = new URL(req.url);
  const parsed = adminListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }
  const { q, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(users.role, UserRole.WORKER)];
  if (q) {
    conditions.push(
      or(
        ilike(users.full_name, `%${q}%`),
        ilike(users.phone, `%${q}%`),
        ilike(workerProfiles.city, `%${q}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${workerProfiles.experience_tags}) tag WHERE tag ILIKE ${`%${q}%`})`
      )!
    );
  }
  const where = and(...conditions);

  const [workerRows, countResult, allWorkerPhones, inviteRows] = await Promise.all([
    db
      .select({
        id: users.id,
        phone: users.phone,
        full_name: users.full_name,
        is_active: users.is_active,
        created_by_admin: users.created_by_admin,
        created_at: users.created_at,
        city: workerProfiles.city,
        experience_tags: workerProfiles.experience_tags,
        trust_score: workerProfiles.trust_score,
        total_shifts: workerProfiles.total_shifts,
      })
      .from(users)
      .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
      .where(where)
      .orderBy(desc(users.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .leftJoin(workerProfiles, eq(users.id, workerProfiles.user_id))
      .where(where),
    // All worker phones (unpaginated) — used to detect which invites already converted
    db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.role, UserRole.WORKER)),
    // All employer invites, newest first, with the inviting employer's business name
    db
      .select({
        id: workerInvites.id,
        employer_id: workerInvites.employer_id,
        employer_name: employerProfiles.business_name,
        invited_phone: workerInvites.invited_phone,
        normalized_phone: workerInvites.normalized_phone,
        status: workerInvites.status,
        sent_at: workerInvites.sent_at,
        joined_at: workerInvites.joined_at,
      })
      .from(workerInvites)
      .leftJoin(employerProfiles, eq(workerInvites.employer_id, employerProfiles.user_id))
      .orderBy(desc(workerInvites.sent_at)),
  ]);

  // Group invites by normalized phone. Rows are already ordered newest-first,
  // so the first entry per phone is the most recent ("primary") inviter.
  const invitesByPhone = new Map<string, typeof inviteRows>();
  for (const inv of inviteRows) {
    const arr = invitesByPhone.get(inv.normalized_phone);
    if (arr) arr.push(inv);
    else invitesByPhone.set(inv.normalized_phone, [inv]);
  }

  const registeredPhones = new Set(allWorkerPhones.map((w) => normalizePhone(w.phone)));

  // Registered workers: attach invite-origin info (if this phone was ever invited by an employer)
  const workerData = workerRows.map((row) => {
    const normalized = normalizePhone(row.phone);
    const invites = invitesByPhone.get(normalized);
    const primaryInvite = invites?.[0];

    return {
      ...row,
      status: primaryInvite ? "JOINED" : "REGISTERED",
      source: primaryInvite ? "employer_invite" : "direct",
      inviter_employer_id: primaryInvite?.employer_id || null,
      inviter_employer_name: primaryInvite?.employer_name || null,
      invite_sent_at: primaryInvite?.sent_at || null,
      joined_at: row.created_at,
      whatsapp_status: primaryInvite?.status || null,
      invite_count: invites?.length || 0,
    };
  });

  // Invite-only rows: phones that were invited but never registered as a worker
  let inviteOnlyData = Array.from(invitesByPhone.entries())
    .filter(([normalized]) => !registeredPhones.has(normalized))
    .map(([normalized, invites]) => {
      const primary = invites[0];
      return {
        id: `invite:${primary.id}`,
        phone: primary.invited_phone,
        full_name: null,
        is_active: false,
        created_by_admin: false,
        created_at: primary.sent_at,
        city: null,
        experience_tags: [] as string[],
        trust_score: null,
        total_shifts: null,
        status: primary.status === "FAILED" ? "FAILED" : "INVITED",
        source: "employer_invite",
        inviter_employer_id: primary.employer_id,
        inviter_employer_name: primary.employer_name,
        invite_sent_at: primary.sent_at,
        joined_at: primary.joined_at,
        whatsapp_status: primary.status,
        invite_count: invites.length,
        normalized_phone: normalized,
      };
    });

  if (q) {
    const needle = q.toLowerCase();
    inviteOnlyData = inviteOnlyData.filter(
      (row) =>
        row.phone.toLowerCase().includes(needle) ||
        (row.inviter_employer_name || "").toLowerCase().includes(needle)
    );
  }

  inviteOnlyData = inviteOnlyData
    .sort((a, b) => new Date(b.invite_sent_at ?? 0).getTime() - new Date(a.invite_sent_at ?? 0).getTime())
    .slice(0, limit);

  return NextResponse.json({
    data: [...workerData, ...inviteOnlyData],
    total: (countResult[0]?.count || 0) + inviteOnlyData.length,
    page,
    limit,
  });
}

// POST /api/admin/workers — create a new worker account (admin only)
export async function POST(req: NextRequest) {
  const admin = await requireRole(req, UserRole.ADMIN);
  if (admin instanceof NextResponse) return admin;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION", message: t("error.validation") }, { status: 400 });
  }

  const parsed = adminCreateWorkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", message: parsed.error.issues[0]?.message || t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, data.phone))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "USER_EXISTS", message: t("error.user_exists") }, { status: 409 });
  }

  const insertedUsers = await db
    .insert(users)
    .values({
      phone: data.phone,
      full_name: data.full_name,
      role: UserRole.WORKER,
      created_by_admin: true,
    })
    .returning();
  const user = insertedUsers[0];

  const insertedProfiles = await db
    .insert(workerProfiles)
    .values({
      user_id: user.id,
      city: data.city || null,
      experience_tags: data.experience_tags || [],
      bio: data.bio || null,
      trust_score: Config.TRUST_BASE_SCORE.toString(),
    })
    .returning();

  return NextResponse.json({ user, profile: insertedProfiles[0] }, { status: 201 });
}
