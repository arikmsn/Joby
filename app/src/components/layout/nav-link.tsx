"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 active:scale-[0.98]",
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

export function BottomNavLink({ href, icon, label, badge }: NavLinkProps & { badge?: number }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      className="relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-transform duration-150 active:scale-[0.92]"
    >
      <span className="relative flex h-9 w-12 items-center justify-center">
        {isActive && (
          <motion.span
            layoutId="bottom-nav-active-pill"
            className="absolute inset-0 rounded-2xl bg-primary"
            transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
          />
        )}
        <span
          className={cn(
            "relative transition-all duration-200",
            isActive ? "text-white scale-105" : "text-foreground-tertiary"
          )}
        >
          {icon}
          {!!badge && badge > 0 && (
            <span className="absolute -top-1.5 -end-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface animate-pop-in">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          "relative transition-colors duration-200",
          isActive ? "text-secondary font-bold" : "text-foreground-tertiary font-medium"
        )}
      >
        {label}
      </span>
    </Link>
  );
}
