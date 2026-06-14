"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Badge } from "@/components/ui/badge";
import { EmployerAvatar } from "@/components/ui/employer-avatar";
import { TrustBadge } from "@/components/ui/trust-badge";
import Link from "next/link";
import type { WorkerProfile } from "@/lib/types";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { isOnboardingIncomplete, onboardingMissingKind, onboardingFirstIncompleteStep } from "@/lib/onboarding";
import { Sheet } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ShiftListSkeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Clock,
  AlertTriangle,
  SlidersHorizontal,
  X,
  Zap,
  Sparkles,
  Wand2,
  Pencil,
  EyeOff,
} from "lucide-react";

const DISMISSED_KEY = "joby_dismissed_shifts";

function getDismissedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function dismissShift(id: string) {
  const ids = getDismissedIds();
  ids.add(id);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch { /* quota */ }
}

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
  my_application?: { id: string; status: string; is_backup: boolean } | null;
}

function appliedBadge(app: { status: string; is_backup: boolean }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "muted" | "info" }> = {
    PENDING: { label: t("application.status.pending"), variant: "warning" },
    APPROVED: {
      label: app.is_backup ? t("applicants.backup") : t("application.status.approved"),
      variant: app.is_backup ? "info" : "success",
    },
    CONFIRMED: { label: t("application.status.confirmed"), variant: "success" },
    REJECTED: { label: t("application.status.rejected"), variant: "danger" },
    CHECKED_IN: { label: t("application.status.checked_in"), variant: "success" },
  };
  const m = map[app.status];
  return m ? <Badge variant={m.variant}>{m.label}</Badge> : null;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / 86400000;
  if (diff === 0) return t("shift.day_today");
  if (diff === 1) return t("shift.day_tomorrow");
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

