// Public route group — candidate landing pages ONLY.
// ISOLATION RULES (execution pack §5):
// - No admin components, no lib/growth UI imports, no he-growth strings.
// - Analytics pixels (Meta/GA) may be added ONLY here, never in admin —
//   and only after the privacy-counsel launch gate is cleared.
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
