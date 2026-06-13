import { UserRole } from "./constants";

export type AuthRole = "worker" | "employer";

export function isAuthRole(value: string | undefined | null): value is AuthRole {
  return value === "worker" || value === "employer";
}

export function roleHomePath(role: string): string {
  if (role === UserRole.EMPLOYER) return "/dashboard";
  if (role === UserRole.ADMIN) return "/incidents";
  return "/shifts";
}
