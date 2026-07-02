"use client";

// Source detail — admin-only crawl configuration, test (dry-run), and run
// history. All writes go through guarded /api/admin/growth/sources/[id]*
// endpoints; config is re-validated server-side against sourceConfigSchema.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, FlaskConical, Save } from "lucide-react";
import { ROLE_FAMILIES, GrowthSubRole } from "@/lib/constants";

const labelClass = "block text-sm font-medium text-foreground-secondary mb-1";
const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";

interface Config {
  seed_urls: string[];
  max_depth: number;
  same_domain_only: boolean;
  max_pages_per_run: number;
  crawl_delay_ms: number;
  stale_threshold_hours: number;
  include_rules: string[];
  exclude_rules: string[];
  interest: {
    role_families: string[];
    include_keywords: string[];
    exclude_keywords: string[];
    regions: string[];
    cities: string[];
    employer_type: string | null;
    hard_keyword_filter: boolean;
  };
  schedule: {
    frequency_hours: number;
    window_start_hour: number;
    window_end_hour: number;
    max_runtime_ms: number;
    max_retries: number;
  };
}

interface Channel {
  id: string;
  name: string;
  type: string;
  url: string | null;
  status: string;
  crawl_enabled: boolean;
  robots_tos_notes: string | null;
  last_collected_at: string | null;
  last_collect_error: string | null;
  consecutive_failures: number;
  config: Config;
}

const lines = (arr: string[]) => arr.join("\n");
const parseLines = (s: string) =>
  s.split("\n").map((l) => l.trim()).filter(Boolean);
const csv = (arr: string[]) => arr.join(", ");
const parseCsv = (s: string) =>
  s.split(",").map((l) => l.trim()).filter(Boolean);

