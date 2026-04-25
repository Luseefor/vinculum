import type { AccentPreset, ThemeMode, UiDensity } from "@/types/graphUi";

const STORAGE_KEY = "vinculum-theme-mode";
const ACCENT_STORAGE_KEY = "vinculum-accent-preset";
const DENSITY_STORAGE_KEY = "vinculum-ui-density";

const VALID_THEME_MODES: ThemeMode[] = ["system", "light", "dark"];
const VALID_ACCENT_PRESETS: AccentPreset[] = [
  "indigo",
  "blue",
  "cyan",
  "emerald",
  "green",
  "amber",
  "orange",
  "rose",
  "pink",
  "violet"
];
const VALID_DENSITIES: UiDensity[] = ["comfortable", "balanced", "compact"];

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

export function loadStoredAccentPreset(): AccentPreset {
  if (typeof window === "undefined") {
    return "indigo";
  }

  try {
    const storedValue = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (storedValue && isAccentPreset(storedValue)) {
      return storedValue;
    }
  } catch {
    return "indigo";
  }

  return "indigo";
}

export function persistAccentPreset(preset: AccentPreset) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, preset);
  } catch {
    return;
  }
}

export function loadStoredDensity(): UiDensity {
  if (typeof window === "undefined") {
    return "balanced";
  }
  try {
    const storedValue = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    if (storedValue && isDensity(storedValue)) {
      return storedValue;
    }
  } catch {
    return "balanced";
  }
  return "balanced";
}

export function persistDensity(density: UiDensity) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    return;
  }
}

function isThemeMode(value: string): value is ThemeMode {
  return VALID_THEME_MODES.includes(value as ThemeMode);
}

function isAccentPreset(value: string): value is AccentPreset {
  return VALID_ACCENT_PRESETS.includes(value as AccentPreset);
}

function isDensity(value: string): value is UiDensity {
  return VALID_DENSITIES.includes(value as UiDensity);
}
