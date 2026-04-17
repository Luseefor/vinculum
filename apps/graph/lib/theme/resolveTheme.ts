import type { ThemeMode } from "@/types/graphUi";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "light") {
    return "light";
  }

  if (mode === "dark") {
    return "dark";
  }

  return prefersDark ? "dark" : "light";
}
