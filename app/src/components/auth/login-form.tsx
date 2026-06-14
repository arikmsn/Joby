"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useDocumentTitle } from "@/lib/use-document-title";
import { t } from "@/lib/i18n/he";
import Link from "next/link";
import { Building2, User } from "lucide-react";
import { JobyLogo } from "@/components/ui/joby-logo";
import { roleHomePath, type AuthRole } from "@/lib/auth-routes";
import type { User as AppUser, EmployerProfile, WorkerProfile } from "@/lib/types";

type Step = "phone" | "otp" | "choose";

interface AccountOption {
  token: string;
  user: AppUser;
  profile: EmployerProfile | WorkerProfile | null;
}

export function LoginForm({ role }: { role?: AuthRole }) {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  // Already-logged-in users visiting an auth page go straight to their system.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(roleHomePath(user.role));
    }
  }, [isLoading, user, router]);

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
        const joinPath = role ? `/join/${role}` : "/register";
        router.push(`${joinPath}?phone=${encodeURIComponent(phone)}`);
        return;
      }

      if (data.accounts && data.accounts.length > 1) {
        setAccounts(data.accounts);
        setStep("choose");
        return;
      }

      login(data.token, data.user, data.profile);

      const home = roleHomePath(data.user.role);
      if (role && data.user.role !== role) {
        router.push(`${home}?notice=role_mismatch`);
      } else {
        router.push(home);
      }
    } catch {
      setError(t("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  function handleChooseAccount(account: AccountOption) {
    login(account.token, account.user, account.profile);
    router.push(roleHomePath(account.user.role));
  }

  const title =
    role === "worker"
      ? t("auth.worker.login_title")
      : role === "employer"
        ? t("auth.employer.login_title")
        : t("auth.login");

  useDocumentTitle(title);

  if (isLoading || user) {
    return (
      <div className="text-center py-10">
        <p className="text-foreground-secondary">{t("general.loading")}</p>
      </div>
    );
  }

  // Phone has access to more than one interface — let the user pick.
  if (step === "choose") {
    return (
      <div className="space-y-8">
        <div className="hero-glow rounded-3xl px-6 py-8 text-center text-white shadow-float">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <JobyLogo size={64} className="h-16 w-16 rounded-xl" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("auth.choose_role_title")}</h1>
        </div>

        <div className="space-y-3">
          {accounts.map((account) => (
            <button
              key={account.user.id}
              onClick={() => handleChooseAccount(account)}
              className="w-full flex items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:border-primary hover:shadow-card-hover transition-all text-right"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="font-semibold text-foreground">
                {account.user.role === "admin" ? t("auth.admin") : t("auth.employer")}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Generic gateway: no role in the URL — let the user choose where to go.
  if (!role) {
    return (
      <div className="space-y-8">
        <div className="hero-glow rounded-3xl px-6 py-8 text-center text-white shadow-float">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <JobyLogo size={64} className="h-16 w-16 rounded-xl" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("app.name")}</h1>
          <p className="mt-1.5 text-sm text-white/70">{t("auth.login")}</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login/worker"
            className="w-full flex items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:border-primary hover:shadow-card-hover transition-all text-right"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{t("auth.login_as_worker")}</div>
              <div className="text-sm text-foreground-secondary">מצא משמרות והתחל לעבוד</div>
            </div>
          </Link>

          <Link
            href="/login/employer"
            className="w-full flex items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:border-primary hover:shadow-card-hover transition-all text-right"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{t("auth.login_as_employer")}</div>
              <div className="text-sm text-foreground-secondary">צור משמרות וגייס עובדים</div>
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-foreground-secondary">
          {t("auth.not_registered")}{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            {t("auth.register")}
          </Link>
        </p>
      </div>
    );
  }

  const tagline =
    role === "worker" ? t("auth.worker.login_tagline") : t("auth.employer.login_tagline");

  return (
    <div className="space-y-8">
      {/* Logo area */}
      <div className="hero-glow rounded-3xl px-6 py-8 text-center text-white shadow-float">
        <div className="inline-flex items-center justify-center rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
          <JobyLogo size={64} className="h-16 w-16 rounded-xl" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-white/70">{tagline}</p>
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
        <Link href={`/join/${role}`} className="text-primary font-medium hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
