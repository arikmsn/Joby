"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { MapPin, Clock, Banknote, Users, Search, AlertTriangle } from "lucide-react";

interface FeedShift {
  id: string;
  title: string;
  role_tag: string;
  city: string | null;
  location_name: string | null;
  address: string;
  start_at: string;
  end_at: string;
  pay_rate: number;
  pay_type: string;
  workers_needed: number;
  slots_filled: number;
  employer_name: string;
  business_name: string;
  has_sos?: boolean;
}

export default function WorkerShiftFeed() {
  const { token } = useAuth();
  const [shifts, setShifts] = useState<FeedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchShifts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (roleFilter) params.set("role_tag", roleFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (dateFilter) params.set("date", dateFilter);

      const res = await fetch(`/api/shifts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setShifts(data.shifts || []);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [token, roleFilter, cityFilter, dateFilter]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const roles = Array.from(
    new Set(shifts.map((s) => s.role_tag).filter(Boolean))
  );
  const cities = Array.from(
    new Set(shifts.map((s) => s.city).filter(Boolean))
  ) as string[];

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString("he-IL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(start: string, end: string) {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.round((ms / 3600000) * 10) / 10;
    return `${hours} שעות`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("feed.title")}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">{t("feed.all_roles")}</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        >
          <option value="">{t("feed.all_cities")}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          dir="ltr"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16">
          <Search className="h-10 w-10 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-foreground-secondary">{t("feed.no_shifts")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => (
            <Link key={shift.id} href={`/shifts/${shift.id}`}>
              <div className="bg-surface rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-card-hover transition-all active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-foreground truncate">
                        {shift.title}
                      </h3>
                      {shift.has_sos && (
                        <Badge variant="urgent" className="shrink-0">
                          <AlertTriangle className="h-3 w-3 ml-1" />
                          {t("sos.badge")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground-secondary">
                      {shift.business_name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {shift.role_tag}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-foreground-secondary mt-3">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-foreground-tertiary" />
                    {formatTime(shift.start_at)} ·{" "}
                    {formatDuration(shift.start_at, shift.end_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-foreground-tertiary" />
                    {shift.city || shift.location_name || shift.address}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Banknote className="h-4 w-4 text-primary" />
                    {t("general.currency")}
                    {shift.pay_rate}{" "}
                    <span className="font-normal text-foreground-secondary">
                      {shift.pay_type === "hourly"
                        ? t("shift.per_hour")
                        : t("shift.total")}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-foreground-secondary">
                    <Users className="h-3.5 w-3.5" />
                    {shift.slots_filled}/{shift.workers_needed}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
