"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import { ShiftListSkeleton } from "@/components/ui/skeleton";
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
  applicants?: { pending_count: number; backup_count: number };
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

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);

  if (diffDays === 0) return t("shift.day_today");
  if (diffDays === 1) return t("shift.day_tomorrow");
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

function fillStatus(slotsFilled: number, workersNeeded: number) {
  if (slotsFilled >= workersNeeded) {
    return { label: t("shift.fill_status.filled"), variant: "success" as const };
  }
  if (slotsFilled > 0) {
    return { label: t("shift.fill_status.partial"), variant: "warning" as const };
  }
  return { label: t("shift.fill_status.none"), variant: "danger" as const };
}

export default function EmployerShiftsPage() {
  const { token } = useAuth();
  const { occupationLabel } = useOccupations();
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

  const groupedShifts = useMemo(() => {
    const groups: { label: string; items: ShiftItem[] }[] = [];
    for (const s of shifts) {
      const label = dayLabel(s.start_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(s);
      } else {
        groups.push({ label, items: [s] });
      }
    }
    return groups;
  }, [shifts]);

  return (
    <div className="space-y-5 max-w-4xl animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.shifts")}</h1>
        <Link
          href="/manage-shifts/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover text-sm font-medium shadow-sm transition-all duration-150 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          {t("shift.create")}
        </Link>
      </div>

      {loading ? (
        <ShiftListSkeleton rows={4} />
      ) : shifts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-center py-16 bg-surface rounded-2xl border border-border">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background">
            <CalendarDays className="h-6 w-6 text-foreground-tertiary" />
          </div>
          <p className="text-foreground-secondary">{t("shift.no_shifts")}</p>
          <Link
            href="/manage-shifts/new"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 transition-all duration-150 hover:bg-primary/20 active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("shift.create")}
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedShifts.map((group) => (
            <div key={group.label}>
              <h2 className="text-sm font-semibold text-foreground-secondary px-1 mb-2">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/manage-shifts/${s.id}/edit`}
                    className="animate-card-pop block p-4 bg-surface rounded-2xl border border-border hover:border-primary/30 hover:shadow-card-hover active:scale-[0.99] transition-all duration-150"
                    style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{s.title}</h3>
                        <p className="text-sm text-foreground-secondary">{occupationLabel(s.role_tag)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge variant={statusVariant(s.status)}>
                          {statusLabel(s.status)}
                        </Badge>
                        {(s.status === "PUBLISHED" || s.status === "IN_PROGRESS") && (
                          <Badge variant={fillStatus(s.slots_filled, s.workers_needed).variant}>
                            {fillStatus(s.slots_filled, s.workers_needed).label}
                          </Badge>
                        )}
                      </div>
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
                    {(s.applicants?.pending_count || s.applicants?.backup_count) ? (
                      <div className="flex items-center gap-2 mt-2">
                        {!!s.applicants?.pending_count && (
                          <Badge variant="warning">
                            {s.applicants.pending_count}{" "}
                            {s.applicants.pending_count === 1 ? t("applicants.pending_one") : t("applicants.pending_many")}
                          </Badge>
                        )}
                        {!!s.applicants?.backup_count && (
                          <Badge variant="info">
                            {s.applicants.backup_count}{" "}
                            {s.applicants.backup_count === 1 ? t("applicants.backup_count_one") : t("applicants.backup_count_many")}
                          </Badge>
                        )}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
