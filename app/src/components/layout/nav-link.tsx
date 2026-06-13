"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

export function NavLink({ href, icon, label, onClick }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-primary-50 text-primary-700 font-medium"
          : "text-foreground-secondary hover:bg-gray-50 hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function BottomNavLink({ href, icon, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]"
    >
      <span className={cn("transition-colors", isActive ? "text-primary" : "text-foreground-tertiary")}>
        {icon}
      </span>
      <span
        className={cn(
          "transition-colors",
          isActive ? "text-primary font-semibold" : "text-foreground-tertiary"
        )}
      >
        {label}
      </span>
    </Link>
  );
}
