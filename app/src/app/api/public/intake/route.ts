import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates, candidateSubmissions, landingPages } from "@/lib/schema";
import { publicIntakeSchema } from "@/lib/growth/validators";
import {
  consumeIntakeRateLimit,
  clientIp,
} from "@/lib/growth/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { INTAKE_RATE_LIMITS } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

// POST /api/public/intake — the ONLY public write surface of the growth
// module. Write-only: the response never echoes candidate data back.
// Hardening (execution pack S6.1/§8): strict validation, honeypot silent
// drop, hashed-key rate limits (IP + phone), silent phone upsert (no
// enumeration), consent timestamps required.
// 🚦 LAUNCH GATE: dark until PUBLIC_LP_ENABLED=true (privacy counsel ⚖️).
// LOG HYGIENE: nothing in this handler logs phone/name/email — ids only.
export async function POST(req: NextRequest) {
  if (process.env.PUBLIC_LP_ENABLED !== "true") {
    return NextResponse.json({ error: "DISABLED" }, { status: 503 });
  }

  // IP rate limit before any parsing work
  const ip = clientIp(req);
  if (
    !(await consumeIntakeRateLimit("ip", ip, INTAKE_RATE_LIMITS.PER_IP_PER_HOUR))
  ) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = publicIntakeSchema.safeParse(body);
  if (!parsed.success) {
    // Generic validation response — no field echo, no data-shape hints
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Honeypot tripped → pretend success, write nothing
  if (data.website && data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const phone = normalizePhone(data.phone);
  if (
    !(await consumeIntakeRateLimit(
      "phone",
      phone,
      INTAKE_RATE_LIMITS.PER_PHONE_PER_HOUR
    ))
  ) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  // Landing page must exist and be live (attribution + region defaulting)
  const lpRows = await db
    .select({
      id: landingPages.id,
      region_code: landingPages.region_code,
      status: landingPages.status,
    })
    .from(landingPages)
    .where(eq(landingPages.slug, data.landing_page_slug))
    .limit(1);
  const lp = lpRows[0];
  if (!lp || lp.status !== "live") {
    return NextResponse.json(
      { error: "VALIDATION", message: t("error.validation") },
      { status: 400 }
    );
  }

  const now = new Date();

  // Silent upsert by phone: duplicate submissions update the candidate and
  // add a submission row — the response is identical either way (no
  // enumeration). Consent timestamps are only ever set, never cleared.
  const existing = await db
    .select({
      id: candidates.id,
      consent_marketing_at: candidates.consent_marketing_at,
    })
    .from(candidates)
    .where(eq(candidates.phone, phone))
    .limit(1);

  let candidateId: string;
  if (existing[0]) {
    candidateId = existing[0].id;
    await db
      .update(candidates)
      .set({
        full_name: data.full_name,
        city: data.city,
        region_code: lp.region_code,
        ...(data.consent_marketing && !existing[0].consent_marketing_at
          ? { consent_marketing_at: now }
          : {}),
        updated_at: now,
      })
      .where(eq(candidates.id, candidateId));
  } else {
    const [created] = await db
      .insert(candidates)
      .values({
        full_name: data.full_name,
        phone,
        city: data.city,
        region_code: lp.region_code,
        consent_privacy_at: now,
        consent_marketing_at: data.consent_marketing ? now : null,
      })
      .returning({ id: candidates.id });
    candidateId = created.id;
  }

  await db.insert(candidateSubmissions).values({
    candidate_id: candidateId,
    landing_page_id: lp.id,
    role_families: data.role_families,
    availability: {
      shifts: data.shifts,
      experience: data.experience ?? null,
    },
    completeness_score: computeCompleteness(data),
    review_status: "PENDING",
  });

  return NextResponse.json({ ok: true });
}

// Completeness = share of optional signals provided (0-100). Relevance
// scoring is the intake classifier's job later; never protected traits.
function computeCompleteness(data: {
  shifts: string[];
  experience?: string;
  consent_marketing: boolean;
}): number {
  let score = 60; // required fields present (validated)
  if (data.shifts.length > 0) score += 15;
  if (data.experience) score += 15;
  if (data.consent_marketing) score += 10;
  return score;
}
