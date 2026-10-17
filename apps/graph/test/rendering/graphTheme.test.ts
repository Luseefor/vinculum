import { readFileSync } from "node:fs";
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

  it("keeps dark canvas and grid colors aligned with the editor CSS", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const block = css.match(/:root\[data-theme="dark"\] \{([^}]+)\}/)?.[1];
    expect(block).toBeDefined();
    const dark = getGraphThemeTokens("dark");
    for (const [variable, color] of [
      ["surface-canvas", dark.surfaceCanvas], ["grid-minor", dark.gridMinor], ["grid-major", dark.gridMajor]
    ]) expect(block).toContain(`--${variable}: ${color};`);
  });

  it("keeps graph labels legible and grid lines subordinate to axes", () => {
    const luminance = (hex: string) => {
      const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => Number.parseInt(value, 16) / 255)
        .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const dark = getGraphThemeTokens("dark");
    expect(luminance(dark.gridMinor)).toBeGreaterThan(luminance(dark.surfaceCanvas));
    expect(luminance(dark.gridMajor)).toBeGreaterThan(luminance(dark.gridMinor));
    expect(luminance(dark.axisLine)).toBeGreaterThan(luminance(dark.gridMajor));
    for (const theme of ["dark", "light"] as const) {
      const tokens = getGraphThemeTokens(theme);
      const values = [luminance(tokens.axisLabel), luminance(tokens.surfaceCanvas)].sort((a, b) => a - b);
      expect((values[1] + .05) / (values[0] + .05)).toBeGreaterThanOrEqual(4.5);
    }
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
