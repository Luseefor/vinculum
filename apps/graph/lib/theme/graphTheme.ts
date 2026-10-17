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
  surfaceCanvas: "#171b22",
  gridMinor: "#1e2530",
  gridMajor: "#323e4e",
  axisLine: "#7e90a9",
  axisLabel: "#b7c5d8",
  axisOrigin: "#a5b4c9",
  axisNegativeRgb: [0.42, 0.48, 0.57],
  axisXPositiveRgb: [0.86, 0.48, 0.48],
  axisYPositiveRgb: [0.45, 0.72, 0.56],
  axisZPositiveRgb: [0.46, 0.65, 0.9],
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
  axisLabelBorder: "rgba(186, 201, 222, 0.18)",
  axisLabelBg: "rgba(32, 37, 45, 0.94)",
  axisLabelText: "#c0ccdc"
};

const LIGHT_THEME_TOKENS: GraphThemeTokens = {
  surfaceCanvas: "#ffffff",
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
