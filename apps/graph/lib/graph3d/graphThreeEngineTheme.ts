import type { ResolvedTheme } from "@/lib/theme/resolveTheme";

export function readResolvedThemeFromDom(): ResolvedTheme {
  const value = document.documentElement.dataset.theme;
  if (value === "light" || value === "dark") {
    return value;
  }
  return "dark";
}
