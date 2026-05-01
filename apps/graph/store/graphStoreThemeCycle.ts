import type { GraphUiState } from "@/types/graphUi";

export function getNextThemeMode(current: GraphUiState["themeMode"]): GraphUiState["themeMode"] {
  if (current === "system") {
    return "light";
  }

  if (current === "light") {
    return "dark";
  }

  return "system";
}
