import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "destructive"
    | "muted"
    | "urgent"
    | "info";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-primary-100 text-primary-800",
    secondary: "bg-gray-100 text-gray-700",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-red-50 text-red-700 border border-red-200",
    destructive: "bg-red-50 text-red-700 border border-red-200",
    muted: "bg-gray-50 text-gray-500 border border-gray-200",
    urgent: "bg-red-600 text-white animate-pulse",
    info: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-5 transition-colors duration-150",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
