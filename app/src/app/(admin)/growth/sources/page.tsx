"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldAlert } from "lucide-react";
import {
  SourceChannelType,
  CollectionMethod,
  RiskTier,
  SourceChannelStatus,
  GrowthSubRole,
} from "@/lib/constants";

interface SourceChannelRow {
  id: string;
  type: string;
  name: string;
  url: string | null;
  collection_method: string;
  risk_tier: string;
  status: string;
  robots_tos_notes: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  [SourceChannelType.BOARD]: tGrowth("growth.source_type.board"),
  [SourceChannelType.FB_GROUP]: tGrowth("growth.source_type.fb_group"),
  [SourceChannelType.TELEGRAM]: tGrowth("growth.source_type.telegram"),
  [SourceChannelType.CAREER_PAGE]: tGrowth("growth.source_type.career_page"),
  [SourceChannelType.AGENCY]: tGrowth("growth.source_type.agency"),
  [SourceChannelType.GOV]: tGrowth("growth.source_type.gov"),
  [SourceChannelType.OTHER]: tGrowth("growth.source_type.other"),
};

const METHOD_LABELS: Record<string, string> = {
  [CollectionMethod.MANUAL]: tGrowth("growth.method.manual"),
  [CollectionMethod.FETCH]: tGrowth("growth.method.fetch"),
  [CollectionMethod.API]: tGrowth("growth.method.api"),
};

const RISK_LABELS: Record<string, string> = {
  [RiskTier.LOW]: tGrowth("growth.risk.low"),
  [RiskTier.MEDIUM]: tGrowth("growth.risk.medium"),
  [RiskTier.HIGH]: tGrowth("growth.risk.high"),
};

const STATUS_LABELS: Record<string, string> = {
  [SourceChannelStatus.PROPOSED]: tGrowth("growth.sources.proposed"),
  [SourceChannelStatus.APPROVED]: tGrowth("growth.sources.approved"),
  [SourceChannelStatus.PAUSED]: tGrowth("growth.sources.paused"),
};

const selectClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function GrowthSourcesPage() {
  const { token } = useAuth();
  const { hasAccess, subRole, isLoading: accessLoading } = useGrowthAccess();
  const [rows, setRows] = useState<SourceChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    url: "",
    type: SourceChannelType.BOARD as string,
    collection_method: CollectionMethod.MANUAL as string,
    risk_tier: RiskTier.MEDIUM as string,
    robots_tos_notes: "",
  });

  const canApprove =
    subRole === GrowthSubRole.SUPER_ADMIN || subRole === GrowthSubRole.GROWTH_OPS;

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/growth/sources?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function propose() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/growth/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          url: form.url.trim() || null,
          robots_tos_notes: form.robots_tos_notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      setForm({ ...form, name: "", url: "", robots_tos_notes: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/growth/sources/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
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
      <h1 className="text-2xl font-bold text-foreground">
        {tGrowth("growth.sources.title")}
      </h1>

      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">
          {tGrowth("growth.sources.propose")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label={tGrowth("growth.sources.name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label={tGrowth("growth.sources.url")}
            dir="ltr"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://"
          />
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">
              {tGrowth("growth.sources.type")}
            </label>
            <select
              className={selectClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">
              {tGrowth("growth.sources.method")}
            </label>
            <select
              className={selectClass}
              value={form.collection_method}
              onChange={(e) =>
                setForm({ ...form, collection_method: e.target.value })
              }
            >
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">
              {tGrowth("growth.sources.risk")}
            </label>
            <select
              className={selectClass}
              value={form.risk_tier}
              onChange={(e) => setForm({ ...form, risk_tier: e.target.value })}
            >
              {Object.entries(RISK_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={tGrowth("growth.sources.notes")}
            value={form.robots_tos_notes}
            onChange={(e) =>
              setForm({ ...form, robots_tos_notes: e.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={propose} loading={saving} disabled={!form.name.trim()}>
            <Plus className="h-4 w-4" />
            {tGrowth("growth.sources.propose")}
          </Button>
          {form.risk_tier === RiskTier.HIGH && (
            <span className="flex items-center gap-1 text-sm text-danger">
              <ShieldAlert className="h-4 w-4" />
              {tGrowth("growth.sources.high_risk_note")}
            </span>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-foreground-secondary">
          {tGrowth("growth.sources.empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-medium text-foreground">{row.name}</p>
                {row.url && (
                  <p className="text-xs text-foreground-tertiary truncate" dir="ltr">
                    {row.url}
                  </p>
                )}
              </div>
              <Badge variant="muted">{TYPE_LABELS[row.type] ?? row.type}</Badge>
              <Badge variant="muted">
                {METHOD_LABELS[row.collection_method] ?? row.collection_method}
              </Badge>
              <Badge variant={row.risk_tier === RiskTier.HIGH ? "danger" : "muted"}>
                {tGrowth("growth.sources.risk")}: {RISK_LABELS[row.risk_tier] ?? row.risk_tier}
              </Badge>
              <Badge
                variant={
                  row.status === SourceChannelStatus.APPROVED
                    ? "success"
                    : row.status === SourceChannelStatus.PAUSED
                      ? "danger"
                      : "muted"
                }
              >
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
              {canApprove && row.status !== SourceChannelStatus.APPROVED && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setStatus(row.id, SourceChannelStatus.APPROVED)}
                  loading={saving}
                >
                  {tGrowth("growth.sources.approve")}
                </Button>
              )}
              {canApprove && row.status === SourceChannelStatus.APPROVED && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setStatus(row.id, SourceChannelStatus.PAUSED)}
                  loading={saving}
                >
                  {tGrowth("growth.sources.pause")}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
