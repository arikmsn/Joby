"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrustBadge } from "@/components/ui/trust-badge";
import { t } from "@/lib/i18n/he";
import { User } from "lucide-react";

interface WorkerProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  city: string | null;
  bio: string | null;
  experience_tags: string[] | null;
  trust_score: string | null;
  total_shifts: number | null;
  no_show_count: number | null;
  cancel_count: number | null;
  avg_rating: number | null;
  rating_count: number;
}

interface RatingItem {
  id: string;
  score: number;
  flag: string | null;
  comment: string | null;
  created_at: string;
  shift_title: string;
  shift_start_at: string;
  employer_name: string;
}

export default function WorkerProfilePage() {
  const { id: workerId } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [profileRes, ratingsRes] = await Promise.all([
        fetch(`/api/workers/${workerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/workers/${workerId}/ratings?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setWorker(data.worker);
      }
      if (ratingsRes.ok) {
        const data = await ratingsRes.json();
        setRatings(data.ratings || []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, workerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 text-center text-foreground-tertiary">
        {t("general.loading")}
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-6 text-center text-foreground-tertiary">
        {t("error.not_found")}
      </div>
    );
  }

  const trustScore = worker.trust_score
    ? parseFloat(worker.trust_score)
    : null;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t("profile.title")}</h1>
        <Button variant="ghost" onClick={() => router.back()}>
          {t("general.back")}
        </Button>
      </div>

      <div className="border border-border rounded-xl p-4 bg-surface space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{worker.full_name}</h2>
            {worker.city && (
              <p className="text-sm text-foreground-secondary">
                {t("profile.city")}: {worker.city}
              </p>
            )}
            {worker.created_at && (
              <p className="text-xs text-foreground-tertiary">
                {t("profile.member_since")}{" "}
                {new Date(worker.created_at).toLocaleDateString("he-IL")}
              </p>
            )}
          </div>
          {trustScore !== null && (
            <TrustBadge
              score={trustScore}
              totalShifts={worker.total_shifts || 0}
            />
          )}
        </div>

        {worker.bio && (
          <p className="text-sm text-foreground-secondary">{worker.bio}</p>
        )}

        {worker.experience_tags && worker.experience_tags.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {t("profile.experience")}
            </p>
            <div className="flex flex-wrap gap-1">
              {worker.experience_tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={t("profile.total_shifts")}
          value={String(worker.total_shifts || 0)}
        />
        <StatCard
          label={t("profile.avg_rating")}
          value={
            worker.avg_rating
              ? `${worker.avg_rating} ★ (${worker.rating_count})`
              : "—"
          }
        />
        <StatCard
          label={t("profile.no_show_count")}
          value={String(worker.no_show_count || 0)}
          danger={!!worker.no_show_count && worker.no_show_count > 0}
        />
        <StatCard
          label={t("profile.cancel_count")}
          value={String(worker.cancel_count || 0)}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">
          {t("profile.recent_ratings")}
        </h3>

        {ratings.length === 0 ? (
          <p className="text-foreground-tertiary text-center py-6">
            {t("profile.no_ratings")}
          </p>
        ) : (
          <div className="space-y-3">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="border border-border rounded-xl p-3 bg-surface space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">
                      {"★".repeat(r.score)}
                      {"☆".repeat(5 - r.score)}
                    </span>
                    {r.flag && (
                      <Badge variant="muted">{r.flag}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-foreground-tertiary">
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                  </span>
                </div>
                <p className="text-sm text-foreground-secondary">
                  {r.shift_title} — {r.employer_name}
                </p>
                {r.comment && (
                  <p className="text-sm text-foreground-tertiary italic">
                    &ldquo;{r.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-3 bg-surface text-center">
      <p className="text-xs text-foreground-tertiary">{label}</p>
      <p
        className={`text-lg font-bold ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
