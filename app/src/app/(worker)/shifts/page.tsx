"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { MapPin, Clock, Banknote, Users, Search, AlertTriangle, SlidersHorizontal, X } from "lucide-react";

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
  const [showFilters, setShowFilters] = useState(false);

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
      setShifts(data.data || []);
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

  const activeFilterCount = [roleFilter, cityFilter, dateFilter].filter(Boolean).length;

  function clearFilters() {
    setRoleFilter("");
    setCityFilter("");
    setDateFilter("");
  }

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

  function isStartingSoon(iso: string) {
    const ms = new Date(iso).getTime() - Date.now();
    return ms > 0 && ms < 1000 * 60 * 60 * 6; // within 6 hours
  }

  // Urgent (SOS) shifts surface first so workers see the highest-priority opportunities immediately
  const sortedShifts = [...shifts].sort((a, b) => {
    if (!!a.has_sos !== !!b.has_sos) return a.has_sos ? -1 : 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("feed.title")}</h1>
          {!loading && (
            <p className="text-sm text-foreground-secondary mt-0.5">
              {shifts.length > 0
                ? `${shifts.length} משמרות מתאימות עבורך`
                : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-foreground-secondary"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("general.filter")}
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-surface rounded-xl border border-border p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              dir="ltr"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              נקה סינון
            </button>
          )}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedShifts.length === 0 ? (
        <div className="text-center py-16">
          <Search className="h-10 w-10 text-foreground-tertiary mx-auto mb-3" />
          <p className="text-foreground-secondary">
            {activeFilterCount > 0 ? "אין משמרות התואמות לסינון שבחרת" : t("feed.no_shifts")}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              נקה סינון וחזור לכל המשמרות
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedShifts.map((shift) => {
            const spotsLeft = shift.workers_needed - shift.slots_filled;
            const soon = isStartingSoon(shift.start_at);
            return (
              <Link key={shift.id} href={`/shifts/${shift.id}`}>
                <div
                  className={`bg-surface rounded-xl border p-4 transition-all active:scale-[0.99] hover:shadow-card-hover ${
                    shift.has_sos
                      ? "border-danger/40 hover:border-danger/60 ring-1 ring-danger/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">
                          {shift.title}
                        </h3>
                        {shift.has_sos && (
                          <Badge variant="urgent" className="shrink-0">
                            <AlertTriangle className="h-3 w-3 ml-1" />
                            {t("sos.badge")}
                          </Badge>
                        )}
                        {!shift.has_sos && soon && (
                          <Badge variant="warning" className="shrink-0">
                            מתחיל בקרוב
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground-secondary truncate">
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
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 text-foreground-tertiary shrink-0" />
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
                    <span
                      className={`flex items-center gap-1.5 text-sm ${
                        spotsLeft <= 1 ? "text-warning font-medium" : "text-foreground-secondary"
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {shift.slots_filled}/{shift.workers_needed}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
