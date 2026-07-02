"use client";

// Stage-1 collection-health panel. Aggregates only — the metrics endpoint
// never returns PII-bearing data by construction.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_FAMILIES, GROWTH_REGIONS } from "@/lib/constants";

interface MetricsData {
  observations: { today: number; last_7d: number };
  queue: { needs_review: number; unclassified: number };
  review_time: { median_seconds: number | null; resolved_7d: number };
  freshness: {
    fresh_channels: number;
    approved_channels: number;
    percent: number | null;
  };
  channels: {
    id: string;
    name: string;
    type: string;
    collection_method: string;
    yield_7d: number;
    last_signal_at: string | null;
    fresh: boolean;
    error: string | null;
  }[];
  clusters: {
    total: number;
    ad_worthy: number;
    top: {
      role_family: string;
      region_code: string;
      salary_band: string | null;
      observation_count: number;
      distinct_employer_count: number;
      trend: string;
      ad_worthy: boolean;
    }[];
  };
}

const familyLabel = (key: string) =>
  ROLE_FAMILIES.find((r) => r.key === key)?.label_he ?? key;
const regionLabel = (key: string) =>
  GROWTH_REGIONS.find((r) => r.key === key)?.label_he ?? key;

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds} שנ׳`;
  return `${Math.round(seconds / 60)} דק׳`;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="py-4 text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-foreground-secondary mt-1">{label}</p>
      {sub && <p className="text-xs text-foreground-tertiary mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function GrowthMetricsPage() {
  const { token } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useGrowthAccess();
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/growth/metrics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setData(d.data ?? null))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
        {tGrowth("growth.metrics.title")}
      </h1>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label={tGrowth("growth.metrics.obs_today")}
              value={data.observations.today}
            />
            <StatCard
              label={tGrowth("growth.metrics.obs_7d")}
              value={data.observations.last_7d}
            />
            <StatCard
              label={tGrowth("growth.metrics.queue_depth")}
              value={data.queue.needs_review}
              sub={`${tGrowth("growth.metrics.unclassified")}: ${data.queue.unclassified}`}
            />
            <StatCard
              label={tGrowth("growth.metrics.median_review")}
              value={formatDuration(data.review_time.median_seconds)}
              sub={`${tGrowth("growth.metrics.resolved_7d")}: ${data.review_time.resolved_7d} · ${tGrowth("growth.metrics.median_review_target")}`}
            />
            <StatCard
              label={tGrowth("growth.metrics.freshness")}
              value={
                data.freshness.percent != null
                  ? `${data.freshness.percent}%`
                  : "—"
              }
              sub={`${data.freshness.fresh_channels}/${data.freshness.approved_channels}`}
            />
            <StatCard
              label={tGrowth("growth.metrics.clusters_ad_worthy")}
              value={data.clusters.ad_worthy}
              sub={`${tGrowth("growth.metrics.clusters_total")}: ${data.clusters.total}`}
            />
          </div>

          <Card className="space-y-2">
            <h2 className="font-semibold text-foreground">
              {tGrowth("growth.metrics.channels_title")}
            </h2>
            {data.channels.length === 0 ? (
              <p className="text-sm text-foreground-secondary py-4 text-center">
                {tGrowth("growth.metrics.no_data")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.channels
                  .slice()
                  .sort((a, b) => b.yield_7d - a.yield_7d)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border last:border-0"
                    >
                      <span className="flex-1 min-w-[160px] text-sm font-medium text-foreground">
                        {c.name}
                      </span>
                      <Badge variant="secondary">
                        {tGrowth("growth.metrics.channel_yield")}: {c.yield_7d}
                      </Badge>
                      <Badge variant={c.fresh ? "success" : "warning"}>
                        {c.fresh
                          ? tGrowth("growth.metrics.channel_fresh")
                          : tGrowth("growth.metrics.channel_stale")}
                      </Badge>
                      {c.error && (
                        <Badge variant="danger" title={c.error}>
                          {tGrowth("growth.metrics.channel_error")}
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <h2 className="font-semibold text-foreground">
              {tGrowth("growth.metrics.clusters_title")}
            </h2>
            {data.clusters.top.length === 0 ? (
              <p className="text-sm text-foreground-secondary py-4 text-center">
                {tGrowth("growth.metrics.no_data")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.clusters.top.map((cl, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 py-1.5 border-b border-border last:border-0"
                  >
                    <span className="flex-1 min-w-[180px] text-sm font-medium text-foreground">
                      {familyLabel(cl.role_family)} · {regionLabel(cl.region_code)}
                      {cl.salary_band && cl.salary_band !== "unknown"
                        ? ` · ${cl.salary_band}`
                        : ""}
                    </span>
                    <Badge variant="secondary">
                      {tGrowth("growth.metrics.cluster_obs")}: {cl.observation_count}
                    </Badge>
                    <Badge variant="secondary">
                      {tGrowth("growth.metrics.cluster_employers")}: {cl.distinct_employer_count}
                    </Badge>
                    <Badge
                      variant={
                        cl.trend === "rising"
                          ? "success"
                          : cl.trend === "falling"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {cl.trend === "rising"
                        ? tGrowth("growth.metrics.trend.rising")
                        : cl.trend === "falling"
                          ? tGrowth("growth.metrics.trend.falling")
                          : tGrowth("growth.metrics.trend.stable")}
                    </Badge>
                    {cl.ad_worthy && (
                      <Badge variant="success">
                        {tGrowth("growth.metrics.clusters_ad_worthy")}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
