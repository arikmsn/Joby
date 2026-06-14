import type { WorkerProfile } from "./types";

/**
 * Auto-show the full onboarding flow only for workers who haven't completed
 * or explicitly skipped it, and whose core matching preferences are empty
 * (covers first login/registration as well as profiles left mostly blank).
 */
export function shouldAutoShowOnboarding(profile: WorkerProfile | null): boolean {
  if (!profile) return false;
  if (profile.onboarding_completed_at || profile.onboarding_skipped_at) return false;
  const noRoles = !profile.experience_tags || profile.experience_tags.length === 0;
  const noCities = !profile.preferred_cities || profile.preferred_cities.length === 0;
  return noRoles && noCities;
}

/** Whether to show the compact "complete your profile" prompt in the feed. */
export function isOnboardingIncomplete(profile: WorkerProfile | null): boolean {
  if (!profile) return false;
  return !profile.onboarding_completed_at;
}

export type OnboardingMissingKind = "roles" | "cities" | "preferences" | "general";

/** What's missing, used to tailor the incomplete-state banner copy. */
export function onboardingMissingKind(profile: WorkerProfile | null): OnboardingMissingKind {
  if (!profile) return "general";
  if (!profile.experience_tags || profile.experience_tags.length === 0) return "roles";
  if (!profile.preferred_cities || profile.preferred_cities.length === 0) return "cities";
  if ((!profile.languages || profile.languages.length === 0) && profile.min_pay == null) return "preferences";
  return "general";
}

/** The onboarding step (1-4) to jump to so the worker fills the missing piece first. */
export function onboardingFirstIncompleteStep(profile: WorkerProfile | null): 1 | 2 | 3 | 4 {
  const kind = onboardingMissingKind(profile);
  switch (kind) {
    case "roles":
      return 1;
    case "cities":
      return 2;
    case "preferences":
      return 4;
    default:
      return 1;
  }
}
