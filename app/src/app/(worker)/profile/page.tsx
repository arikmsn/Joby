"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import { TrustBadge } from "@/components/ui/trust-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OccupationPicker, type OccupationOption } from "@/components/ui/occupation-picker";
import { User, MapPin, LogOut, Shield, Pencil, Car, Globe2, Banknote, Cake, Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import type { WorkerProfile } from "@/lib/types";
import { ISRAEL_CITIES, WORKER_LANGUAGES, LICENSE_TYPES, VEHICLE_TYPES } from "@/lib/constants";

export default function ProfilePage() {
  const { user, profile, logout, token, refreshUser } = useAuth();
  const workerProfile = profile as WorkerProfile | null;

  const [occupations, setOccupations] = useState<OccupationOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState<string[]>(workerProfile?.experience_tags || []);
  const [saving, setSaving] = useState(false);

  const cityOptions: OccupationOption[] = ISRAEL_CITIES.map((c) => ({ key: c, label_he: c }));
  const languageOptions: OccupationOption[] = WORKER_LANGUAGES.map((l) => ({ key: l.key, label_he: l.label_he }));
  const languageLabelMap = new Map<string, string>(WORKER_LANGUAGES.map((l) => [l.key, l.label_he]));
  const licenseTypeOptions: OccupationOption[] = LICENSE_TYPES.map((l) => ({ key: l.key, label_he: l.label_he }));
  const licenseTypeLabelMap = new Map<string, string>(LICENSE_TYPES.map((l) => [l.key, l.label_he]));
  const vehicleTypeOptions: OccupationOption[] = VEHICLE_TYPES.map((v) => ({ key: v.key, label_he: v.label_he }));
  const vehicleTypeLabelMap = new Map<string, string>(VEHICLE_TYPES.map((v) => [v.key, v.label_he]));

  const [editingDetails, setEditingDetails] = useState(false);
  const [city, setCity] = useState<string>(workerProfile?.city || "");
  const [preferredCities, setPreferredCities] = useState<string[]>(workerProfile?.preferred_cities || []);
  const [languages, setLanguages] = useState<string[]>(workerProfile?.languages || []);
  const [hasVehicle, setHasVehicle] = useState<boolean>(workerProfile?.has_vehicle || false);
  const [hasLicense, setHasLicense] = useState<boolean>(workerProfile?.has_license || false);
  const [licenseTypes, setLicenseTypes] = useState<string[]>(workerProfile?.license_types || []);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(workerProfile?.vehicle_types || []);
  const [minPay, setMinPay] = useState<string>(workerProfile?.min_pay != null ? String(workerProfile.min_pay) : "");
  const [birthYear, setBirthYear] = useState<string>(
    workerProfile?.date_of_birth ? String(new Date(workerProfile.date_of_birth).getFullYear()) : ""
  );
  const [bio, setBio] = useState<string>(workerProfile?.bio || "");
  const [savingDetails, setSavingDetails] = useState(false);

  const [editingPayout, setEditingPayout] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payout, setPayout] = useState({
    payout_legal_name: "",
    payout_id_number: "",
    payout_bank_name: "",
    payout_bank_branch: "",
    payout_account_number: "",
    payout_account_holder: "",
    payout_details_completed_at: null as string | null,
  });

  useEffect(() => {
    if (!token) return;
    fetch("/api/workers/me/payout", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.payout) {
          setPayout({
            payout_legal_name: data.payout.payout_legal_name || "",
            payout_id_number: data.payout.payout_id_number || "",
            payout_bank_name: data.payout.payout_bank_name || "",
            payout_bank_branch: data.payout.payout_bank_branch || "",
            payout_account_number: data.payout.payout_account_number || "",
            payout_account_holder: data.payout.payout_account_holder || "",
            payout_details_completed_at: data.payout.payout_details_completed_at || null,
          });
        }
      })
      .catch(() => {});
  }, [token]);

  function setPayoutField(field: string, value: string) {
    setPayout((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSavePayout() {
    setSavingPayout(true);
    try {
      const res = await fetch("/api/workers/me/payout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payout_legal_name: payout.payout_legal_name || null,
          payout_id_number: payout.payout_id_number || null,
          payout_bank_name: payout.payout_bank_name || null,
          payout_bank_branch: payout.payout_bank_branch || null,
          payout_account_number: payout.payout_account_number || null,
          payout_account_holder: payout.payout_account_holder || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPayout((prev) => ({ ...prev, payout_details_completed_at: data.payout?.payout_details_completed_at || null }));
        setEditingPayout(false);
      }
    } finally {
      setSavingPayout(false);
    }
  }

  useEffect(() => {
    fetch("/api/occupations")
      .then((res) => res.json())
      .then((data) => setOccupations(data.occupations || []))
      .catch(() => setOccupations([]));
  }, []);

  useEffect(() => {
    setTags(workerProfile?.experience_tags || []);
  }, [workerProfile?.experience_tags]);

  useEffect(() => {
    setCity(workerProfile?.city || "");
    setPreferredCities(workerProfile?.preferred_cities || []);
    setLanguages(workerProfile?.languages || []);
    setHasVehicle(workerProfile?.has_vehicle || false);
    setHasLicense(workerProfile?.has_license || false);
    setLicenseTypes(workerProfile?.license_types || []);
    setVehicleTypes(workerProfile?.vehicle_types || []);
    setMinPay(workerProfile?.min_pay != null ? String(workerProfile.min_pay) : "");
    setBirthYear(workerProfile?.date_of_birth ? String(new Date(workerProfile.date_of_birth).getFullYear()) : "");
    setBio(workerProfile?.bio || "");
  }, [
    workerProfile?.city,
    workerProfile?.preferred_cities,
    workerProfile?.languages,
    workerProfile?.has_vehicle,
    workerProfile?.has_license,
    workerProfile?.license_types,
    workerProfile?.vehicle_types,
    workerProfile?.min_pay,
    workerProfile?.date_of_birth,
    workerProfile?.bio,
  ]);

  const labelMap = new Map(occupations.map((o) => [o.key, o.label_he]));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/workers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ experience_tags: tags }),
      });
      if (res.ok) {
        await refreshUser();
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetails() {
    setSavingDetails(true);
    try {
      const year = parseInt(birthYear, 10);
      const res = await fetch("/api/workers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          city: city || null,
          preferred_cities: preferredCities,
          languages,
          has_vehicle: hasVehicle,
          has_license: hasLicense,
          license_types: hasLicense ? licenseTypes : [],
          vehicle_types: vehicleTypes,
          min_pay: minPay ? Number(minPay) : null,
          date_of_birth: !isNaN(year) && birthYear ? `${year}-01-01` : null,
          bio: bio || null,
        }),
      });
      if (res.ok) {
        await refreshUser();
        setEditingDetails(false);
      }
    } finally {
      setSavingDetails(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-extrabold text-foreground tracking-tight">{t("nav.profile")}</h1>

      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {user.full_name}
            </h2>
            <p className="text-sm text-foreground-secondary text-right" dir="ltr">
              {user.phone}
            </p>
          </div>
        </div>

        {workerProfile && (
          <div className="space-y-3 pt-4 border-t border-border-light">
            {workerProfile.city && (
              <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                <MapPin className="h-4 w-4 text-foreground-tertiary shrink-0" />
                {workerProfile.city}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-foreground-tertiary shrink-0" />
              <span className="text-foreground-secondary">{t("trust.score_label")}:</span>
              <TrustBadge
                score={workerProfile.trust_score}
                totalShifts={workerProfile.total_shifts}
              />
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-3">
              <div className="text-center p-3 bg-background rounded-xl border border-border-light transition-colors duration-150">
                <div className="text-lg font-bold text-foreground tabular-nums">
                  {workerProfile.total_shifts || 0}
                </div>
                <div className="text-xs text-foreground-secondary mt-0.5">
                  {t("profile.total_shifts")}
                </div>
              </div>
              <div className="text-center p-3 bg-background rounded-xl border border-border-light transition-colors duration-150">
                <div className="text-lg font-bold text-foreground tabular-nums">
                  {workerProfile.no_show_count || 0}
                </div>
                <div className="text-xs text-foreground-secondary mt-0.5">
                  {t("profile.no_show_count")}
                </div>
              </div>
              <div className="text-center p-3 bg-background rounded-xl border border-border-light transition-colors duration-150">
                <div className="text-lg font-bold text-foreground tabular-nums">
                  {workerProfile.cancel_count || 0}
                </div>
                <div className="text-xs text-foreground-secondary mt-0.5">
                  {t("profile.cancel_count")}
                </div>
              </div>
            </div>

            <div className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("profile.experience")}
                </h3>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-full p-1 text-foreground-tertiary transition-all duration-150 hover:bg-background hover:text-primary active:scale-90"
                    aria-label={t("general.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3"
                  >
                    <OccupationPicker
                      options={occupations}
                      value={tags}
                      onChange={setTags}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave} loading={saving}>
                        {t("general.save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTags(workerProfile.experience_tags || []);
                          setEditing(false);
                        }}
                      >
                        {t("general.cancel")}
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="view"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-wrap gap-2"
                  >
                    {(workerProfile.experience_tags || []).length === 0 ? (
                      <p className="text-sm text-foreground-secondary">
                        {t("profile.no_occupations")}
                      </p>
                    ) : (
                      (workerProfile.experience_tags || []).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {labelMap.get(tag) || tag}
                        </Badge>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </Card>

      {workerProfile && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t("profile.preferences_title")}</h2>
            {!editingDetails && (
              <button
                onClick={() => setEditingDetails(true)}
                className="rounded-full p-1 text-foreground-tertiary transition-all duration-150 hover:bg-background hover:text-primary active:scale-90"
                aria-label={t("general.edit")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
          {editingDetails ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("profile.city")}
                </label>
                <select
                  className="w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm transition-colors duration-150 hover:border-foreground-tertiary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="">{t("feed.all_cities")}</option>
                  {ISRAEL_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <OccupationPicker
                label={t("profile.preferred_cities")}
                options={cityOptions}
                value={preferredCities}
                onChange={setPreferredCities}
              />

              <OccupationPicker
                label={t("profile.languages")}
                options={languageOptions}
                value={languages}
                onChange={setLanguages}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {t("profile.min_pay")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    dir="ltr"
                    className="w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm text-center transition-colors duration-150 hover:border-foreground-tertiary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={minPay}
                    onChange={(e) => setMinPay(e.target.value)}
                    placeholder="₪"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {t("profile.birth_year")}
                  </label>
                  <input
                    type="number"
                    min={1940}
                    max={new Date().getFullYear()}
                    dir="ltr"
                    className="w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm text-center transition-colors duration-150 hover:border-foreground-tertiary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="1995"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  checked={hasVehicle}
                  onChange={(e) => setHasVehicle(e.target.checked)}
                />
                {t("profile.has_vehicle")}
              </label>

              <OccupationPicker
                label={t("profile.vehicle_types")}
                options={vehicleTypeOptions}
                value={vehicleTypes}
                onChange={setVehicleTypes}
              />

              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("profile.about")}
                </label>
                <textarea
                  className="w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm transition-colors duration-150 hover:border-foreground-tertiary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows={3}
                  maxLength={500}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveDetails} loading={savingDetails}>
                  {t("general.save")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingDetails(false)}
                >
                  {t("general.cancel")}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3 text-sm"
            >
              <div className="flex items-center gap-2 text-foreground-secondary">
                <MapPin className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>
                  {t("profile.preferred_cities")}:{" "}
                  {preferredCities.length > 0 ? preferredCities.join(", ") : t("profile.not_set")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Globe2 className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>
                  {t("profile.languages")}:{" "}
                  {languages.length > 0 ? languages.map((l) => languageLabelMap.get(l) || l).join(", ") : t("profile.not_set")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Banknote className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>
                  {t("profile.min_pay")}: {minPay ? `${t("general.currency")}${minPay}` : t("profile.not_set")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Car className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>{hasVehicle ? t("profile.has_vehicle") : t("profile.no_vehicle")}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Car className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>
                  {t("profile.vehicle_types")}:{" "}
                  {vehicleTypes.length > 0
                    ? vehicleTypes.map((v) => vehicleTypeLabelMap.get(v) || v).join(", ")
                    : t("profile.no_vehicle_types")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Car className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>
                  {t("profile.has_license_q")} {hasLicense ? t("general.yes") : t("general.no")}
                  {hasLicense &&
                    ` — ${
                      licenseTypes.length > 0
                        ? licenseTypes.map((l) => licenseTypeLabelMap.get(l) || l).join(", ")
                        : t("profile.no_license_types")
                    }`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Cake className="h-4 w-4 text-foreground-tertiary shrink-0" />
                <span>{birthYear || t("profile.not_set")}</span>
              </div>
              {bio && <p className="text-foreground-secondary pt-1 border-t border-border-light">{bio}</p>}
            </motion.div>
          )}
          </AnimatePresence>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-foreground-tertiary" />
            <h2 className="text-lg font-semibold text-foreground">{t("payout.title")}</h2>
          </div>
          {!editingPayout && (
            <button
              onClick={() => setEditingPayout(true)}
              className="rounded-full p-1 text-foreground-tertiary transition-all duration-150 hover:bg-background hover:text-primary active:scale-90"
              aria-label={t("general.edit")}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="text-sm text-foreground-secondary">{t("payout.subtitle")}</p>

        {payout.payout_details_completed_at ? (
          <Badge variant="success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("payout.completed_badge")}
          </Badge>
        ) : (
          <Badge variant="warning">
            <AlertCircle className="h-3.5 w-3.5" />
            {t("payout.incomplete_badge")}
          </Badge>
        )}

        {!payout.payout_details_completed_at && (
          <p className="text-xs text-warning bg-warning/10 rounded-lg p-2.5">{t("payout.required_notice")}</p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {editingPayout ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {([
                ["payout_legal_name", "payout.legal_name"],
                ["payout_id_number", "payout.id_number"],
                ["payout_bank_name", "payout.bank_name"],
                ["payout_bank_branch", "payout.bank_branch"],
                ["payout_account_number", "payout.account_number"],
                ["payout_account_holder", "payout.account_holder"],
              ] as const).map(([field, labelKey]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {t(labelKey)}
                  </label>
                  <input
                    className="w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm transition-colors duration-150 hover:border-foreground-tertiary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={payout[field]}
                    onChange={(e) => setPayoutField(field, e.target.value)}
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSavePayout} loading={savingPayout}>
                  {t("payout.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingPayout(false)}>
                  {t("general.cancel")}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-2 text-sm text-foreground-secondary"
            >
              <div>{t("payout.legal_name")}: {payout.payout_legal_name || t("profile.not_set")}</div>
              <div>{t("payout.id_number")}: {payout.payout_id_number || t("profile.not_set")}</div>
              <div>{t("payout.bank_name")}: {payout.payout_bank_name || t("profile.not_set")}</div>
              <div>{t("payout.bank_branch")}: {payout.payout_bank_branch || t("profile.not_set")}</div>
              <div>{t("payout.account_number")}: {payout.payout_account_number || t("profile.not_set")}</div>
              <div>{t("payout.account_holder")}: {payout.payout_account_holder || t("profile.not_set")}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Button
        variant="ghost"
        className="w-full text-danger hover:text-danger hover:bg-danger/5 focus-visible:ring-danger"
        onClick={logout}
      >
        <LogOut className="h-4 w-4 ml-2" />
        {t("auth.logout")}
      </Button>
    </div>
  );
}
