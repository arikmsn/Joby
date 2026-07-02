"use client";

// Observations list + Stage-1 review queue. Collector items arrive raw
// (role_family='other', needs_review=true, raw_text under TTL) and are
// structured by a human here — one inline classify-and-resolve action.
// This human-labeled output is the Stage-2 extraction eval baseline.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
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
  source_ref: string | null;
  raw_text: string | null;
  needs_review: boolean;
  created_at: string;
}

interface RowEdit {
  role_family: string;
  region_code: string;
  role_title_norm: string;
  city: string;
  employer_name_public: string;
}

const familyLabel = (key: string) =>
  ROLE_FAMILIES.find((r) => r.key === key)?.label_he ?? key;
const regionLabel = (key: string) =>
  GROWTH_REGIONS.find((r) => r.key === key)?.label_he ?? key;

const selectClass =
  "rounded-lg border border-border px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function GrowthObservationsPage() {
  const { token } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useGrowthAccess();
  const [rows, setRows] = useState<ObservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOnly, setReviewOnly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const qs = reviewOnly ? "?needs_review=true&limit=100" : "?limit=100";
    fetch(`/api/admin/growth/observations${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const list: ObservationRow[] = d.data || [];
        setRows(list);
        const nextEdits: Record<string, RowEdit> = {};
        for (const row of list) {
          nextEdits[row.id] = {
            role_family: row.role_family,
            region_code: row.region_code,
            role_title_norm: row.role_title_norm,
            city: row.city ?? "",
            employer_name_public: row.employer_name_public ?? "",
          };
        }
        setEdits(nextEdits);
      })
      .finally(() => setLoading(false));
  }, [token, reviewOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAndResolve(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/growth/observations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role_family: edit.role_family,
          region_code: edit.region_code,
          role_title_norm: edit.role_title_norm.trim(),
          city: edit.city.trim() || null,
          employer_name_public: edit.employer_name_public.trim() || null,
          resolve_review: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
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
          variant={reviewOnly ? "primary" : "secondary"}
          onClick={() => setReviewOnly(true)}
        >
          {tGrowth("growth.obs.filter_queue")}
        </Button>
        <Button
          size="sm"
          variant={reviewOnly ? "secondary" : "primary"}
          onClick={() => setReviewOnly(false)}
        >
          {tGrowth("growth.obs.filter_all")}
        </Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

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
          {rows.map((row) => {
            const edit = edits[row.id];
            return (
              <Card key={row.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-foreground">
                      {row.role_title_norm}
                    </p>
                    <p className="text-xs text-foreground-tertiary">
                      {row.channel_name ?? "—"} ·{" "}
                      {new Date(row.observed_at).toLocaleDateString("he-IL")}
                      {row.employer_name_public
                        ? ` · ${row.employer_name_public}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant={row.role_family === "other" ? "warning" : "info"}
                  >
                    {familyLabel(row.role_family)}
                  </Badge>
                  <Badge variant="muted">
                    {regionLabel(row.region_code)}
                    {row.city ? ` · ${row.city}` : ""}
                  </Badge>
                  {row.salary_min && (
                    <Badge variant="secondary">
                      ₪{row.salary_min}
                      {row.salary_max ? `–${row.salary_max}` : ""}
                    </Badge>
                  )}
                  {row.needs_review && (
                    <Badge variant="warning">
                      {tGrowth("growth.obs.needs_review")}
                    </Badge>
                  )}
                </div>

                {row.raw_text && (
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-primary-600"
                      onClick={() =>
                        setExpandedRaw((prev) => ({
                          ...prev,
                          [row.id]: !prev[row.id],
                        }))
                      }
                    >
                      {expandedRaw[row.id] ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {expandedRaw[row.id]
                        ? tGrowth("growth.obs.hide_raw")
                        : tGrowth("growth.obs.show_raw")}
                    </button>
                    {expandedRaw[row.id] && (
                      // Untrusted source text — rendered as plain text only
                      <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 border border-border p-3 text-xs text-foreground-secondary font-sans">
                        {row.raw_text}
                      </pre>
                    )}
                  </div>
                )}

                {row.needs_review && edit && (
                  <div className="rounded-lg bg-gray-50 border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground-secondary">
                      {tGrowth("growth.obs.classify")}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className={selectClass}
                        value={edit.role_family}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: { ...edit, role_family: e.target.value },
                          }))
                        }
                      >
                        {ROLE_FAMILIES.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label_he}
                          </option>
                        ))}
                      </select>
                      <select
                        className={selectClass}
                        value={edit.region_code}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: { ...edit, region_code: e.target.value },
                          }))
                        }
                      >
                        {GROWTH_REGIONS.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label_he}
                          </option>
                        ))}
                      </select>
                      <input
                        className={`${selectClass} flex-1 min-w-[160px]`}
                        value={edit.role_title_norm}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...edit,
                              role_title_norm: e.target.value,
                            },
                          }))
                        }
                        placeholder={tGrowth("growth.obs.role_title")}
                      />
                      <input
                        className={`${selectClass} w-28`}
                        value={edit.city}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: { ...edit, city: e.target.value },
                          }))
                        }
                        placeholder={tGrowth("growth.obs.city")}
                      />
                      <input
                        className={`${selectClass} w-36`}
                        value={edit.employer_name_public}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: {
                              ...edit,
                              employer_name_public: e.target.value,
                            },
                          }))
                        }
                        placeholder={tGrowth("growth.obs.employer")}
                      />
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => saveAndResolve(row.id)}
                        loading={saving}
                        disabled={edit.role_title_norm.trim().length < 2}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {tGrowth("growth.obs.save_resolve")}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
