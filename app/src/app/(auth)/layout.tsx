"use client";

import { AuthProvider } from "@/lib/auth-context";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </AuthProvider>
  );
}
