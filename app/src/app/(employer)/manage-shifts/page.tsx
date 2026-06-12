"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Clock, MapPin, Users, CalendarDays } from "lucide-react";

interface ShiftItem {
  id: string;
  title: string;
  role_tag: string;
  city: string | null;
  start_at: string;
  end_at: string;
  pay_rate: string;
  workers_needed: number;
  slots_filled: number;
  status: string;
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

export default function EmployerShiftsPage() {
  const { token } = useAuth();
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/shifts?limit=50", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setShifts(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.shifts")}</h1>
        <Link
          href="/manage-shifts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover text-sm font-medium shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" />
          {t("shift.create")}
        </Link>
      </div>

      {shifts.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-xl border border-border">
          <CalendarDays className="h-10 w-10 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-foreground-secondary">{t("shift.no_shifts")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => (
            <Link
              key={s.id}
              href={`/manage-shifts/${s.id}/edit`}
              className="block p-4 bg-surface rounded-xl border border-border hover:border-primary/30 hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-foreground-secondary">{s.role_tag}</p>
                </div>
                <Badge variant={statusVariant(s.status)}>
                  {statusLabel(s.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-secondary">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(s.start_at).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(s.start_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(s.end_at).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
