"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrustBadge } from "@/components/ui/trust-badge";
import { OccupationPicker } from "@/components/ui/occupation-picker";
import { ArrowRight } from "lucide-react";

interface WorkerDetail {
  id: string;
  phone: string;
  full_name: string;
  is_active: boolean;
  created_by_admin: boolean;
  created_at: string;
  city: string | null;
  bio: string | null;
  experience_tags: string[] | null;
  trust_score: number;
  total_shifts: number;
  no_show_count: number;
  cancel_count: number;
  avg_rating: number | null;
  rating_count: number;
}

export default function AdminWorkerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { token } = useAuth();
  const { occupations } = useOccupations();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", city: "", bio: "" });
  const [tags, setTags] = useState<string[]>([]);

  function load() {
    if (!token || !id) return;
    fetch(`/api/admin/workers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.worker) {
          setWorker(d.worker);
          setForm({
            full_name: d.worker.full_name || "",
            city: d.worker.city || "",
            bio: d.worker.bio || "",
          });
          setTags(d.worker.experience_tags || []);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/workers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, experience_tags: tags }),
      });
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!worker) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/workers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !worker.is_active }),
      });
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!worker) {
    return <p className="text-center py-8 text-danger">{t("error.not_found")}</p>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        {t("general.back")}
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{worker.full_name}</h1>
        <div className="flex items-center gap-2">
          <TrustBadge score={worker.trust_score} totalShifts={worker.total_shifts} size="md" />
          <Badge variant={worker.is_active ? "success" : "muted"}>
            {worker.is_active ? t("admin.common.active") : t("admin.common.inactive")}
          </Badge>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-lg font-bold text-foreground">{worker.total_shifts}</div>
            <div className="text-xs text-foreground-secondary">{t("profile.total_shifts")}</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-lg font-bold text-foreground">{worker.no_show_count}</div>
            <div className="text-xs text-foreground-secondary">{t("profile.no_show_count")}</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-lg font-bold text-foreground">{worker.cancel_count}</div>
            <div className="text-xs text-foreground-secondary">{t("profile.cancel_count")}</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-lg font-bold text-foreground">
              {worker.avg_rating ?? "—"}
              {worker.rating_count > 0 && (
                <span className="text-xs text-foreground-tertiary"> ({worker.rating_count})</span>
              )}
            </div>
            <div className="text-xs text-foreground-secondary">{t("profile.avg_rating")}</div>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label={t("admin.common.full_name")} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input label={t("admin.common.phone")} dir="ltr" value={worker.phone} disabled />
          <Input label={t("admin.common.city")} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <OccupationPicker label={t("auth.experience_tags")} options={occupations} value={tags} onChange={setTags} />
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} loading={saving}>
            {t("general.save")}
          </Button>
          <Button size="sm" variant={worker.is_active ? "danger" : "success"} onClick={handleToggleActive} loading={saving}>
            {worker.is_active ? t("admin.common.deactivate") : t("admin.common.activate")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
