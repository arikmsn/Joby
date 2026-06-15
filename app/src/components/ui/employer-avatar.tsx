import { cn } from "@/lib/cn";

const PALETTE = [
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-indigo-100 text-indigo-700",
];

export function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface EmployerAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function EmployerAvatar({ name, size = "md", className }: EmployerAvatarProps) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        SIZES[size],
        colorFor(name || ""),
        className
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
