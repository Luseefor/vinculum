export const WELCOME_ONBOARDING_STORAGE_KEY = "vinculum-welcome-onboarding-v1";
export const WELCOME_ONBOARDING_VERSION = 1;

interface WelcomeOnboardingRecord {
  version: number;
  dismissed: boolean;
  updatedAt: string;
}

export class WelcomeOnboardingStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WelcomeOnboardingStateError";
  }
}

export function readWelcomeOnboardingDismissed(): boolean {
  const storage = getStorage();
  const raw = storage.getItem(WELCOME_ONBOARDING_STORAGE_KEY);
  if (!raw) {
    return false;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WelcomeOnboardingStateError(
      "Welcome preference could not be read. Continue to keep using Vinculum."
    );
  }

  if (!isRecord(parsed)) {
    throw new WelcomeOnboardingStateError(
      "Welcome preference is invalid. Continue to keep using Vinculum."
    );
  }

  if (parsed.version !== WELCOME_ONBOARDING_VERSION) {
    return false;
  }

  return parsed.dismissed === true;
}

export function setWelcomeOnboardingDismissed(dismissed: boolean): void {
  const storage = getStorage();
  const record: WelcomeOnboardingRecord = {
    version: WELCOME_ONBOARDING_VERSION,
    dismissed,
    updatedAt: new Date().toISOString()
  };
  try {
    storage.setItem(WELCOME_ONBOARDING_STORAGE_KEY, JSON.stringify(record));
  } catch {
    throw new WelcomeOnboardingStateError(
      "Welcome preference could not be saved. Continue to keep using Vinculum."
    );
  }
}

export interface WelcomeStartupInput {
  dismissed: boolean;
  hasCheckedRecovery: boolean;
  hasCheckedSharedScene: boolean;
  recoveryDialogOpen: boolean;
  sharedSceneDialogOpen: boolean;
  hasObjects: boolean;
  hasNamedProject: boolean;
  hasRecoverySnapshot: boolean;
}

export function shouldShowWelcomeOnStartup(input: WelcomeStartupInput): boolean {
  if (input.dismissed) return false;
  if (!input.hasCheckedRecovery || !input.hasCheckedSharedScene) return false;
  if (input.recoveryDialogOpen || input.sharedSceneDialogOpen) return false;
  if (input.hasObjects || input.hasNamedProject || input.hasRecoverySnapshot) return false;
  return true;
}

function getStorage(): Storage {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    throw new WelcomeOnboardingStateError("Welcome preference storage is unavailable.");
  }
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
