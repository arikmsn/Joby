"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useGrowthAccess } from "../../use-growth-access";
import { tGrowth } from "@/lib/i18n/he-growth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ROLE_FAMILIES,
  GROWTH_REGIONS,
  ObservedEmployerType,
  SalaryUnit,
  SourceChannelStatus,
} from "@/lib/constants";

const SHIFT_TAGS = [
  { key: "morning", label: "בוקר" },
  { key: "evening", label: "ערב" },
  { key: "night", label: "לילה" },
  { key: "weekend", label: "סופ״ש" },
] as const;

const REQUIREMENT_FLAGS = [
  { key: "forklift_license", label: "רישיון מלגזה" },
  { key: "drivers_license", label: "רישיון נהיגה" },
  { key: "hebrew_basic", label: "עברית בסיסית" },
  { key: "physical_work", label: "עבודה פיזית" },
  { key: "experience_required", label: "נדרש ניסיון" },
] as const;

const selectClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "block text-sm font-medium text-foreground-secondary mb-1";

interface ChannelOption {
  id: string;
  name: string;
  status: string;
}

// datetime-local value for "now" in local time
function nowLocalValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewObservationPage() {
  const { token } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useGrowthAccess();
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    channel_id: "",
    observed_at: nowLocalValue(),
    role_family: ROLE_FAMILIES[0].key as string,
    role_title_norm: "",
    region_code: GROWTH_REGIONS[0].key as string,
    city: "",
    employer_name_public: "",
    employer_type: ObservedEmployerType.UNKNOWN as string,
    salary_min: "",
    salary_max: "",
    salary_unit: SalaryUnit.HOURLY as string,
    shift_tags: [] as string[],
    requirement_flags: [] as string[],
    urgency_score: 0,
    source_ref: "",
    raw_text: "",
  });

  useEffect(() => {
    if (!token) return;
    fetch(
      `/api/admin/growth/sources?status=${SourceChannelStatus.APPROVED}&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((d) => {
        const opts: ChannelOption[] = d.data || [];
        setChannels(opts);
        if (opts[0]) setForm((f) => ({ ...f, channel_id: f.channel_id || opts[0].id }));
      });
  }, [token]);

  const canSubmit = useMemo(
    () => !!form.channel_id && form.role_title_norm.trim().length >= 2,
    [form.channel_id, form.role_title_norm]
  );

  function toggle(list: "shift_tags" | "requirement_flags", key: string) {
    setForm((f) => ({
      ...f,
      [list]: f[list].includes(key)
        ? f[list].filter((k) => k !== key)
        : [...f[list], key],
    }));
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/growth/observations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channel_id: form.channel_id,
          observed_at: new Date(form.observed_at).toISOString(),
          role_family: form.role_family,
          role_title_norm: form.role_title_norm.trim(),
          region_code: form.region_code,
          city: form.city.trim() || null,
          employer_name_public: form.employer_name_public.trim() || null,
          employer_type: form.employer_type,
          salary_min: form.salary_min ? Number(form.salary_min) : null,
          salary_max: form.salary_max ? Number(form.salary_max) : null,
          salary_unit: form.salary_min || form.salary_max ? form.salary_unit : null,
          shift_tags: form.shift_tags,
          requirement_flags: form.requirement_flags,
          urgency_score: form.urgency_score,
          source_ref: form.source_ref.trim() || null,
          raw_text: form.raw_text.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || tGrowth("growth.error"));
        return;
      }
      router.push("/growth/observations");
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

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">
        {tGrowth("growth.obs.new")}
      </h1>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.channel")}</label>
            <select
              className={selectClass}
              value={form.channel_id}
              onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
            >
              {channels.length === 0 && <option value="">—</option>}
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.observed_at")}</label>
            <input
              type="datetime-local"
              className={selectClass}
              value={form.observed_at}
              onChange={(e) => setForm({ ...form, observed_at: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.role_family")}</label>
            <select
              className={selectClass}
              value={form.role_family}
              onChange={(e) => setForm({ ...form, role_family: e.target.value })}
            >
              {ROLE_FAMILIES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label_he}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={tGrowth("growth.obs.role_title")}
            value={form.role_title_norm}
            onChange={(e) => setForm({ ...form, role_title_norm: e.target.value })}
          />
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.region")}</label>
            <select
              className={selectClass}
              value={form.region_code}
              onChange={(e) => setForm({ ...form, region_code: e.target.value })}
            >
              {GROWTH_REGIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label_he}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={tGrowth("growth.obs.city")}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <Input
            label={tGrowth("growth.obs.employer")}
            value={form.employer_name_public}
            onChange={(e) =>
              setForm({ ...form, employer_name_public: e.target.value })
            }
          />
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.employer_type")}</label>
            <select
              className={selectClass}
              value={form.employer_type}
              onChange={(e) => setForm({ ...form, employer_type: e.target.value })}
            >
              <option value={ObservedEmployerType.UNKNOWN}>
                {tGrowth("growth.obs.employer_type.unknown")}
              </option>
              <option value={ObservedEmployerType.DIRECT}>
                {tGrowth("growth.obs.employer_type.direct")}
              </option>
              <option value={ObservedEmployerType.AGENCY}>
                {tGrowth("growth.obs.employer_type.agency")}
              </option>
            </select>
          </div>
          <Input
            label={tGrowth("growth.obs.salary_min")}
            type="number"
            dir="ltr"
            value={form.salary_min}
            onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
          />
          <Input
            label={tGrowth("growth.obs.salary_max")}
            type="number"
            dir="ltr"
            value={form.salary_max}
            onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
          />
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.salary_unit")}</label>
            <select
              className={selectClass}
              value={form.salary_unit}
              onChange={(e) => setForm({ ...form, salary_unit: e.target.value })}
            >
              <option value={SalaryUnit.HOURLY}>
                {tGrowth("growth.obs.salary_unit.hourly")}
              </option>
              <option value={SalaryUnit.MONTHLY}>
                {tGrowth("growth.obs.salary_unit.monthly")}
              </option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{tGrowth("growth.obs.urgency")}</label>
            <input
              type="number"
              min={0}
              max={10}
              className={selectClass}
              dir="ltr"
              value={form.urgency_score}
              onChange={(e) =>
                setForm({ ...form, urgency_score: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{tGrowth("growth.obs.shift_tags")}</label>
          <div className="flex flex-wrap gap-2">
            {SHIFT_TAGS.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => toggle("shift_tags", tag.key)}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  form.shift_tags.includes(tag.key)
                    ? "bg-primary-100 border-primary text-primary-800"
                    : "bg-white border-border text-foreground-secondary"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>{tGrowth("growth.obs.requirements")}</label>
          <div className="flex flex-wrap gap-2">
            {REQUIREMENT_FLAGS.map((flag) => (
              <button
                key={flag.key}
                type="button"
                onClick={() => toggle("requirement_flags", flag.key)}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  form.requirement_flags.includes(flag.key)
                    ? "bg-primary-100 border-primary text-primary-800"
                    : "bg-white border-border text-foreground-secondary"
                }`}
              >
                {flag.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label={tGrowth("growth.obs.source_ref")}
          dir="ltr"
          value={form.source_ref}
          onChange={(e) => setForm({ ...form, source_ref: e.target.value })}
        />

        <div>
          <label className={labelClass}>{tGrowth("growth.obs.raw_text")}</label>
          <textarea
            className={`${selectClass} min-h-[100px]`}
            value={form.raw_text}
            onChange={(e) => setForm({ ...form, raw_text: e.target.value })}
          />
          <p className="text-xs text-amber-600 mt-1">
            {tGrowth("growth.obs.raw_text_note")}
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={submit} loading={saving} disabled={!canSubmit}>
            {tGrowth("growth.save")}
          </Button>
          <Button variant="secondary" onClick={() => router.back()}>
            {tGrowth("growth.cancel")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
