// Public candidate landing page — the ONLY public read surface of the
// growth module. Renders an explicit whitelist of landing_pages fields
// (never SELECT *) and only when the page is 'live' AND the launch flag
// is on. 🚦 LAUNCH GATE: PUBLIC_LP_ENABLED stays false until privacy
// counsel approves the intake consent text (PPL Amendment 13).
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { landingPages } from "@/lib/schema";
import { t } from "@/lib/i18n/he";
import { IntakeForm } from "./intake-form";

export const dynamic = "force-dynamic";

function isPublicLpEnabled(): boolean {
  return process.env.PUBLIC_LP_ENABLED === "true";
}

export default async function LandingPage({
  params,
}: {
  params: { slug: string };
}) {
  if (!isPublicLpEnabled()) notFound();

  // Explicit field whitelist — the public surface never sees other columns
  const rows = await db
    .select({
      slug: landingPages.slug,
      headline_he: landingPages.headline_he,
      body_he: landingPages.body_he,
      role_family: landingPages.role_family,
      region_code: landingPages.region_code,
    })
    .from(landingPages)
    .where(
      and(eq(landingPages.slug, params.slug), eq(landingPages.status, "live"))
    )
    .limit(1);

  const page = rows[0];
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <header className="text-center space-y-2 pt-4">
        <p className="text-2xl font-bold text-primary-600">Joby</p>
        <h1 className="text-2xl font-bold text-foreground">
          {page.headline_he}
        </h1>
        {page.body_he && (
          <p className="text-foreground-secondary whitespace-pre-line">
            {page.body_he}
          </p>
        )}
        <p className="text-sm text-foreground-tertiary">{t("lp.trust_line")}</p>
      </header>

      <IntakeForm
        landingPageSlug={page.slug}
        defaultRoleFamily={page.role_family}
      />
    </div>
  );
}
