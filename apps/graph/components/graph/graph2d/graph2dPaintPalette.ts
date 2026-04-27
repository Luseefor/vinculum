import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import type { Graph2dPaintPalette } from "./graph2dCanvasTypes";

export function graph2dPaintPalette(resolvedTheme: ResolvedTheme): Graph2dPaintPalette {
  const tokens = getGraphThemeTokens(resolvedTheme);
  return {
    background: tokens.surfaceCanvas,
    gridMinor: tokens.gridMinor,
    gridMajor: tokens.gridMajor,
    axis: tokens.axisLine,
    axisLabel: tokens.axisLabel,
    probe: resolvedTheme === "dark" ? "#f472b6" : "#db2777",
    sketch: resolvedTheme === "dark" ? "#38bdf8" : "#0284c7"
  };
}
