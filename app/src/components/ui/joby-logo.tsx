import Image from "next/image";
import { cn } from "@/lib/cn";

interface JobyLogoProps {
  className?: string;
  size?: number;
}

/**
 * Official Joby logo (JobyLogo.png) — used wherever the full product
 * logo mark should appear (auth screens, app header).
 */
export function JobyLogo({ className, size = 40 }: JobyLogoProps) {
  return (
    <Image
      src="/joby-logo.png"
      alt="Joby"
      width={size}
      height={size}
      priority
      className={cn("rounded-xl object-contain", className)}
    />
  );
}
