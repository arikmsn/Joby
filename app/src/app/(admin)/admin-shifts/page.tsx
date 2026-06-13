"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShiftStatus } from "@/lib/constants";
import { Plus, Clock, MapPin, Users, CalendarDays } from "lucide-react";

interface ShiftRow {
  id: string;
  employer_id: string;
  title: string;
  role_tag: string;
  city: string | null;
  start_at: string;
  end_at: string;
  pay_rate: string;
  workers_needed: number;
  slots_filled: number;
  status: string;
  business_name: string | null;
  employer_name: string;
}

function statusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "success" as const;
    case "DRAFT":
      return "muted" as const;
    case "IN_PROGRESS":
      return "warning" as const;
    case "COMPLETED":
      return "info" as const;
    case "CANCELLED":
      return "danger" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: string) {
  const key = `shift.status.${status.toLowerCase()}` as Parameters<typeof t>[0];
  return t(key);
}

const STATUS_FILTERS = Object.values(ShiftStatus);

export default function AdminShiftsPage() {
  const { token } = useAuth();
  const { occupationLabel } = useOccupations();
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", "50");
    fetch(`/api/admin/shifts?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [token, status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.shifts")}</h1>
        <Link
          href="/admin-shifts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover text-sm font-medium shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          {t("shift.create")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={status === "" ? "primary" : "secondary"} onClick={() => setStatus("")}>
          {t("admin.common.all")}
        </Button>
        {STATUS_FILTERS.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "primary" : "secondary"} onClick={() => setStatus(s)}>
            {statusLabel(s)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-12">
          <CalendarDays className="h-10 w-10 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-foreground-secondary">{t("shift.no_shifts")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/admin-shifts/${s.id}`}
              className="block p-4 bg-surface rounded-xl border border-border hover:border-primary/30 hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-foreground-secondary">
                    {s.business_name || s.employer_name} · {occupationLabel(s.role_tag)}
                  </p>
                </div>
                <Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-secondary">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(s.start_at).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(s.start_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  {" - "}
                  {new Date(s.end_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {s.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {s.city}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {s.slots_filled}/{s.workers_needed}
                </span>
                <span className="font-medium text-foreground">
                  {t("general.currency")}
                  {s.pay_rate}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
