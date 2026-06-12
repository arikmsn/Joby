import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { applications, shifts, users, employerProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const userOrRes = await requireRole(req, UserRole.WORKER);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  const rows = await db
    .select({
      id: applications.id,
      shift_id: applications.shift_id,
      status: applications.status,
      is_backup: applications.is_backup,
      applied_at: applications.applied_at,
      approved_at: applications.approved_at,
      cancelled_at: applications.cancelled_at,
      shift_title: shifts.title,
      shift_role_tag: shifts.role_tag,
      shift_city: shifts.city,
      shift_start_at: shifts.start_at,
      shift_end_at: shifts.end_at,
      shift_pay_rate: shifts.pay_rate,
      shift_pay_type: shifts.pay_type,
      shift_status: shifts.status,
      shift_location_name: shifts.location_name,
      shift_address: shifts.address,
      employer_name: users.full_name,
      business_name: employerProfiles.business_name,
    })
    .from(applications)
    .innerJoin(shifts, eq(applications.shift_id, shifts.id))
    .innerJoin(users, eq(shifts.employer_id, users.id))
    .leftJoin(employerProfiles, eq(shifts.employer_id, employerProfiles.user_id))
    .where(eq(applications.worker_id, user.id))
    .orderBy(applications.applied_at);

  return NextResponse.json({ applications: rows });
}
