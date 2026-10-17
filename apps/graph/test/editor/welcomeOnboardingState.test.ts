import { describe, expect, it } from "vitest";
import {
  readWelcomeOnboardingDismissed,
  setWelcomeOnboardingDismissed,
  shouldShowWelcomeOnStartup,
  WELCOME_ONBOARDING_STORAGE_KEY
} from "@/lib/onboarding/welcomeOnboardingState";

describe("welcome onboarding state", () => {
  it("persists dismissed preference", () => {
    window.localStorage.clear();
    expect(readWelcomeOnboardingDismissed()).toBe(false);
    setWelcomeOnboardingDismissed(true);
    expect(readWelcomeOnboardingDismissed()).toBe(true);
  });

  it("treats mismatched version record as not dismissed", () => {
    window.localStorage.setItem(
      WELCOME_ONBOARDING_STORAGE_KEY,
      JSON.stringify({ version: 999, dismissed: true, updatedAt: "2026-04-28T00:00:00.000Z" })
    );
    expect(readWelcomeOnboardingDismissed()).toBe(false);
  });

  it("shows welcome only when startup is safe and useful", () => {
    expect(
      shouldShowWelcomeOnStartup({
        dismissed: false,
        hasCheckedRecovery: true,
        hasCheckedSharedScene: true,
        recoveryDialogOpen: false,
        sharedSceneDialogOpen: false,
        hasObjects: false,
        hasNamedProject: false,
        hasRecoverySnapshot: false
      })
    ).toBe(true);

    expect(
      shouldShowWelcomeOnStartup({
        dismissed: false,
        hasCheckedRecovery: true,
        hasCheckedSharedScene: true,
        recoveryDialogOpen: true,
        sharedSceneDialogOpen: false,
        hasObjects: false,
        hasNamedProject: false,
        hasRecoverySnapshot: false
      })
    ).toBe(false);
  });
});
