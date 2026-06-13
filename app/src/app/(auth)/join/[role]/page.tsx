import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { isAuthRole } from "@/lib/auth-routes";

export default async function RoleJoinPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!isAuthRole(role)) redirect("/register");
  return <RegisterForm forcedRole={role} />;
}
