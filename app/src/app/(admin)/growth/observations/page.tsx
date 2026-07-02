"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2 } from "lucide-react";
import { ROLE_FAMILIES, GROWTH_REGIONS } from "@/lib/constants";

interface ObservationRow {
  id: string;
  channel_name: string | null;
  observed_at: string;
  role_family: string;
  role_title_norm: string;
  region_code: string;
  city: string | null;
  employer_name_public: string | null;
  employer_type: string;
  salary_min: string | null;
  salary_max: string | null;
  salary_unit: string | null;
  shift_tags: string[];
  urgency_score: number;
  needs_review: boolean;
  created_at: string;
}

const familyLabel = (key: string) =>
  ROLE_FAMILIES.find((r) => r.key === key)?.label_he ?? key;
const regionLabel = (key: string) =>
  GROWTH_REGIONS.find((r) => r.key === key)?.label_he ?? key;

export default function GrowthObservationsPage() {
  const { token } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useGrowthAccess();
  const [rows, setRows] = useState<ObservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const qs = reviewOnly ? "?needs_review=true&limit=100" : "?limit=100";
    fetch(`/api/admin/growth/observations${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .finally(() => setLoading(false));
  }, [token, reviewOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveReview(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/admin/growth/observations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolve_review: true }),
      });
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!accessLoading && !hasAccess) {
    return (
      <p className="py-16 text-center text-foreground-secondary">
        {tGrowth("growth.forbidden")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {tGrowth("growth.obs.title")}
        </h1>
        <Link href="/growth/observations/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {tGrowth("growth.obs.new")}
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={reviewOnly ? "secondary" : "primary"}
          onClick={() => setReviewOnly(false)}
        >
          {tGrowth("growth.obs.title")}
        </Button>
        <Button
          size="sm"
          variant={reviewOnly ? "primary" : "secondary"}
          onClick={() => setReviewOnly(true)}
        >
          {tGrowth("growth.obs.needs_review")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-foreground-secondary">
          {tGrowth("growth.obs.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-foreground">
                  {row.role_title_norm}
                </p>
                <p className="text-xs text-foreground-tertiary">
                  {row.channel_name ?? "—"} ·{" "}
                  {new Date(row.observed_at).toLocaleDateString("he-IL")}
                  {row.employer_name_public ? ` · ${row.employer_name_public}` : ""}
                </p>
              </div>
              <Badge variant="info">{familyLabel(row.role_family)}</Badge>
              <Badge variant="muted">
                {regionLabel(row.region_code)}
                {row.city ? ` · ${row.city}` : ""}
              </Badge>
              {row.salary_min && (
                <Badge variant="secondary">
                  ₪{row.salary_min}
                  {row.salary_max ? `–${row.salary_max}` : ""}{" "}
                  {row.salary_unit === "monthly"
                    ? tGrowth("growth.obs.salary_unit.monthly")
                    : tGrowth("growth.obs.salary_unit.hourly")}
                </Badge>
              )}
              {row.urgency_score >= 7 && <Badge variant="urgent">דחוף</Badge>}
              {row.needs_review && (
                <>
                  <Badge variant="warning">
                    {tGrowth("growth.obs.needs_review")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => resolveReview(row.id)}
                    loading={saving}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
