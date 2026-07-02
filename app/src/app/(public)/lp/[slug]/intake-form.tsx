"use client";

// Quick-apply intake form (mobile-first, RTL). Posts to the single public
// write endpoint. Client-side validation is UX only — the endpoint
// re-validates everything server-side.
// ⚖️ Consent copy pending privacy-counsel approval (launch gate).

import { useState } from "react";
import { t } from "@/lib/i18n/he";
import {
  ROLE_FAMILIES,
  INTAKE_SHIFT_OPTIONS,
  INTAKE_EXPERIENCE_LEVELS,
} from "@/lib/constants";

const inputClass =
  "w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "block text-sm font-medium text-foreground-secondary mb-1";

export function IntakeForm({
  landingPageSlug,
  defaultRoleFamily,
}: {
  landingPageSlug: string;
  defaultRoleFamily: string;
}) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    role_families: [defaultRoleFamily],
    shifts: [] as string[],
    experience: "",
    consent_privacy: false,
    consent_marketing: false,
    website: "", // honeypot — stays empty for humans
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function toggle(list: "role_families" | "shifts", key: string) {
    setForm((f) => ({
      ...f,
      [list]: f[list].includes(key)
        ? f[list].filter((k) => k !== key)
        : [...f[list], key],
    }));
  }

  const canSubmit =
    form.full_name.trim().length >= 2 &&
    /^0?5\d{8}$/.test(form.phone.replace(/[\s-]/g, "").replace(/^\+972/, "0")) &&
    form.city.trim().length >= 2 &&
    form.role_families.length >= 1 &&
    form.consent_privacy;

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/public/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          role_families: form.role_families,
          shifts: form.shifts,
          experience: form.experience || undefined,
          consent_privacy: form.consent_privacy,
          consent_marketing: form.consent_marketing,
          landing_page_slug: landingPageSlug,
          website: form.website,
        }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      setError(
        res.status === 429 ? t("lp.error_rate_limited") : t("lp.error_generic")
      );
    } catch {
      setError(t("lp.error_generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-center space-y-2">
        <p className="text-xl font-bold text-foreground">
          {t("lp.success_title")}
        </p>
        <p className="text-foreground-secondary">{t("lp.success_body")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-4">
      <h2 className="font-semibold text-foreground">{t("lp.form_title")}</h2>

      <div>
        <label className={labelClass}>{t("lp.full_name")} *</label>
        <input
          className={inputClass}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          autoComplete="name"
        />
      </div>

      <div>
        <label className={labelClass}>{t("lp.phone")} *</label>
        <input
          className={inputClass}
          dir="ltr"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="050-0000000"
          autoComplete="tel"
        />
      </div>

      <div>
        <label className={labelClass}>{t("lp.city")} *</label>
        <input
          className={inputClass}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          autoComplete="address-level2"
        />
      </div>

      <div>
        <label className={labelClass}>{t("lp.role_families")} *</label>
        <div className="flex flex-wrap gap-2">
          {ROLE_FAMILIES.filter((r) => r.key !== "other").map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle("role_families", r.key)}
              className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                form.role_families.includes(r.key)
                  ? "bg-primary-100 border-primary text-primary-800"
                  : "bg-white border-border text-foreground-secondary"
              }`}
            >
              {r.label_he}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>{t("lp.shifts")}</label>
        <div className="flex flex-wrap gap-2">
          {INTAKE_SHIFT_OPTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle("shifts", s.key)}
              className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                form.shifts.includes(s.key)
                  ? "bg-primary-100 border-primary text-primary-800"
                  : "bg-white border-border text-foreground-secondary"
              }`}
            >
              {s.label_he}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>{t("lp.experience")}</label>
        <select
          className={inputClass}
          value={form.experience}
          onChange={(e) => setForm({ ...form, experience: e.target.value })}
        >
          <option value="">—</option>
          {INTAKE_EXPERIENCE_LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label_he}
            </option>
          ))}
        </select>
      </div>

      {/* Honeypot — visually hidden, never filled by humans */}
      <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
        <label>
          website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground-secondary">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.consent_privacy}
          onChange={(e) =>
            setForm({ ...form, consent_privacy: e.target.checked })
          }
        />
        <span>{t("lp.consent_privacy")} *</span>
      </label>

      <label className="flex items-start gap-2 text-sm text-foreground-secondary">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.consent_marketing}
          onChange={(e) =>
            setForm({ ...form, consent_marketing: e.target.checked })
          }
        />
        <span>{t("lp.consent_marketing")}</span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="w-full rounded-xl bg-primary-600 text-white py-3 font-semibold disabled:opacity-50 transition-opacity"
      >
        {submitting ? "..." : t("lp.submit")}
      </button>
    </div>
  );
}
