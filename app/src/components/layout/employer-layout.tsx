"use client";

import type { ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Plus,
  LogOut,
  Menu,
  X,
  Building2,
  Users,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "./nav-link";
import { RoleMismatchBanner } from "./role-mismatch-banner";
import { JobyMark } from "@/components/ui/joby-mark";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n/he";
import type { EmployerProfile } from "@/lib/types";

export function EmployerLayout({ children }: { children: ReactNode }) {
  const { profile, logout } = useAuth();
  const employerProfile = profile as EmployerProfile | null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useDocumentTitle(t("nav.dashboard"));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-l border-border bg-surface">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <JobyMark className="h-6 w-6" />
            <h1 className="text-xl font-bold text-primary">
              {t("app.name")}
            </h1>
          </div>
          {employerProfile && (
            <p className="text-sm text-foreground-secondary mt-1">
              {employerProfile.business_name}
            </p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink
            href="/dashboard"
            icon={<LayoutDashboard className="h-5 w-5" />}
            label={t("nav.dashboard")}
          />
          <NavLink
            href="/manage-shifts"
            icon={<CalendarDays className="h-5 w-5" />}
            label={t("nav.shifts")}
          />
          <NavLink
            href="/manage-shifts/new"
            icon={<Plus className="h-5 w-5" />}
            label={t("shift.create")}
          />
          <NavLink
            href="/known-workers"
            icon={<Users className="h-5 w-5" />}
            label={t("nav.known_workers")}
          />
          <NavLink
            href="/reports"
            icon={<BarChart3 className="h-5 w-5" />}
            label={t("nav.reports")}
          />
          <NavLink
            href="/business"
            icon={<Building2 className="h-5 w-5" />}
            label={t("nav.profile")}
          />
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground-secondary hover:bg-gray-50 hover:text-foreground rounded-lg transition-all duration-150 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 -mr-1 rounded-lg text-foreground-secondary transition-colors duration-150 hover:bg-background active:scale-90"
              >
                <motion.span
                  key={mobileMenuOpen ? "close" : "open"}
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </motion.span>
              </button>
              <div className="flex items-center gap-2">
                <JobyMark className="h-6 w-6" />
                <h1 className="text-lg font-bold text-primary">
                  {t("app.name")}
                </h1>
              </div>
            </div>
            {employerProfile && (
              <span className="text-sm text-foreground-secondary truncate max-w-[150px]">
                {employerProfile.business_name}
              </span>
            )}
          </div>

          <AnimatePresence initial={false}>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <nav className="mt-3 pt-3 border-t border-border space-y-1">
                  <NavLink
                    href="/dashboard"
                    icon={<LayoutDashboard className="h-5 w-5" />}
                    label={t("nav.dashboard")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <NavLink
                    href="/manage-shifts"
                    icon={<CalendarDays className="h-5 w-5" />}
                    label={t("nav.shifts")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <NavLink
                    href="/manage-shifts/new"
                    icon={<Plus className="h-5 w-5" />}
                    label={t("shift.create")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <NavLink
                    href="/known-workers"
                    icon={<Users className="h-5 w-5" />}
                    label={t("nav.known_workers")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <NavLink
                    href="/reports"
                    icon={<BarChart3 className="h-5 w-5" />}
                    label={t("nav.reports")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <NavLink
                    href="/business"
                    icon={<Building2 className="h-5 w-5" />}
                    label={t("nav.profile")}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground-secondary hover:bg-gray-50 rounded-lg transition-colors duration-150 active:scale-[0.98]"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                  </button>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <RoleMismatchBanner />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
