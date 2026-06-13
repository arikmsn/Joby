"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface EmployerDetail {
  id: string;
  phone: string;
  full_name: string;
  is_active: boolean;
  created_by_admin: boolean;
  created_at: string;
  business_name: string | null;
  business_type: string | null;
  address: string | null;
  city: string | null;
}

interface ShiftCount {
  status: string;
  count: number;
}

export default function AdminEmployerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { token } = useAuth();
  const [employer, setEmployer] = useState<EmployerDetail | null>(null);
  const [shiftCounts, setShiftCounts] = useState<ShiftCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    business_type: "",
    city: "",
    address: "",
  });

  function load() {
    if (!token || !id) return;
    fetch(`/api/admin/employers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.employer) {
          setEmployer(d.employer);
          setForm({
            full_name: d.employer.full_name || "",
            business_name: d.employer.business_name || "",
            business_type: d.employer.business_type || "",
            city: d.employer.city || "",
            address: d.employer.address || "",
          });
        }
        setShiftCounts(d.shift_counts || []);
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
      const res = await fetch(`/api/admin/employers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!employer) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !employer.is_active }),
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

  if (!employer) {
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
        <h1 className="text-2xl font-bold text-foreground">{employer.business_name || employer.full_name}</h1>
        <Badge variant={employer.is_active ? "success" : "muted"}>
          {employer.is_active ? t("admin.common.active") : t("admin.common.inactive")}
        </Badge>
      </div>

      <Card className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label={t("admin.common.full_name")} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input label={t("admin.common.phone")} dir="ltr" value={employer.phone} disabled />
          <Input label={t("admin.employers.business_name")} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          <Input label={t("admin.employers.business_type")} value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
          <Input label={t("admin.common.city")} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label={t("admin.common.address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} loading={saving}>
            {t("general.save")}
          </Button>
          <Button size="sm" variant={employer.is_active ? "danger" : "success"} onClick={handleToggleActive} loading={saving}>
            {employer.is_active ? t("admin.common.deactivate") : t("admin.common.activate")}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t("admin.employers.shift_counts")}</h2>
        {shiftCounts.length === 0 ? (
          <p className="text-sm text-foreground-secondary">{t("general.no_results")}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {shiftCounts.map((sc) => (
              <div key={sc.status} className="text-center p-3 bg-background rounded-lg">
                <div className="text-lg font-bold text-foreground">{sc.count}</div>
                <div className="text-xs text-foreground-secondary">
                  {t(`shift.status.${sc.status.toLowerCase()}` as Parameters<typeof t>[0])}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
