import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/seed-data";

// POST /api/seed — seed rich demo data (dev only, idempotent)
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "FORBIDDEN", message: "Not in production" }, { status: 403 });
  }

  const result = await seedDemoData();

  return NextResponse.json({ message: "Seed data created", ...result });
}
