"use client";

// Growth module client-side gate (UX only — the real control is
// withGrowthAuth on every /api/admin/growth/* route).
// Access is granted when the user holds any growth sub-role.
// Do NOT gate on NEXT_PUBLIC_GROWTH_MODULE_ENABLED here — that value is
// baked into the JS bundle at build time and a stale cached bundle would
// deny access to authorized users.

import { useAuth } from "@/lib/auth-context";

export function useGrowthAccess(): {
  hasAccess: boolean;
  subRole: string | null;
  isLoading: boolean;
} {
  const { user, isLoading } = useAuth();
  const subRole = user?.admin_sub_role ?? null;
  return {
    hasAccess: !!subRole,
    subRole,
    isLoading,
  };
}
