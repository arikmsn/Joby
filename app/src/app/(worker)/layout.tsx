"use client";

import type { ReactNode } from "react";
import { AuthProvider, useRequireAuth } from "@/lib/auth-context";
import { WorkerLayout } from "@/components/layout/worker-layout";
import { UserRole } from "@/lib/constants";
import { t } from "@/lib/i18n/he";

function WorkerGuard({ children }: { children: ReactNode }) {
  const { isLoading } = useRequireAuth(UserRole.WORKER);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted-foreground)]">{t("general.loading")}</p>
      </div>
    );
  }

  return <WorkerLayout>{children}</WorkerLayout>;
}

export default function WorkerRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <WorkerGuard>{children}</WorkerGuard>
    </AuthProvider>
  );
}
