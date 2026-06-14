"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrustBadge } from "@/components/ui/trust-badge";
import { OccupationPicker } from "@/components/ui/occupation-picker";
import { Plus, Search } from "lucide-react";

interface WorkerRow {
  id: string;
  phone: string;
  full_name: string;
  is_active: boolean;
  created_by_admin: boolean;
  city: string | null;
  experience_tags: string[] | null;
  trust_score: number;
  total_shifts: number;
}

export default function AdminWorkersPage() {
  const { token } = useAuth();
  const { occupations, occupationLabel } = useOccupations();
  const [rows, setRows] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    full_name: "",
    city: "",
    bio: "",
  });
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "100");
    fetch(`/api/admin/workers?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, experience_tags: tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      setShowCreate(false);
      setForm({ phone: "", full_name: "", city: "", bio: "" });
      setTags([]);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.workers")}</h1>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" />
          {t("admin.workers.create")}
        </Button>
      </div>

      {showCreate && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{t("admin.workers.create")}</h2>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label={t("admin.common.phone")} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t("admin.common.full_name")} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label={t("admin.common.city")} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <OccupationPicker label={t("auth.experience_tags")} options={occupations} value={tags} onChange={setTags} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} loading={saving}>
              {t("general.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              {t("general.cancel")}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={t("general.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <Button variant="secondary" onClick={load}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground-secondary">{t("general.no_results")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin-workers/${row.id}`}
              className="block p-4 bg-surface rounded-xl border border-border hover:border-primary/30 hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{row.full_name}</h3>
                  <p className="text-sm text-foreground-secondary mt-0.5">
                    <span dir="ltr">{row.phone}</span>
                    {row.city ? ` · ${row.city}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(row.experience_tags || []).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {occupationLabel(tag)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <TrustBadge score={row.trust_score} totalShifts={row.total_shifts} />
                  <Badge variant={row.is_active ? "success" : "muted"}>
                    {row.is_active ? t("admin.common.active") : t("admin.common.inactive")}
                  </Badge>
                  {row.created_by_admin && (
                    <Badge variant="info">{t("admin.common.admin_created")}</Badge>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
