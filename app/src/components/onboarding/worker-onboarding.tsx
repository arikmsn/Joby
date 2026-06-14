"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOccupations } from "@/lib/use-occupations";
import { t } from "@/lib/i18n/he";
import { Button } from "@/components/ui/button";
import { OccupationPicker, type OccupationOption } from "@/components/ui/occupation-picker";
import {
  ISRAEL_CITIES,
  WORKER_LANGUAGES,
  LICENSE_TYPES,
  VEHICLE_TYPES,
} from "@/lib/constants";
import type { WorkerProfile } from "@/lib/types";
import { X, Briefcase, MapPin, Sliders, CheckCircle2, Clock } from "lucide-react";

const TOTAL_STEPS = 4;

interface WorkerOnboardingProps {
  onClose: () => void;
  initialStep?: 1 | 2 | 3 | 4;
}

interface PreviewShift {
  id: string;
  title: string;
  role_tag: string;
  city: string | null;
  start_at: string;
  pay_rate: number;
  pay_type: string;
}

export function WorkerOnboarding({ onClose, initialStep }: WorkerOnboardingProps) {
  const router = useRouter();
  const { token, profile, refreshUser } = useAuth();
  const workerProfile = profile as WorkerProfile | null;
  const { occupations, occupationLabel } = useOccupations();

  const [step, setStep] = useState(initialStep ?? 1);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewShifts, setPreviewShifts] = useState<PreviewShift[]>([]);

  const [roleFilters, setRoleFilters] = useState<string[]>(workerProfile?.experience_tags || []);
  const [roleSearch, setRoleSearch] = useState("");
  const [preferredCities, setPreferredCities] = useState<string[]>(workerProfile?.preferred_cities || []);
  const [hasLicense, setHasLicense] = useState<boolean>(workerProfile?.has_license || false);
  const [licenseTypes, setLicenseTypes] = useState<string[]>(workerProfile?.license_types || []);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(workerProfile?.vehicle_types || []);
  const [minPay, setMinPay] = useState<string>(workerProfile?.min_pay != null ? String(workerProfile.min_pay) : "");
  const [languages, setLanguages] = useState<string[]>(workerProfile?.languages || []);

  const cityOptions: OccupationOption[] = ISRAEL_CITIES.map((c) => ({ key: c, label_he: c }));
  const languageOptions: OccupationOption[] = WORKER_LANGUAGES.map((l) => ({ key: l.key, label_he: l.label_he }));
  const licenseTypeOptions: OccupationOption[] = LICENSE_TYPES.map((l) => ({ key: l.key, label_he: l.label_he }));
  const vehicleTypeOptions: OccupationOption[] = VEHICLE_TYPES.map((v) => ({ key: v.key, label_he: v.label_he }));

  const sortedOccupations = useMemo(
    () => [...occupations].sort((a, b) => a.label_he.localeCompare(b.label_he, "he")),
    [occupations]
  );
  const filteredRoleOptions = useMemo(() => {
    if (!roleSearch.trim()) return sortedOccupations;
    return sortedOccupations.filter((o) => o.label_he.includes(roleSearch.trim()));
  }, [sortedOccupations, roleSearch]);

  function toggleRole(key: string) {
    setRoleFilters((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  }

  async function patchProfile(body: Record<string, unknown>) {
    if (!token) return;
    await fetch("/api/workers/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async function handleNext() {
    setSaving(true);
    try {
      if (step === 1) {
        await patchProfile({ experience_tags: roleFilters });
      } else if (step === 2) {
        await patchProfile({ preferred_cities: preferredCities });
      } else if (step === 3) {
        await patchProfile({
          has_license: hasLicense,
          license_types: hasLicense ? licenseTypes : [],
          vehicle_types: vehicleTypes,
        });
      } else if (step === 4) {
        await patchProfile({
          min_pay: minPay ? Number(minPay) : null,
          languages,
          onboarding_completed: true,
        });
        await refreshUser();
        setDone(true);
        setSaving(false);
        return;
      }
      await refreshUser();
      setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await patchProfile({ onboarding_skipped: true });
      await refreshUser();
    } finally {
      setSaving(false);
      onClose();
    }
  }

  useEffect(() => {
    if (!done || !token) return;
    const params = new URLSearchParams({ limit: "50" });
    if (roleFilters.length > 0) params.set("role_tags", roleFilters.join(","));
    fetch(`/api/shifts?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        const list: PreviewShift[] = data.data || [];
        const matched = list.filter(
          (s) => roleFilters.includes(s.role_tag) || (s.city && preferredCities.includes(s.city))
        );
        const ranked = (matched.length > 0 ? matched : list)
          .slice()
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
        setPreviewShifts(ranked.slice(0, 3));
      })
      .catch(() => setPreviewShifts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, token]);

  function handleGoToFeed() {
    onClose();
    router.push("/shifts");
  }

  function handleCompleteProfile() {
    onClose();
    router.push("/profile");
  }

  if (done) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex flex-col bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          className="flex-1 overflow-y-auto px-4 py-8 max-w-lg mx-auto w-full flex flex-col items-center justify-center text-center space-y-4"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <CheckCircle2 className="h-9 w-9 text-success" />
          </motion.div>
          <h1 className="text-xl font-bold text-foreground">{t("onboarding.done_title")}</h1>
          <p className="text-sm text-foreground-secondary max-w-xs">{t("onboarding.done_subtitle")}</p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {roleFilters.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Briefcase className="h-3 w-3" />
                {t("onboarding.reason_roles")}
              </span>
            )}
            {preferredCities.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <MapPin className="h-3 w-3" />
                {t("onboarding.reason_cities")}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sliders className="h-3 w-3" />
              {t("onboarding.reason_preferences")}
            </span>
          </div>

          {previewShifts.length > 0 && (
            <div className="w-full max-w-xs space-y-2 pt-2 text-right">
              <p className="text-xs font-semibold text-foreground-secondary">{t("onboarding.preview_title")}</p>
              <div className="rounded-2xl border border-border bg-surface overflow-hidden divide-y divide-border-light">
                {previewShifts.map((s) => (
                  <div key={s.id} className="px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <div className="flex items-center justify-between mt-1 text-xs text-foreground-tertiary">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {occupationLabel(s.role_tag)}
                        {s.city ? ` · ${s.city}` : ""}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(s.start_at).toLocaleString("he-IL", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="w-full max-w-xs space-y-2 pt-4">
            <Button className="w-full" size="lg" onClick={handleGoToFeed}>
              {t("onboarding.cta_feed")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleCompleteProfile}>
              {t("onboarding.cta_profile")}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 === step ? "w-6 bg-primary" : i + 1 < step ? "w-4 bg-primary/50" : "w-4 bg-border"
              }`}
            />
          ))}
          <span className="text-xs text-foreground-tertiary mr-1">
            {step}/{TOTAL_STEPS}
          </span>
        </div>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          {t("onboarding.skip")}
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="space-y-4"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
        {step === 1 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">{t("onboarding.step1_title")}</h1>
              <p className="text-sm text-foreground-secondary">{t("onboarding.step1_subtitle")}</p>
            </div>
            <input
              type="text"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              placeholder={t("feed.search_role")}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {roleFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {roleFilters.map((key) => {
                  const label = occupations.find((o) => o.key === key)?.label_he || key;
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1"
                    >
                      {label}
                      <button onClick={() => toggleRole(key)} aria-label={t("general.remove")}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border-light divide-y divide-border-light">
              {filteredRoleOptions.length === 0 ? (
                <p className="text-sm text-foreground-tertiary text-center py-3">{t("feed.no_match")}</p>
              ) : (
                filteredRoleOptions.map((opt) => {
                  const selected = roleFilters.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleRole(opt.key)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                        selected ? "bg-primary/5 text-primary font-medium" : "text-foreground-secondary hover:bg-background"
                      }`}
                    >
                      {opt.label_he}
                      {selected && <span className="text-primary">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">{t("onboarding.step2_title")}</h1>
              <p className="text-sm text-foreground-secondary">{t("onboarding.step2_subtitle")}</p>
            </div>
            <OccupationPicker options={cityOptions} value={preferredCities} onChange={setPreferredCities} />
          </>
        )}

        {step === 3 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">{t("onboarding.step3_title")}</h1>
              <p className="text-sm text-foreground-secondary">{t("onboarding.step3_subtitle")}</p>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                checked={hasLicense}
                onChange={(e) => setHasLicense(e.target.checked)}
              />
              {t("profile.has_license_q")}
            </label>

            {hasLicense && (
              <OccupationPicker
                label={t("profile.license_types")}
                options={licenseTypeOptions}
                value={licenseTypes}
                onChange={setLicenseTypes}
              />
            )}

            <OccupationPicker
              label={t("profile.vehicle_types")}
              options={vehicleTypeOptions}
              value={vehicleTypes}
              onChange={setVehicleTypes}
            />
          </>
        )}

        {step === 4 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">{t("onboarding.step4_title")}</h1>
              <p className="text-sm text-foreground-secondary">{t("onboarding.step4_subtitle")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("profile.min_pay")}
              </label>
              <input
                type="number"
                min={0}
                dir="ltr"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={minPay}
                onChange={(e) => setMinPay(e.target.value)}
                placeholder="₪"
              />
            </div>

            <OccupationPicker
              label={t("profile.languages")}
              options={languageOptions}
              value={languages}
              onChange={setLanguages}
            />
          </>
        )}
        </motion.div>
      </AnimatePresence>
      </div>

      <div className="px-4 py-3 border-t border-border-light max-w-lg mx-auto w-full">
        <Button className="w-full" size="lg" onClick={handleNext} loading={saving}>
          {step === TOTAL_STEPS ? t("onboarding.finish") : t("onboarding.next")}
        </Button>
      </div>
    </motion.div>
  );
}

