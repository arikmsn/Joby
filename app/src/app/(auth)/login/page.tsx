"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import Link from "next/link";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  async function handleSendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }
      if (data.devOtp) setDevOtp(data.devOtp);
      setStep("otp");
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || t("error.generic"));
        return;
      }

      if (data.isNewUser) {
        router.push(`/register?phone=${encodeURIComponent(phone)}`);
        return;
      }

      login(data.token, data.user, data.profile);

      if (data.user.role === "employer") {
        router.push("/dashboard");
      } else if (data.user.role === "admin") {
        router.push("/incidents");
      } else {
        router.push("/shifts");
      }
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Logo area */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <span className="text-2xl font-bold text-primary">J</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.name")}
        </h1>
        <p className="text-sm text-foreground-secondary mt-1">
          {t("app.tagline")}
        </p>
      </div>

      {/* Form */}
      <div className="bg-surface rounded-xl border border-border p-6 shadow-card">
        {step === "phone" ? (
          <div className="space-y-5">
            <Input
              id="phone"
              label={t("auth.phone")}
              placeholder={t("auth.phone.placeholder")}
              type="tel"
              dir="ltr"
              className="text-left"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={error || undefined}
            />
            <Button
              className="w-full"
              size="lg"
              onClick={handleSendOtp}
              loading={loading}
              disabled={phone.length < 9}
            >
              {t("auth.send_otp")}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-foreground-secondary text-center">
              {t("auth.otp")} <span dir="ltr" className="font-medium text-foreground">{phone}</span>
            </p>
            {devOtp && (
              <p className="text-xs text-center bg-warning/10 text-warning rounded-lg py-2 font-mono" dir="ltr">
                DEV OTP: {devOtp}
              </p>
            )}
            <Input
              id="otp"
              placeholder={t("auth.otp.placeholder")}
              type="text"
              inputMode="numeric"
              dir="ltr"
              className="text-center text-xl tracking-[0.3em] font-medium"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              error={error || undefined}
            />
            <Button
              className="w-full"
              size="lg"
              onClick={handleVerifyOtp}
              loading={loading}
              disabled={otp.length !== 6}
            >
              {t("auth.verify")}
            </Button>
            <button
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError("");
              }}
              className="w-full text-center text-sm text-foreground-secondary hover:text-foreground transition-colors"
            >
              {t("general.back")}
            </button>
          </div>
        )}
      </div>

      {/* Footer link */}
      <p className="text-center text-sm text-foreground-secondary">
        {t("auth.not_registered")}{" "}
        <Link href="/register" className="text-primary font-medium hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
