"use client";

import type { ReactNode } from "react";
import { Briefcase, ClipboardList, User, Bell, QrCode } from "lucide-react";
import { BottomNavLink } from "./nav-link";
import { RoleMismatchBanner } from "./role-mismatch-banner";
import { t } from "@/lib/i18n/he";

export function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background border-b border-border-light px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
            J
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {t("app.name")}
          </span>
        </div>
      </header>

      <RoleMismatchBanner />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface safe-area-bottom">
        <div className="mx-auto max-w-lg flex items-stretch">
          <BottomNavLink
            href="/shifts"
            icon={<Briefcase className="h-5 w-5" />}
            label={t("nav.shifts")}
          />
          <BottomNavLink
            href="/my-shifts"
            icon={<ClipboardList className="h-5 w-5" />}
            label={t("nav.my_shifts")}
          />
          <BottomNavLink
            href="/scan"
            icon={<QrCode className="h-5 w-5" />}
            label={t("qr.scan")}
          />
          <BottomNavLink
            href="/notifications"
            icon={<Bell className="h-5 w-5" />}
            label={t("nav.notifications")}
          />
          <BottomNavLink
            href="/profile"
            icon={<User className="h-5 w-5" />}
            label={t("nav.profile")}
          />
        </div>
      </nav>
    </div>
  );
}
