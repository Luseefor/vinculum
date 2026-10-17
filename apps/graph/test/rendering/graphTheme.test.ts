import { describe, expect, it } from "vitest";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";

describe("graphTheme tokens", () => {
  it("returns distinct light and dark palettes", () => {
    const dark = getGraphThemeTokens("dark");
    const light = getGraphThemeTokens("light");

    expect(dark.surfaceCanvas).not.toBe(light.surfaceCanvas);
    expect(dark.gridMinor).not.toBe(light.gridMinor);
    expect(dark.gridMajor).not.toBe(light.gridMajor);
  });

  it("keeps dark theme darker than light theme for canvas", () => {
    const dark = getGraphThemeTokens("dark");
    const light = getGraphThemeTokens("light");

    expect(isDarkHex(dark.surfaceCanvas)).toBe(true);
    expect(isDarkHex(light.surfaceCanvas)).toBe(false);
  });
});

function isDarkHex(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  // Perceived luminance.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
