"use client";

import type { ReactNode } from "react";
import { AuthProvider, useRequireAuth } from "@/lib/auth-context";
import { EmployerLayout } from "@/components/layout/employer-layout";
import { UserRole } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

function EmployerGuard({ children }: { children: ReactNode }) {
  const { isLoading } = useRequireAuth(UserRole.EMPLOYER);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted-foreground)]">{t("general.loading")}</p>
      </div>
    );
  }

  return <EmployerLayout>{children}</EmployerLayout>;
}

export default function EmployerRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <EmployerGuard>{children}</EmployerGuard>
    </AuthProvider>
  );
}
