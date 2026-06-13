"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import Link from "next/link";
import {
  MapPin,
  Clock,
  AlertTriangle,
  SlidersHorizontal,
  X,
  CalendarClock,
  Zap,
} from "lucide-react";

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
  const { token, user } = useAuth();
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

  const roles = useMemo(
    () => Array.from(new Set(shifts.map((s) => s.role_tag).filter(Boolean))),
    [shifts]
  );
  const cities = useMemo(
    () => Array.from(new Set(shifts.map((s) => s.city).filter(Boolean))) as string[],
    [shifts]
  );

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

  function formatPay(rate: number) {
    const n = Number(rate);
    return n % 1 === 0 ? n.toString() : n.toFixed(2);
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

  function isToday(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  // Group: urgent (SOS) first, then today, then upcoming
  const urgent = shifts.filter((s) => s.has_sos);
  const today = shifts.filter((s) => !s.has_sos && isToday(s.start_at));
  const upcoming = shifts.filter((s) => !s.has_sos && !isToday(s.start_at));

  const firstName = user?.full_name?.split(" ")[0];

  function ShiftRow({ shift }: { shift: FeedShift }) {
    const spotsLeft = shift.workers_needed - shift.slots_filled;
    const soon = isStartingSoon(shift.start_at);
    const showMeta = shift.has_sos || soon || spotsLeft <= 1;

    return (
      <Link
        href={`/shifts/${shift.id}`}
        className="block px-4 py-3.5 active:bg-background transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{shift.title}</h3>
            <p className="text-sm text-foreground-secondary truncate mt-0.5">
              {shift.business_name} · {shift.role_tag}
            </p>
            <div className="flex items-center gap-3 text-xs text-foreground-tertiary mt-1.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(shift.start_at)} · {formatDuration(shift.start_at, shift.end_at)}
              </span>
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {shift.city || shift.location_name || shift.address}
              </span>
            </div>
          </div>

          <div className="shrink-0 text-left">
            <div className="text-lg font-bold text-foreground" dir="ltr">
              {t("general.currency")}{formatPay(shift.pay_rate)}
            </div>
            <div className="text-[11px] text-foreground-tertiary text-right">
              {shift.pay_type === "hourly" ? t("shift.per_hour") : t("shift.total")}
            </div>
          </div>
        </div>

        {showMeta && (
          <div className="flex items-center gap-3 flex-wrap mt-2">
            {shift.has_sos && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
                <AlertTriangle className="h-3 w-3" />
                {t("sos.badge")}
              </span>
            )}
            {!shift.has_sos && soon && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                {t("feed.starting_soon")}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                spotsLeft <= 1 ? "text-warning" : "text-foreground-tertiary"
              }`}
            >
              {spotsLeft > 1 && <span className="h-1.5 w-1.5 rounded-full bg-foreground-tertiary" />}
              {spotsLeft <= 1 && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
              {spotsLeft <= 0
                ? t("feed.full")
                : spotsLeft === 1
                  ? t("feed.spots_left_one")
                  : `${spotsLeft} ${t("feed.spots_left")}`}
            </span>
          </div>
        )}
      </Link>
    );
  }

  function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
    return (
      <div className="flex items-center gap-2 px-1 mb-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-foreground-tertiary">{count}</span>
      </div>
    );
  }

  function Section({ shifts: list }: { shifts: FeedShift[] }) {
    return (
      <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border-light">
        {list.map((s) => (
          <ShiftRow key={s.id} shift={s} />
        ))}
      </div>
    );
  }

  const hasAnyResults = shifts.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pt-1 space-y-1">
        <p className="text-sm text-foreground-secondary">
          {t("feed.greeting")}{firstName ? `, ${firstName}` : ""}
        </p>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {t("feed.subtitle")}
        </h1>
        {!loading && hasAnyResults && (
          <p className="text-sm text-foreground-tertiary pt-0.5">
            {shifts.length} {t("feed.title")}
            {urgent.length > 0 && (
              <span className="text-danger font-medium"> · {urgent.length} {t("feed.section_urgent")}</span>
            )}
          </p>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setRoleFilter("")}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
              !roleFilter
                ? "bg-primary text-white border-primary"
                : "bg-surface text-foreground-secondary border-border"
            }`}
          >
            {t("feed.all_roles")}
          </button>
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                roleFilter === r
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-foreground-secondary border-border"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            showFilters || cityFilter || dateFilter
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-foreground-secondary"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {(cityFilter || dateFilter) && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {[cityFilter, dateFilter].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Extra filters panel */}
      {showFilters && (
        <div className="bg-surface rounded-xl border border-border p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
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
              {t("feed.clear_filters")}
            </button>
          )}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasAnyResults ? (
        <div className="text-center py-20 px-4">
          <p className="font-semibold text-foreground">
            {activeFilterCount > 0 ? t("feed.no_match") : t("feed.no_shifts")}
          </p>
          <p className="text-sm text-foreground-secondary mt-1 max-w-xs mx-auto">
            {activeFilterCount > 0 ? t("feed.no_match_sub") : t("feed.no_shifts_sub")}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 hover:bg-primary/20 transition-colors"
            >
              {t("feed.clear_filters")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {urgent.length > 0 && (
            <div>
              <SectionHeader
                icon={<AlertTriangle className="h-4 w-4 text-danger" />}
                label={t("feed.section_urgent")}
                count={urgent.length}
              />
              <Section shifts={urgent} />
            </div>
          )}
          {today.length > 0 && (
            <div>
              <SectionHeader
                icon={<Zap className="h-4 w-4 text-warning" />}
                label={t("feed.section_today")}
                count={today.length}
              />
              <Section shifts={today} />
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <SectionHeader
                icon={<CalendarClock className="h-4 w-4 text-primary" />}
                label={t("feed.section_upcoming")}
                count={upcoming.length}
              />
              <Section shifts={upcoming} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
