import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { occupationCatalog, shifts } from "@/lib/schema";
import { eq, asc, and, gte, sql } from "drizzle-orm";
import { DEFAULT_OCCUPATIONS } from "@/lib/occupations";

export async function GET(req: NextRequest) {
  const includeCounts = req.nextUrl.searchParams.get("counts") === "1";

  const rows = await db
    .select({
      key: occupationCatalog.key,
      label_he: occupationCatalog.label_he,
    })
    .from(occupationCatalog)
    .where(eq(occupationCatalog.is_active, true))
    .orderBy(asc(occupationCatalog.sort_order));

  if (rows.length === 0) {
    return NextResponse.json({ occupations: DEFAULT_OCCUPATIONS });
  }

  if (!includeCounts) {
    return NextResponse.json({ occupations: rows });
  }

  const countRows = await db
    .select({
      role_tag: shifts.role_tag,
      count: sql<number>`count(*)::int`,
    })
    .from(shifts)
    .where(
      and(
        eq(shifts.status, "PUBLISHED"),
        gte(shifts.start_at, new Date())
      )
    )
    .groupBy(shifts.role_tag);

  const countMap = new Map(countRows.map((r) => [r.role_tag, r.count]));
  const occupationsWithCounts = rows.map((o) => ({
    ...o,
    open_shifts: countMap.get(o.key) || 0,
  }));

  return NextResponse.json({ occupations: occupationsWithCounts });
}
