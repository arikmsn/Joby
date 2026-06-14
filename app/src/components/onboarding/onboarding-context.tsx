"use client";

import { createContext, useContext } from "react";

interface OnboardingContextValue {
  openOnboarding: (step?: number) => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within WorkerLayout");
  return ctx;
}
