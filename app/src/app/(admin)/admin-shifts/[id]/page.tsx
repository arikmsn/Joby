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
import { ArrowRight } from "lucide-react";
import { ShiftStatus } from "@/lib/constants";

interface ShiftDetail {
  id: string;
  employer_id: string;
  title: string;
  role_tag: string;
  description: string | null;
  location_name: string | null;
  city: string | null;
  address: string;
  start_at: string;
  end_at: string;
  pay_rate: string;
  pay_type: string;
  workers_needed: number;
  slots_filled: number;
  status: string;
  dress_code: string | null;
  gear_required: string | null;
  arrival_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  min_trust_score: string;
  employer_name: string | null;
  business_name: string | null;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  [ShiftStatus.DRAFT]: [ShiftStatus.PUBLISHED, ShiftStatus.CANCELLED],
  [ShiftStatus.PUBLISHED]: [ShiftStatus.CANCELLED],
};

function statusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "success" as const;
    case "DRAFT":
      return "muted" as const;
    case "IN_PROGRESS":
      return "warning" as const;
    case "COMPLETED":
      return "info" as const;
    case "CANCELLED":
      return "danger" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: string) {
  const key = `shift.status.${status.toLowerCase()}` as Parameters<typeof t>[0];
  return t(key);
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminShiftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { token } = useAuth();
  const { occupations } = useOccupations();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    role_tag: "",
    description: "",
    location_name: "",
    city: "",
    address: "",
    start_at: "",
    end_at: "",
    pay_rate: "",
    pay_type: "hourly",
    workers_needed: "1",
    dress_code: "",
    gear_required: "",
    arrival_notes: "",
    contact_name: "",
    contact_phone: "",
    min_trust_score: "0",
  });

  function load() {
    if (!token || !id) return;
    fetch(`/api/admin/shifts/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.shift) {
          const s: ShiftDetail = d.shift;
          setShift(s);
          setForm({
            title: s.title || "",
            role_tag: s.role_tag || "",
            description: s.description || "",
            location_name: s.location_name || "",
            city: s.city || "",
            address: s.address || "",
            start_at: toDatetimeLocal(s.start_at),
            end_at: toDatetimeLocal(s.end_at),
            pay_rate: s.pay_rate || "",
            pay_type: s.pay_type || "hourly",
            workers_needed: String(s.workers_needed ?? 1),
            dress_code: s.dress_code || "",
            gear_required: s.gear_required || "",
            arrival_notes: s.arrival_notes || "",
            contact_name: s.contact_name || "",
            contact_phone: s.contact_phone || "",
            min_trust_score: s.min_trust_score || "0",
          });
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          role_tag: form.role_tag,
          description: form.description || undefined,
          location_name: form.location_name || undefined,
          city: form.city || undefined,
          address: form.address,
          start_at: new Date(form.start_at).toISOString(),
          end_at: new Date(form.end_at).toISOString(),
          pay_rate: parseFloat(form.pay_rate),
          pay_type: form.pay_type,
          workers_needed: parseInt(form.workers_needed) || 1,
          dress_code: form.dress_code || undefined,
          gear_required: form.gear_required || undefined,
          arrival_notes: form.arrival_notes || undefined,
          contact_name: form.contact_name || undefined,
          contact_phone: form.contact_phone || undefined,
          min_trust_score: parseFloat(form.min_trust_score) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(newStatus: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/shifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      load();
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

  if (!shift) {
    return <p className="text-center py-8 text-danger">{t("error.not_found")}</p>;
  }

  const allowedTransitions = VALID_TRANSITIONS[shift.status] || [];

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">{shift.title}</h1>
          <p className="text-sm text-foreground-secondary">{shift.business_name || shift.employer_name}</p>
        </div>
        <Badge variant={statusVariant(shift.status)}>{statusLabel(shift.status)}</Badge>
      </div>

      {allowedTransitions.length > 0 && (
        <Card className="flex flex-wrap gap-2">
          {allowedTransitions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === ShiftStatus.CANCELLED ? "danger" : "success"}
              onClick={() => handleTransition(s)}
              loading={saving}
            >
              {statusLabel(s)}
            </Button>
          ))}
        </Card>
      )}

      <Card className="space-y-4">
        <Input label={t("shift.title")} value={form.title} onChange={(e) => set("title", e.target.value)} />
        <div>
          <label htmlFor="role_tag" className="block text-sm font-medium text-foreground mb-1">{t("shift.role_tag")}</label>
          <select id="role_tag" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.role_tag} onChange={(e) => set("role_tag", e.target.value)}>
            <option value={form.role_tag} disabled hidden>{form.role_tag}</option>
            {occupations.map((occ) => (
              <option key={occ.key} value={occ.key}>{occ.label_he}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">{t("shift.description")}</label>
          <textarea id="description" className="w-full rounded-lg border border-border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t("shift.location_name")} value={form.location_name} onChange={(e) => set("location_name", e.target.value)} />
          <Input label={t("shift.city")} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <Input label={t("shift.address")} value={form.address} onChange={(e) => set("address", e.target.value)} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_at" className="block text-sm font-medium text-foreground mb-1">{t("shift.start_at")}</label>
            <input id="start_at" type="datetime-local" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" dir="ltr" value={form.start_at} onChange={(e) => set("start_at", e.target.value)} />
          </div>
          <div>
            <label htmlFor="end_at" className="block text-sm font-medium text-foreground mb-1">{t("shift.end_at")}</label>
            <input id="end_at" type="datetime-local" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" dir="ltr" value={form.end_at} onChange={(e) => set("end_at", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label={`${t("shift.pay_rate")} (${t("general.currency")})`} type="number" dir="ltr" value={form.pay_rate} onChange={(e) => set("pay_rate", e.target.value)} />
          <div>
            <label htmlFor="pay_type" className="block text-sm font-medium text-foreground mb-1">{t("shift.pay_type")}</label>
            <select id="pay_type" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.pay_type} onChange={(e) => set("pay_type", e.target.value)}>
              <option value="hourly">{t("shift.pay_hourly")}</option>
              <option value="fixed">{t("shift.pay_fixed")}</option>
            </select>
          </div>
          <Input label={t("shift.workers_needed")} type="number" dir="ltr" value={form.workers_needed} onChange={(e) => set("workers_needed", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-foreground-secondary">
          <div>{t("shift.slots_filled")}: {shift.slots_filled}/{shift.workers_needed}</div>
        </div>

        <Input label={t("shift.dress_code")} value={form.dress_code} onChange={(e) => set("dress_code", e.target.value)} />
        <Input label={t("shift.gear_required")} value={form.gear_required} onChange={(e) => set("gear_required", e.target.value)} />
        <Input label={t("shift.arrival_notes")} value={form.arrival_notes} onChange={(e) => set("arrival_notes", e.target.value)} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label={t("shift.contact_name")} value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          <Input label={t("shift.contact_phone")} type="tel" dir="ltr" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
        </div>

        <Input label={t("shift.min_trust")} type="number" dir="ltr" step="0.1" min="0" max="5" value={form.min_trust_score} onChange={(e) => set("min_trust_score", e.target.value)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} loading={saving}>
            {t("general.save")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
