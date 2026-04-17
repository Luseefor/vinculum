import type { ResolvedTheme } from "@/lib/theme/resolveTheme";

export interface GraphThemeTokens {
  surfaceCanvas: string;
  gridMinor: string;
  gridMajor: string;
  axisLine: string;
  axisLabel: string;
  axisOrigin: string;
  axisNegativeRgb: [number, number, number];
  axisXPositiveRgb: [number, number, number];
  axisYPositiveRgb: [number, number, number];
  axisZPositiveRgb: [number, number, number];
  sceneHemiGround: string;
  sceneHemiSky: string;
  sceneAmbientIntensity: number;
  sceneHemiIntensity: number;
  sceneKeyIntensity: number;
  sceneFillIntensity: number;
  sceneFogNear: number;
  sceneFogFar: number;
  sceneSurfaceRoughness: number;
  sceneSurfaceMetalness: number;
  scenePlaneRoughness: number;
  scenePlaneMetalness: number;
  scenePlaneOpacity: number;
  axisLabelBorder: string;
  axisLabelBg: string;
  axisLabelText: string;
}

const DARK_THEME_TOKENS: GraphThemeTokens = {
  surfaceCanvas: "#131316",
  gridMinor: "#252528",
  gridMajor: "#3a3a40",
  axisLine: "#6a6a75",
  axisLabel: "#8a8a95",
  axisOrigin: "#64748b",
  axisNegativeRgb: [0.17, 0.2, 0.27],
  axisXPositiveRgb: [0.62, 0.37, 0.37],
  axisYPositiveRgb: [0.4, 0.56, 0.4],
  axisZPositiveRgb: [0.38, 0.5, 0.66],
  sceneHemiGround: "#131316",
  sceneHemiSky: "#e0e0e5",
  sceneAmbientIntensity: 0.4,
  sceneHemiIntensity: 0.3,
  sceneKeyIntensity: 1,
  sceneFillIntensity: 0.25,
  sceneFogNear: 120,
  sceneFogFar: 8000,
  sceneSurfaceRoughness: 0.35,
  sceneSurfaceMetalness: 0.08,
  scenePlaneRoughness: 0.4,
  scenePlaneMetalness: 0.05,
  scenePlaneOpacity: 0.78,
  axisLabelBorder: "rgba(51, 65, 85, 0.7)",
  axisLabelBg: "rgba(2, 6, 23, 0.85)",
  axisLabelText: "#e2e8f0"
};

const LIGHT_THEME_TOKENS: GraphThemeTokens = {
  surfaceCanvas: "#f5f7fb",
  gridMinor: "#dce2ee",
  gridMajor: "#bcc7dc",
  axisLine: "#62738e",
  axisLabel: "#435670",
  axisOrigin: "#64748b",
  axisNegativeRgb: [0.45, 0.5, 0.58],
  axisXPositiveRgb: [0.82, 0.36, 0.36],
  axisYPositiveRgb: [0.29, 0.62, 0.41],
  axisZPositiveRgb: [0.29, 0.48, 0.82],
  sceneHemiGround: "#dce2ee",
  sceneHemiSky: "#f8fafc",
  sceneAmbientIntensity: 0.6,
  sceneHemiIntensity: 0.5,
  sceneKeyIntensity: 1.15,
  sceneFillIntensity: 0.35,
  sceneFogNear: 100,
  sceneFogFar: 6000,
  sceneSurfaceRoughness: 0.5,
  sceneSurfaceMetalness: 0.03,
  scenePlaneRoughness: 0.52,
  scenePlaneMetalness: 0.02,
  scenePlaneOpacity: 0.72,
  axisLabelBorder: "rgba(148, 163, 184, 0.9)",
  axisLabelBg: "rgba(255, 255, 255, 0.9)",
  axisLabelText: "#334155"
};

export function getGraphThemeTokens(theme: ResolvedTheme): GraphThemeTokens {
  return theme === "light" ? LIGHT_THEME_TOKENS : DARK_THEME_TOKENS;
}
