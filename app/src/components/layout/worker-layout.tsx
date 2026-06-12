"use client";

import type { ReactNode } from "react";
import { Briefcase, ClipboardList, User, Bell, QrCode } from "lucide-react";
import { BottomNavLink } from "./nav-link";
import { t } from "@/lib/i18n/he";

export function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-primary">
            {t("app.name")}
          </h1>
          <span className="text-xs text-foreground-tertiary">
            {t("app.tagline")}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-sm border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
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
