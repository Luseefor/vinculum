import type { ThemeMode } from "@/types/graphUi";

const STORAGE_KEY = "vinculum-theme-mode";

const VALID_THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

export function loadStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue && isThemeMode(storedValue)) {
      return storedValue;
    }
  } catch {
    return "system";
  }

  return "system";
}

export function persistThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    return;
  }
}

function isThemeMode(value: string): value is ThemeMode {
  return VALID_THEME_MODES.includes(value as ThemeMode);
}
