"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/he";

interface AttendanceWorker {
  application_id: string;
  worker_id: string;
  worker_name: string;
  worker_phone: string;
  worker_trust: string | null;
  status: string;
  is_backup: boolean;
}

interface RatingForm {
  score: number;
  flag: string;
  comment: string;
  submitted: boolean;
  loading: boolean;
  error: string;
}

const FLAGS = [
  { value: "excellent", label: t("rating.flag.excellent") },
  { value: "punctual", label: t("rating.flag.punctual") },
  { value: "professional", label: t("rating.flag.professional") },
  { value: "late", label: t("rating.flag.late") },
  { value: "unprofessional", label: t("rating.flag.unprofessional") },
  { value: "left_early", label: t("rating.flag.left_early") },
];

const STAR_LABELS = [
  t("rating.stars.1"),
  t("rating.stars.2"),
  t("rating.stars.3"),
  t("rating.stars.4"),
  t("rating.stars.5"),
];

export default function RateWorkersPage() {
  const { id: shiftId } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [shiftTitle, setShiftTitle] = useState("");
  const [workers, setWorkers] = useState<AttendanceWorker[]>([]);
  const [forms, setForms] = useState<Record<string, RatingForm>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/shifts/${shiftId}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setShiftTitle(data.shift?.title || "");

      const rateable = (data.attendance || []).filter(
        (w: AttendanceWorker) => w.status === "CHECKED_OUT" && !w.is_backup
      );
      setWorkers(rateable);

      const initial: Record<string, RatingForm> = {};
      for (const w of rateable) {
        initial[w.application_id] = {
          score: 0,
          flag: "",
          comment: "",
          submitted: false,
          loading: false,
          error: "",
        };
      }
      setForms(initial);
    } finally {
      setLoading(false);
    }
  }, [token, shiftId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateForm = (appId: string, patch: Partial<RatingForm>) => {
    setForms((prev) => ({
      ...prev,
      [appId]: { ...prev[appId], ...patch },
    }));
  };

  const submitRating = async (appId: string) => {
    const form = forms[appId];
    if (!form || form.score === 0) {
      updateForm(appId, { error: "בחר דירוג" });
      return;
    }
    updateForm(appId, { loading: true, error: "" });

    try {
      const res = await fetch(`/api/applications/${appId}/rate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          score: form.score,
          flag: form.flag || undefined,
          comment: form.comment || undefined,
        }),
      });
      if (res.ok) {
        updateForm(appId, { submitted: true, loading: false });
      } else {
        const err = await res.json();
        updateForm(appId, {
          error: err.message || t("error.generic"),
          loading: false,
        });
      }
    } catch {
      updateForm(appId, { error: t("error.generic"), loading: false });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-foreground-tertiary">
        {t("general.loading")}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t("rating.page_title")}</h1>
        <Button variant="ghost" onClick={() => router.back()}>
          {t("general.back")}
        </Button>
      </div>

      {shiftTitle && (
        <p className="text-foreground-secondary text-sm">{shiftTitle}</p>
      )}

      {workers.length === 0 ? (
        <div className="text-center text-foreground-tertiary py-12">
          {t("rating.no_rateable")}
        </div>
      ) : (
        workers.map((w) => {
          const form = forms[w.application_id];
          if (!form) return null;

          return (
            <div
              key={w.application_id}
              className="border border-border rounded-xl p-4 space-y-3 bg-surface"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground">{w.worker_name}</span>
                  <span className="text-foreground-tertiary text-sm mr-2">
                    {w.worker_phone}
                  </span>
                </div>
                {w.worker_trust && (
                  <Badge variant="secondary">
                    {t("trust.score")}: {parseFloat(w.worker_trust).toFixed(1)}
                  </Badge>
                )}
              </div>

              {form.submitted ? (
                <div className="text-center py-4">
                  <Badge variant="success">{t("rating.success")}</Badge>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">
                      {t("rating.score_label")}
                    </label>
                    <div className="flex gap-1 items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            updateForm(w.application_id, { score: star })
                          }
                          className={`text-2xl transition-colors ${
                            star <= form.score
                              ? "text-yellow-400"
                              : "text-foreground-tertiary/40"
                          } hover:text-yellow-400`}
                        >
                          ★
                        </button>
                      ))}
                      {form.score > 0 && (
                        <span className="text-sm text-foreground-tertiary mr-2">
                          {STAR_LABELS[form.score - 1]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">
                      {t("rating.flag_label")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {FLAGS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() =>
                            updateForm(w.application_id, {
                              flag:
                                form.flag === f.value ? "" : f.value,
                            })
                          }
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            form.flag === f.value
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background border-border text-foreground-secondary hover:bg-surface"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1">
                      {t("rating.comment_label")}
                    </label>
                    <textarea
                      value={form.comment}
                      onChange={(e) =>
                        updateForm(w.application_id, {
                          comment: e.target.value,
                        })
                      }
                      placeholder={t("rating.comment_placeholder")}
                      className="w-full border border-border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      rows={2}
                      maxLength={500}
                    />
                  </div>

                  {form.error && (
                    <p className="text-danger text-sm">{form.error}</p>
                  )}

                  <Button
                    onClick={() => submitRating(w.application_id)}
                    loading={form.loading}
                    disabled={form.score === 0}
                    className="w-full"
                  >
                    {t("rating.submit_one")}
                  </Button>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