export default function WorkerShiftFeed() {
  const { token, user, profile } = useAuth();
  const workerProfile = profile as WorkerProfile | null;
  const { occupations, occupationLabel } = useOccupations();
  const { openOnboarding } = useOnboarding();
  const [shifts, setShifts] = useState<FeedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"matched" | "all">("matched");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [weeklyEarnings, setWeeklyEarnings] = useState<number | null>(null);

  // Load dismissed IDs from localStorage
  useEffect(() => {
    setDismissedIds(getDismissedIds());
  }, []);

  // Fetch actual weekly earnings for the hero
  useEffect(() => {
    if (!token) return;
    fetch("/api/workers/earnings?range=week", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setWeeklyEarnings(d.totals?.estimated_earnings ?? 0))
      .catch(() => setWeeklyEarnings(0));
  }, [token]);

  const fetchShifts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (roleFilters.length > 0) params.set("role_tags", roleFilters.join(","));
      if (cityFilter) params.set("city", cityFilter);
      if (dateFilter) params.set("date", dateFilter);

      const res = await fetch(`/api/shifts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setShifts(data.data || []);
      setNewCount(0);
    } catch {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [token, roleFilters, cityFilter, dateFilter]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (roleFilters.length > 0) params.set("role_tags", roleFilters.join(","));
        if (cityFilter) params.set("city", cityFilter);
        if (dateFilter) params.set("date", dateFilter);

        const res = await fetch(`/api/shifts?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const latestIds = new Set<string>((data.data || []).map((s: FeedShift) => s.id));
        const currentIds = new Set(shifts.map((s) => s.id));
        let added = 0;
        latestIds.forEach((id) => {
          if (!currentIds.has(id)) added++;
        });
        setNewCount(added);
      } catch { /* ignore */ }
    }, 60000);
    return () => clearInterval(interval);
  }, [token, roleFilters, cityFilter, dateFilter, shifts]);

  // Filter out approved shifts and dismissed shifts
  const visibleShifts = useMemo(
    () =>
      shifts.filter(
        (s) =>
          !dismissedIds.has(s.id) &&
          (!s.my_application ||
            !["APPROVED", "CONFIRMED", "CHECKED_IN"].includes(s.my_application.status))
      ),
    [shifts, dismissedIds]
  );

  const cities = useMemo(
    () => Array.from(new Set(visibleShifts.map((s) => s.city).filter(Boolean))) as string[],
    [visibleShifts]
  );

  const preferredRoles = workerProfile?.experience_tags || [];
  const preferredCities = workerProfile?.preferred_cities || [];
  const hasPreferences = preferredRoles.length > 0 || preferredCities.length > 0;

  function roleMatches(s: FeedShift) {
    return preferredRoles.includes(s.role_tag);
  }
  function cityMatches(s: FeedShift) {
    return !!s.city && preferredCities.includes(s.city);
  }
  function payMatches(s: FeedShift) {
    return (
      workerProfile?.min_pay != null &&
      s.pay_type === "hourly" &&
      Number(s.pay_rate) >= workerProfile.min_pay
    );
  }

  const matchedShifts = useMemo(() => {
    if (!hasPreferences) return visibleShifts;
    return visibleShifts
      .filter((s) => roleMatches(s) || cityMatches(s))
      .slice()
      .sort((a, b) => {
        const score = (s: FeedShift) => (roleMatches(s) ? 2 : 0) + (cityMatches(s) ? 1 : 0);
        return score(b) - score(a);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleShifts, hasPreferences, preferredRoles, preferredCities]);

  const displayedShifts = activeTab === "matched" ? matchedShifts : visibleShifts;

  const activeFilterCount = roleFilters.length + [cityFilter, dateFilter].filter(Boolean).length;

  const sortedOccupations = useMemo(
    () => [...occupations].sort((a, b) => a.label_he.localeCompare(b.label_he, "he")),
    [occupations]
  );
  const filteredRoleOptions = useMemo(() => {
    if (!roleSearch.trim()) return sortedOccupations;
    return sortedOccupations.filter((o) => o.label_he.includes(roleSearch.trim()));
  }, [sortedOccupations, roleSearch]);

  function toggleRoleFilter(key: string) {
    setRoleFilters((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  }

  function clearFilters() {
    setRoleFilters([]);
    setRoleSearch("");
    setCityFilter("");
    setDateFilter("");
  }

  function formatTimeOnly(iso: string) {
    return new Date(iso).toLocaleTimeString("he-IL", {
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
    return ms > 0 && ms < 1000 * 60 * 60 * 6;
  }

  function handleDismiss(shiftId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dismissShift(shiftId);
    setDismissedIds(getDismissedIds());
  }

  // Group shifts by day
  const dayGroups = useMemo(() => {
    const urgent = displayedShifts.filter((s) => s.has_sos);
    const rest = displayedShifts.filter((s) => !s.has_sos);

    const groups: { key: string; label: string; shifts: FeedShift[]; isUrgent?: boolean }[] = [];

    if (urgent.length > 0) {
      groups.push({ key: "__urgent", label: t("feed.section_urgent"), shifts: urgent, isUrgent: true });
    }

    const byDay = new Map<string, FeedShift[]>();
    for (const s of rest) {
      const key = dayKey(s.start_at);
      const arr = byDay.get(key) || [];
      arr.push(s);
      byDay.set(key, arr);
    }

    const sortedDays = Array.from(byDay.keys()).sort();
    for (const dk of sortedDays) {
      const dayShifts = byDay.get(dk)!;
      groups.push({ key: dk, label: dayLabel(dayShifts[0].start_at), shifts: dayShifts });
    }

    return groups;
  }, [displayedShifts]);

  function ShiftRow({ shift }: { shift: FeedShift }) {
    const spotsLeft = shift.workers_needed - shift.slots_filled;
    const soon = isStartingSoon(shift.start_at);

    const matchCount = (roleMatches(shift) ? 1 : 0) + (cityMatches(shift) ? 1 : 0) + (payMatches(shift) ? 1 : 0);
    const matchScore = hasPreferences ? Math.round((matchCount / 3) * 100) : 0;
    const recommended = hasPreferences && matchCount >= 2;

    return (
      <div className="relative group">
        <Link
          href={`/shifts/${shift.id}`}
          className="block rounded-2xl border border-border bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover active:scale-[0.99] animate-card-pop"
        >
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2.5 empty:mb-0">
            {shift.has_sos && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
                <AlertTriangle className="h-3 w-3" />
                {t("sos.badge")}
              </span>
            )}
            {!shift.has_sos && soon && (
              <Badge variant="warning">
                <Zap className="h-3 w-3" />
                {t("feed.badge_immediate")}
              </Badge>
            )}
            {recommended && (
              <Badge className="bg-accent-light text-accent border border-accent/20">
                <Sparkles className="h-3 w-3" />
                {t("feed.badge_recommended")}
              </Badge>
            )}
            {spotsLeft === 1 && (
              <Badge variant="warning">{t("feed.badge_urgent")}</Badge>
            )}
            {shift.my_application && appliedBadge(shift.my_application)}
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <EmployerAvatar name={shift.business_name || shift.title} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground-secondary truncate">
                  {shift.business_name}
                  {shift.city && <> · {shift.city}</>}
                </p>
                <h3 className="font-bold text-foreground truncate leading-snug">{shift.title}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                    <Clock className="h-3.5 w-3.5 text-foreground-tertiary" />
                    {formatTimeOnly(shift.start_at)}–{formatTimeOnly(shift.end_at)}
                  </span>
                  <span className="text-xs text-foreground-tertiary">
                    {formatDuration(shift.start_at, shift.end_at)}
                  </span>
                </div>
                {(shift.location_name || shift.address) && (
                  <div className="flex items-center gap-1 text-xs text-foreground-secondary mt-1">
                    <MapPin className="h-3 w-3 shrink-0 text-foreground-tertiary" />
                    <span className="truncate">{shift.location_name || shift.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-xl font-extrabold text-secondary font-numeric tabular-nums text-right" dir="ltr">
                {t("general.currency")}{formatPay(shift.pay_rate)}
              </div>
              <div className="text-[11px] text-foreground-tertiary">
                {shift.pay_type === "hourly" ? t("shift.per_hour") : t("shift.total")}
              </div>
            </div>
          </div>

          {/* Match score */}
          {matchScore > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-border-light overflow-hidden">
                <div
                  className="h-full rounded-full bg-secondary"
                  style={{ width: `${matchScore}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-secondary shrink-0">
                {matchScore}% {t("feed.match_score")}
              </span>
            </div>
          )}

          {/* Spots left */}
          {spotsLeft >= 0 && spotsLeft !== 1 && (
            <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-foreground-tertiary">
              <span className={`h-1.5 w-1.5 rounded-full ${spotsLeft === 0 ? "bg-foreground-tertiary" : "bg-success"}`} />
              {spotsLeft === 0 ? t("feed.full") : `${spotsLeft} ${t("feed.spots_left")}`}
            </div>
          )}

          {/* CTA */}
          <div className="mt-3 rounded-xl bg-secondary/8 text-secondary text-sm font-bold text-center py-2.5 transition-colors">
            {t("feed.cta_view_opportunity")}
          </div>
        </Link>

        {/* Dismiss button */}
        {!shift.my_application && (
          <button
            onClick={(e) => handleDismiss(shift.id, e)}
            className="absolute top-3 start-3 opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full p-1.5 bg-surface/90 border border-border text-foreground-tertiary hover:text-foreground hover:bg-surface transition-all duration-150 shadow-sm"
            title={t("feed.dismiss_shift")}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  const hasAnyResults = displayedShifts.length > 0;
  const noMatchedPreferences =
    activeTab === "matched" && hasPreferences && shifts.length > 0 && matchedShifts.length === 0;

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="hero-glow rounded-3xl p-6 text-white shadow-float -mx-1 animate-card-pop">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/65">
              {t("feed.hero_greeting")}{firstName ? `, ${firstName}` : ""}
            </p>
            {!loading && (
              <h1 className="text-lg font-extrabold tracking-tight mt-1 text-balance">
                {matchedShifts.length > 0
                  ? t("feed.hero_greeting_with_count").replace("{count}", String(matchedShifts.length))
                  : t("feed.hero_greeting_none")}
              </h1>
            )}
          </div>
          {/* Edit preferences action (replaces logo) */}
          <Link
            href="/profile"
            className="shrink-0 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/15 hover:bg-white/20 transition-colors"
            title={t("feed.edit_preferences")}
          >
            <Pencil className="h-5 w-5 text-white/80" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3.5">
            <p className="text-xs text-white/60">{t("feed.hero_earnings_week")}</p>
            <p className="text-xl font-extrabold font-numeric tabular-nums mt-1 text-right" dir="ltr">
              {t("general.currency")}{weeklyEarnings != null ? formatPay(weeklyEarnings) : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3.5">
            <p className="text-xs text-white/60 mb-1.5">{t("feed.hero_rating")}</p>
            <TrustBadge
              score={workerProfile?.trust_score ?? null}
              totalShifts={workerProfile?.total_shifts ?? 0}
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Onboarding prompt for skipped/incomplete preferences */}
      {isOnboardingIncomplete(workerProfile) && (
        <button
          onClick={() => openOnboarding(onboardingFirstIncompleteStep(workerProfile))}
          className="w-full flex items-center gap-2 rounded-xl bg-primary/10 text-primary text-sm font-medium px-4 py-2.5 hover:bg-primary/20 transition-colors text-right"
        >
          <Wand2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {(() => {
              const kind = onboardingMissingKind(workerProfile);
              switch (kind) {
                case "roles":
                  return t("onboarding.incomplete_roles");
                case "cities":
                  return t("onboarding.incomplete_cities");
                case "preferences":
                  return t("onboarding.incomplete_preferences");
                default:
                  return t("onboarding.incomplete_prompt");
              }
            })()}
          </span>
        </button>
      )}

      {/* New shifts banner */}
      {newCount > 0 && (
        <button
          onClick={fetchShifts}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold px-4 py-2.5 hover:bg-primary/20 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          {newCount} {newCount === 1 ? t("feed.new_shifts_one") : t("feed.new_shifts_many")}
          {" · "}
          {t("feed.refresh_now")}
        </button>
      )}

      {/* Tabs + filter button */}
      <div className="flex items-center gap-2">
        <SegmentedControl
          layoutId="feed-tab-pill"
          className="flex-1"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "matched", label: t("feed.tab_matched") },
            { value: "all", label: t("feed.tab_all") },
          ]}
        />
        <button
          onClick={() => setShowFilters(true)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.96] ${
            activeFilterCount > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-foreground-secondary hover:border-foreground-tertiary/40"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters sheet */}
      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title={t("feed.filter_role")}>
        <div className="space-y-3 pb-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-foreground-secondary">{t("feed.filter_role")}</p>
              {roleFilters.length > 0 && (
                <button
                  onClick={() => setRoleFilters([])}
                  className="text-xs text-primary font-medium"
                >
                  {t("feed.all_roles")}
                </button>
              )}
            </div>
            <input
              type="text"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder={t("feed.search_role")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
            />
            {roleFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {roleFilters.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 animate-pop-in"
                  >
                    {occupationLabel(key)}
                    <button onClick={() => toggleRoleFilter(key)} aria-label={t("general.remove")} className="rounded-full transition-colors hover:bg-primary/20 active:scale-90">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border-light divide-y divide-border-light">
              {filteredRoleOptions.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-3">{t("feed.no_match")}</p>
              ) : (
                filteredRoleOptions.map((opt) => {
                  const selected = roleFilters.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleRoleFilter(opt.key)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors active:bg-primary/10 ${
                        selected ? "bg-primary/5 text-primary font-medium" : "text-foreground-secondary hover:bg-background"
                      }`}
                    >
                      {opt.label_he}
                      {selected && <span className="text-primary">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
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
              className="flex-1 min-w-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
              dir="ltr"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                {t("feed.clear_filters")}
              </button>
            )}
            <button
              onClick={() => setShowFilters(false)}
              className="mr-auto rounded-full bg-primary text-white text-sm font-semibold px-5 py-2 shadow-sm shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-md active:scale-[0.97]"
            >
              {t("general.close")}
            </button>
          </div>
        </div>
      </Sheet>

      {/* Feed */}
      {loading ? (
        <ShiftListSkeleton rows={3} />
      ) : !hasAnyResults ? (
        <div className="text-center py-20 px-4">
          <p className="font-semibold text-foreground">
            {noMatchedPreferences
              ? t("feed.no_matches_yet")
              : activeFilterCount > 0
                ? t("feed.no_match")
                : t("feed.no_shifts")}
          </p>
          <p className="text-sm text-foreground-secondary mt-1 max-w-xs mx-auto">
            {noMatchedPreferences
              ? t("feed.no_matches_yet_sub")
              : activeFilterCount > 0
                ? t("feed.no_match_sub")
                : t("feed.no_shifts_sub")}
          </p>
          {noMatchedPreferences ? (
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab("all")}
                className="rounded-full bg-primary/10 text-primary text-sm font-semibold px-4 py-2 hover:bg-primary/20 transition-colors"
              >
                {t("feed.go_to_all")}
              </button>
              <Link
                href="/profile"
                className="rounded-full border border-border text-foreground-secondary text-sm font-semibold px-4 py-2 hover:bg-background transition-colors"
              >
                {t("feed.set_preferences")}
              </Link>
            </div>
          ) : activeFilterCount > 0 && (
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
          {dayGroups.map((group) => (
            <div key={group.key}>
              <div className="flex items-center gap-2 px-1 mb-2">
                {group.isUrgent ? (
                  <AlertTriangle className="h-4 w-4 text-danger" />
                ) : (
                  <Clock className="h-4 w-4 text-foreground-tertiary" />
                )}
                <h2 className="text-sm font-bold text-foreground">{group.label}</h2>
                <span className="text-xs text-foreground-tertiary">{group.shifts.length}</span>
              </div>
              <div className="space-y-3">
                {group.shifts.map((s) => (
                  <ShiftRow key={s.id} shift={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
