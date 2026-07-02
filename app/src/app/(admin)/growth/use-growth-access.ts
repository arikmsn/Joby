"use client";

// Growth module client-side gate (UX only — the real control is
// withGrowthAuth on every /api/admin/growth/* route).
// Visible only when the admin holds a growth sub-role AND the
// client flag mirror is on.

import { useAuth } from "@/lib/auth-context";

export function isGrowthNavEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_MODULE_ENABLED === "true";
}

export function useGrowthAccess(): {
  hasAccess: boolean;
  subRole: string | null;
  isLoading: boolean;
} {
  const { user, isLoading } = useAuth();
  const subRole = user?.admin_sub_role ?? null;
  return {
    hasAccess: isGrowthNavEnabled() && !!subRole,
    subRole,
    isLoading,
  };
}
