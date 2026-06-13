"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IncidentStatus } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";

interface IncidentRow {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  related_user_name: string | null;
  related_shift_title: string | null;
  created_at: string;
}

function severityVariant(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "danger" as const;
    case "HIGH":
      return "warning" as const;
    case "MEDIUM":
      return "info" as const;
    default:
      return "muted" as const;
  }
}

function statusVariant(status: string) {
  switch (status) {
    case "OPEN":
      return "danger" as const;
    case "IN_REVIEW":
      return "warning" as const;
    case "RESOLVED":
      return "success" as const;
    case "DISMISSED":
      return "muted" as const;
    default:
      return "secondary" as const;
  }
}

const STATUS_FILTERS = Object.values(IncidentStatus);

export default function AdminIncidentsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>(IncidentStatus.OPEN);

  function load() {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", "50");
    fetch(`/api/admin/incidents?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  async function updateStatus(id: string, newStatus: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t("admin.incidents")}</h1>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={status === "" ? "primary" : "secondary"} onClick={() => setStatus("")}>
          {t("admin.common.all")}
        </Button>
        {STATUS_FILTERS.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "primary" : "secondary"} onClick={() => setStatus(s)}>
            {t(`admin.incident_status.${s.toLowerCase()}` as Parameters<typeof t>[0])}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-16">
          <AlertTriangle className="h-12 w-12 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-foreground-secondary font-medium">{t("admin.incidents.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((inc) => (
            <Card key={inc.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{inc.title}</h3>
                  <p className="text-sm text-foreground-secondary">
                    {t(`admin.incident_type.${inc.incident_type.toLowerCase()}` as Parameters<typeof t>[0])}
                    {inc.related_user_name && ` · ${inc.related_user_name}`}
                    {inc.related_shift_title && ` · ${inc.related_shift_title}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant(inc.severity)}>
                    {t(`admin.incident_severity.${inc.severity.toLowerCase()}` as Parameters<typeof t>[0])}
                  </Badge>
                  <Badge variant={statusVariant(inc.status)}>
                    {t(`admin.incident_status.${inc.status.toLowerCase()}` as Parameters<typeof t>[0])}
                  </Badge>
                </div>
              </div>
              {inc.description && <p className="text-sm text-foreground-secondary">{inc.description}</p>}
              <p className="text-xs text-foreground-tertiary">
                {new Date(inc.created_at).toLocaleString("he-IL")}
              </p>
              {(inc.status === IncidentStatus.OPEN || inc.status === IncidentStatus.IN_REVIEW) && (
                <div className="flex gap-2 pt-1">
                  {inc.status === IncidentStatus.OPEN && (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(inc.id, IncidentStatus.IN_REVIEW)} loading={saving}>
                      {t(`admin.incident_status.in_review` as Parameters<typeof t>[0])}
                    </Button>
                  )}
                  <Button size="sm" variant="success" onClick={() => updateStatus(inc.id, IncidentStatus.RESOLVED)} loading={saving}>
                    {t("admin.resolve")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(inc.id, IncidentStatus.DISMISSED)} loading={saving}>
                    {t("admin.dismiss")}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
