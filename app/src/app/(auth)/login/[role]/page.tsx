import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { isAuthRole } from "@/lib/auth-routes";

export default async function RoleLoginPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!isAuthRole(role)) redirect("/login");
  return <LoginForm role={role} />;
}
