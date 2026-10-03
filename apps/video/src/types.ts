export interface VideoSceneProps {
  isVertical?: boolean;
}

export const VIDEO_FPS = 30;
export const TOTAL_DURATION_SECONDS = 50;
export const TOTAL_DURATION_FRAMES = TOTAL_DURATION_SECONDS * VIDEO_FPS; // 1500 frames

export const SCENE_DURATIONS = {
  scene1Hook: 210, // 0 - 210 (7s)
  scene2Intro: 230, // 200 - 430 (7.67s)
  scene3UnifiedCanvas: 240, // 420 - 660 (8.0s)
  scene4Surfaces: 240, // 650 - 890 (8.0s)
  scene5EnginePower: 230, // 880 - 1110 (7.67s)
  scene6WorkflowExport: 210, // 1100 - 1310 (7.0s)
  scene7Outro: 200, // 1300 - 1500 (6.67s)
};

export const BRAND_COLORS = {
  blue: "#3b82f6",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#fb7185",
  emerald: "#10b981",
  bgDark: "#050811",
  bgCard: "#0f172a",
};
