"use client";

import type { ReactNode } from "react";
import { AuthProvider, useRequireAuth } from "@/lib/auth-context";
import { AdminLayout } from "@/components/layout/admin-layout";
import { UserRole } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

function AdminGuard({ children }: { children: ReactNode }) {
  const { isLoading } = useRequireAuth(UserRole.ADMIN);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted-foreground)]">{t("general.loading")}</p>
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}

export default function AdminRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  );
}
