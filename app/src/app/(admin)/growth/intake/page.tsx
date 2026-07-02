"use client";

// Masked intake-review queue (execution pack S6.2). PII stays masked in
// every list response; unmasking is per-submission, reason-required, and
// audited server-side. The unmask button only renders for PII-permission
// holders (super_admin), but the API is the actual control.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle2, Flag } from "lucide-react";
import {
  ROLE_FAMILIES,
  GROWTH_REGIONS,
  GrowthSubRole,
  SubmissionReviewStatus,
} from "@/lib/constants";

interface IntakeRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  phone_masked: string;
  city: string | null;
  region_code: string | null;
  consent_marketing: boolean;
  role_families: string[];
  availability: { shifts?: string[]; experience?: string | null } | null;
  quality_score: number | null;
  completeness_score: number | null;
  review_status: string;
  submitted_at: string;
  lp_slug: string | null;
}

const familyLabel = (key: string) =>
  ROLE_FAMILIES.find((r) => r.key === key)?.label_he ?? key;
const regionLabel = (key: string | null) =>
  GROWTH_REGIONS.find((r) => r.key === key)?.label_he ?? key ?? "—";

const STATUS_FILTERS = [
  { key: "PENDING", labelKey: "growth.intake.pending" as const },
  { key: "", labelKey: "growth.intake.all" as const },
];

export default function GrowthIntakePage() {
  const { token } = useAuth();
  const { hasAccess, subRole, isLoading: accessLoading } = useGrowthAccess();
  const [rows, setRows] = useState<IntakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [unmasked, setUnmasked] = useState<
    Record<string, { phone: string; email: string | null }>
  >({});
  const [error, setError] = useState("");

  const canUnmask = subRole === GrowthSubRole.SUPER_ADMIN;

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const qs = statusFilter
      ? `?review_status=${statusFilter}&limit=100`
      : "?limit=100";
    fetch(`/api/admin/growth/intake${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: string, review_status: "REVIEWED" | "FLAGGED") {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/growth/intake/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ review_status }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  async function unmask(id: string) {
    const reason = window.prompt(tGrowth("growth.intake.unmask_reason"));
    if (!reason || reason.trim().length < 5) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/growth/intake/${id}/unmask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      setUnmasked((prev) => ({
        ...prev,
        [id]: { phone: data.data.phone, email: data.data.email },
      }));
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
      <h1 className="text-2xl font-bold text-foreground">
        {tGrowth("growth.intake.title")}
      </h1>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={statusFilter === f.key ? "primary" : "secondary"}
            onClick={() => setStatusFilter(f.key)}
          >
            {tGrowth(f.labelKey)}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-foreground-secondary">
          {tGrowth("growth.intake.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="font-medium text-foreground">
                    {row.candidate_name}
                  </p>
                  <p className="text-sm text-foreground-secondary" dir="ltr">
                    {unmasked[row.id]?.phone ?? row.phone_masked}
                  </p>
                  <p className="text-xs text-foreground-tertiary">
                    {regionLabel(row.region_code)}
                    {row.city ? ` · ${row.city}` : ""} ·{" "}
                    {tGrowth("growth.intake.submitted_at")}{" "}
                    {new Date(row.submitted_at).toLocaleDateString("he-IL")}
                    {row.lp_slug ? ` · ${row.lp_slug}` : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    row.review_status === SubmissionReviewStatus.PENDING
                      ? "warning"
                      : row.review_status === SubmissionReviewStatus.FLAGGED
                        ? "danger"
                        : "success"
                  }
                >
                  {row.review_status === SubmissionReviewStatus.PENDING
                    ? tGrowth("growth.intake.pending")
                    : row.review_status === SubmissionReviewStatus.FLAGGED
                      ? tGrowth("growth.intake.flagged")
                      : tGrowth("growth.intake.reviewed")}
                </Badge>
                {row.completeness_score != null && (
                  <Badge variant="muted">
                    {tGrowth("growth.intake.completeness")}:{" "}
                    {row.completeness_score}%
                  </Badge>
                )}
                {row.consent_marketing && (
                  <Badge variant="info">
                    {tGrowth("growth.intake.consent_marketing")}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {row.role_families.map((f) => (
                  <Badge key={f} variant="secondary">
                    {familyLabel(f)}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {row.review_status === SubmissionReviewStatus.PENDING && (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => review(row.id, "REVIEWED")}
                      loading={saving}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {tGrowth("growth.intake.mark_reviewed")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => review(row.id, "FLAGGED")}
                      loading={saving}
                    >
                      <Flag className="h-4 w-4" />
                      {tGrowth("growth.intake.mark_flagged")}
                    </Button>
                  </>
                )}
                {canUnmask && !unmasked[row.id] && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => unmask(row.id)}
                    loading={saving}
                  >
                    <Eye className="h-4 w-4" />
                    {tGrowth("growth.intake.unmask")}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
