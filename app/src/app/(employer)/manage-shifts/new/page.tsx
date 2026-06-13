"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { OccupationOption } from "@/components/ui/occupation-picker";

export default function CreateShiftPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [occupations, setOccupations] = useState<OccupationOption[]>([]);

  useEffect(() => {
    fetch("/api/occupations")
      .then((res) => res.json())
      .then((data) => setOccupations(data.occupations || []))
      .catch(() => setOccupations([]));
  }, []);

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

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(publish: boolean) {
    setError("");
    setLoading(true);
    try {
      const body = {
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
        publish,
      };

      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      router.push("/manage-shifts");
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t("shift.create")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input id="title" label={t("shift.title")} value={form.title} onChange={(e) => set("title", e.target.value)} />
            <div>
              <label htmlFor="role_tag" className="block text-sm font-medium text-foreground mb-1">{t("shift.role_tag")}</label>
              <select id="role_tag" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.role_tag} onChange={(e) => set("role_tag", e.target.value)}>
                <option value="" disabled>{t("shift.role_tag")}</option>
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
              <Input id="location_name" label={t("shift.location_name")} value={form.location_name} onChange={(e) => set("location_name", e.target.value)} />
              <Input id="city" label={t("shift.city")} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <Input id="address" label={t("shift.address")} value={form.address} onChange={(e) => set("address", e.target.value)} />

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
              <Input id="pay_rate" label={`${t("shift.pay_rate")} (${t("general.currency")})`} type="number" dir="ltr" value={form.pay_rate} onChange={(e) => set("pay_rate", e.target.value)} />
              <div>
                <label htmlFor="pay_type" className="block text-sm font-medium text-foreground mb-1">{t("shift.pay_type")}</label>
                <select id="pay_type" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors" value={form.pay_type} onChange={(e) => set("pay_type", e.target.value)}>
                  <option value="hourly">{t("shift.pay_hourly")}</option>
                  <option value="fixed">{t("shift.pay_fixed")}</option>
                </select>
              </div>
              <Input id="workers_needed" label={t("shift.workers_needed")} type="number" dir="ltr" value={form.workers_needed} onChange={(e) => set("workers_needed", e.target.value)} />
            </div>

            <Input id="dress_code" label={t("shift.dress_code")} value={form.dress_code} onChange={(e) => set("dress_code", e.target.value)} />
            <Input id="gear_required" label={t("shift.gear_required")} value={form.gear_required} onChange={(e) => set("gear_required", e.target.value)} />
            <Input id="arrival_notes" label={t("shift.arrival_notes")} value={form.arrival_notes} onChange={(e) => set("arrival_notes", e.target.value)} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input id="contact_name" label={t("shift.contact_name")} value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
              <Input id="contact_phone" label={t("shift.contact_phone")} type="tel" dir="ltr" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
            </div>

            <Input id="min_trust_score" label={t("shift.min_trust")} type="number" dir="ltr" step="0.1" min="0" max="5" value={form.min_trust_score} onChange={(e) => set("min_trust_score", e.target.value)} />
            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button onClick={() => submit(true)} loading={loading} disabled={!form.title || !form.role_tag || !form.address || !form.start_at || !form.end_at || !form.pay_rate}>
                {t("shift.publish")}
              </Button>
              <Button variant="secondary" onClick={() => submit(false)} loading={loading} disabled={!form.title || !form.role_tag || !form.address || !form.start_at || !form.end_at || !form.pay_rate}>
                {t("shift.save_draft")}
              </Button>
              <Button variant="ghost" onClick={() => router.back()}>
                {t("general.cancel")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
