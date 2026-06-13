import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { occupationCatalog } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { DEFAULT_OCCUPATIONS } from "@/lib/occupations";

export async function GET() {
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

  return NextResponse.json({ occupations: rows });
}