export default function SourceDetailPage() {
  const { token } = useAuth();
  const { hasAccess, subRole, isLoading: accessLoading } = useGrowthAccess();
  const params = useParams();
  const id = params?.id as string;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [crawlEnabled, setCrawlEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);

  const canRun =
    subRole === GrowthSubRole.SUPER_ADMIN || subRole === GrowthSubRole.GROWTH_OPS;

  const load = useCallback(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/growth/sources/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`/api/admin/growth/sources/${id}/runs?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([detail, runsData]) => {
        if (detail.data) {
          setChannel(detail.data);
          setCfg(detail.data.config);
          setCrawlEnabled(detail.data.crawl_enabled);
        }
        setRuns(runsData.data || []);
      })
      .finally(() => setLoading(false));
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  function up<K extends keyof Config>(key: K, value: Config[K]) {
    setCfg((c) => (c ? { ...c, [key]: value } : c));
  }
  function upInterest<K extends keyof Config["interest"]>(
    key: K,
    value: Config["interest"][K]
  ) {
    setCfg((c) =>
      c ? { ...c, interest: { ...c.interest, [key]: value } } : c
    );
  }
  function upSchedule<K extends keyof Config["schedule"]>(
    key: K,
    value: Config["schedule"][K]
  ) {
    setCfg((c) =>
      c ? { ...c, schedule: { ...c.schedule, [key]: value } } : c
    );
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setError("");
    setNote("");
    try {
      const res = await fetch(`/api/admin/growth/sources/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ crawl_enabled: crawlEnabled, config: cfg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      setNote(tGrowth("growth.cfg.saved"));
      load();
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!cfg) return;
    setTesting(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/growth/sources/${id}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ config: cfg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      setTestResult(data.data);
    } finally {
      setTesting(false);
    }
  }

  async function runNow() {
    setSaving(true);
    setError("");
    setNote("");
    try {
      const res = await fetch(`/api/admin/growth/sources/${id}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      setNote(`${tGrowth("growth.sources.run_done")}: +${data.ingested}`);
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
  if (loading || !channel || !cfg) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = testResult?.summary as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/growth/sources"
            className="flex items-center gap-1 text-sm text-primary-600"
          >
            <ArrowRight className="h-4 w-4" />
            {tGrowth("growth.back")}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            {channel.name}
          </h1>
          {channel.url && (
            <p className="text-xs text-foreground-tertiary" dir="ltr">
              {channel.url}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={runTest} loading={testing}>
            <FlaskConical className="h-4 w-4" />
            {tGrowth("growth.sources.test")}
          </Button>
          {canRun && channel.status === "approved" && (
            <Button variant="secondary" onClick={runNow} loading={saving}>
              <Play className="h-4 w-4" />
              {tGrowth("growth.sources.run_now")}
            </Button>
          )}
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" />
            {tGrowth("growth.cfg.save")}
          </Button>
        </div>
      </div>

      {note && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {note}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {channel.last_collect_error && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {tGrowth("growth.runs.error")}: {channel.last_collect_error} (
          {channel.consecutive_failures})
        </p>
      )}

      {/* Crawl config */}
      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">
          {tGrowth("growth.cfg.title")}
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={crawlEnabled}
            onChange={(e) => setCrawlEnabled(e.target.checked)}
          />
          {tGrowth("growth.cfg.crawl_enabled")}
        </label>
        <div>
          <label className={labelClass}>{tGrowth("growth.cfg.seed_urls")}</label>
          <textarea
            className={`${inputClass} min-h-[70px] font-mono`}
            dir="ltr"
            value={lines(cfg.seed_urls)}
            onChange={(e) => up("seed_urls", parseLines(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.max_depth")}</label>
            <input type="number" min={0} max={5} className={inputClass} dir="ltr"
              value={cfg.max_depth}
              onChange={(e) => up("max_depth", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.max_pages")}</label>
            <input type="number" min={1} max={200} className={inputClass} dir="ltr"
              value={cfg.max_pages_per_run}
              onChange={(e) => up("max_pages_per_run", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.crawl_delay")}</label>
            <input type="number" min={2000} max={60000} step={1000} className={inputClass} dir="ltr"
              value={cfg.crawl_delay_ms}
              onChange={(e) => up("crawl_delay_ms", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.stale_threshold")}</label>
            <input type="number" min={6} max={168} className={inputClass} dir="ltr"
              value={cfg.stale_threshold_hours}
              onChange={(e) => up("stale_threshold_hours", Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" checked={cfg.same_domain_only}
              onChange={(e) => up("same_domain_only", e.target.checked)} />
            {tGrowth("growth.cfg.same_domain")}
          </label>
        </div>
      </Card>

      {/* Include/exclude rules */}
      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">
          {tGrowth("growth.cfg.rules_title")}
        </h2>
        <p className="text-xs text-foreground-tertiary">
          {tGrowth("growth.cfg.rules_hint")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.include_rules")}</label>
            <textarea className={`${inputClass} min-h-[90px] font-mono`} dir="ltr"
              value={lines(cfg.include_rules)}
              onChange={(e) => up("include_rules", parseLines(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.exclude_rules")}</label>
            <textarea className={`${inputClass} min-h-[90px] font-mono`} dir="ltr"
              value={lines(cfg.exclude_rules)}
              onChange={(e) => up("exclude_rules", parseLines(e.target.value))} />
          </div>
        </div>
      </Card>

      {/* Interest filters */}
      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">
          {tGrowth("growth.cfg.interest_title")}
        </h2>
        <p className="text-xs text-foreground-tertiary">
          {tGrowth("growth.cfg.hard_soft_hint")}
        </p>
        <div>
          <label className={labelClass}>{tGrowth("growth.cfg.role_families")}</label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FAMILIES.filter((r) => r.key !== "other").map((r) => {
              const on = cfg.interest.role_families.includes(r.key);
              return (
                <button key={r.key} type="button"
                  onClick={() =>
                    upInterest(
                      "role_families",
                      on
                        ? cfg.interest.role_families.filter((k) => k !== r.key)
                        : [...cfg.interest.role_families, r.key]
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                    on
                      ? "bg-primary-100 border-primary text-primary-800"
                      : "bg-white border-border text-foreground-secondary"
                  }`}>
                  {r.label_he}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.include_keywords")}</label>
            <input className={inputClass}
              value={csv(cfg.interest.include_keywords)}
              onChange={(e) => upInterest("include_keywords", parseCsv(e.target.value))}
              placeholder={tGrowth("growth.cfg.comma_hint")} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.exclude_keywords")}</label>
            <input className={inputClass}
              value={csv(cfg.interest.exclude_keywords)}
              onChange={(e) => upInterest("exclude_keywords", parseCsv(e.target.value))}
              placeholder={tGrowth("growth.cfg.comma_hint")} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.cities")}</label>
            <input className={inputClass}
              value={csv(cfg.interest.cities)}
              onChange={(e) => upInterest("cities", parseCsv(e.target.value))}
              placeholder={tGrowth("growth.cfg.comma_hint")} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.interest.hard_keyword_filter}
            onChange={(e) => upInterest("hard_keyword_filter", e.target.checked)} />
          {tGrowth("growth.cfg.hard_filter")}
        </label>
      </Card>

      {/* Schedule */}
      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">
          {tGrowth("growth.cfg.schedule_title")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.frequency")}</label>
            <input type="number" min={1} max={168} className={inputClass} dir="ltr"
              value={cfg.schedule.frequency_hours}
              onChange={(e) => upSchedule("frequency_hours", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.window_start")}</label>
            <input type="number" min={0} max={23} className={inputClass} dir="ltr"
              value={cfg.schedule.window_start_hour}
              onChange={(e) => upSchedule("window_start_hour", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.window_end")}</label>
            <input type="number" min={0} max={23} className={inputClass} dir="ltr"
              value={cfg.schedule.window_end_hour}
              onChange={(e) => upSchedule("window_end_hour", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.max_runtime")}</label>
            <input type="number" min={10000} max={240000} step={10000} className={inputClass} dir="ltr"
              value={cfg.schedule.max_runtime_ms}
              onChange={(e) => upSchedule("max_runtime_ms", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.cfg.max_retries")}</label>
            <input type="number" min={0} max={10} className={inputClass} dir="ltr"
              value={cfg.schedule.max_retries}
              onChange={(e) => upSchedule("max_retries", Number(e.target.value))} />
          </div>
        </div>
      </Card>

      {/* Test result */}
      {summary && (
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground">
            {tGrowth("growth.test.title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{tGrowth("growth.test.discovered")}: {String(summary.discovered)}</Badge>
            <Badge variant="success">{tGrowth("growth.test.allowed")}: {String(summary.allowed)}</Badge>
            <Badge variant="danger">{tGrowth("growth.test.blocked")}: {String(summary.blocked)}</Badge>
            <Badge variant="info">{tGrowth("growth.test.ingestable")}: {String(summary.ingestable)}</Badge>
            <Badge variant="warning">{tGrowth("growth.test.filtered")}: {String(summary.filtered_out)}</Badge>
          </div>
          {Array.isArray(testResult?.blocked_urls) && (testResult!.blocked_urls as unknown[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground-secondary mb-1">
                {tGrowth("growth.test.blocked_urls")}
              </p>
              <div className="max-h-40 overflow-y-auto text-xs space-y-0.5" dir="ltr">
                {(testResult!.blocked_urls as { url: string; verdict: string }[]).map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-danger shrink-0">{b.verdict}</span>
                    <span className="text-foreground-tertiary truncate">{b.url}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(testResult?.samples) && (testResult!.samples as unknown[]).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground-secondary mb-1">
                {tGrowth("growth.test.samples")}
              </p>
              <div className="space-y-2">
                {(testResult!.samples as { url: string; priority: number; outcome: string; sample: string }[]).map((s, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 border border-border p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={s.outcome === "filtered" ? "warning" : "success"}>{s.outcome}</Badge>
                      <span className="text-xs text-foreground-tertiary">P{s.priority}</span>
                      <span className="text-xs text-foreground-tertiary truncate" dir="ltr">{s.url}</span>
                    </div>
                    <p className="text-xs text-foreground-secondary line-clamp-3">{s.sample}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Run history */}
      <Card className="space-y-2">
        <h2 className="font-semibold text-foreground">
          {tGrowth("growth.runs.title")}
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-foreground-secondary py-4 text-center">
            {tGrowth("growth.runs.empty")}
          </p>
        ) : (
          <div className="space-y-1">
            {runs.map((r) => (
              <div key={r.id as string}
                className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border last:border-0 text-sm">
                <span className="text-xs text-foreground-tertiary w-32 shrink-0">
                  {new Date(r.started_at as string).toLocaleString("he-IL")}
                </span>
                <Badge variant={r.status === "success" ? "success" : r.status === "error" ? "danger" : "muted"}>
                  {r.status === "success"
                    ? tGrowth("growth.runs.success")
                    : r.status === "error"
                      ? tGrowth("growth.runs.error")
                      : tGrowth("growth.runs.running")}
                </Badge>
                <Badge variant="muted">
                  {r.trigger === "manual"
                    ? tGrowth("growth.runs.trigger.manual")
                    : tGrowth("growth.runs.trigger.cron")}
                </Badge>
                <span className="text-xs text-foreground-secondary">
                  {tGrowth("growth.runs.pages")}: {String(r.pages_crawled)} ·{" "}
                  {tGrowth("growth.runs.ingested")}: {String(r.items_ingested)} ·{" "}
                  {tGrowth("growth.runs.duplicates")}: {String(r.duplicates)} ·{" "}
                  {tGrowth("growth.runs.filtered")}: {String(r.filtered_out)}
                </span>
                {r.error ? (
                  <span className="text-xs text-danger truncate">{String(r.error)}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
