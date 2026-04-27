import type { AdaptiveGridState } from "@/lib/graph/adaptiveGridState";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";

export type GraphThreeEngineTickRuntime = {
  isContextLost: boolean;
  isAltDown: boolean;
  lastFrameTime: number;
  sampleWindowStart: number;
  sampleFrames: number;
  sampleWorstFrameMs: number;
  lastLongFrameLogAt: number;
  lastBaselinePlanePair: "xy" | "xz" | "yz";
  lastDomTheme: ResolvedTheme;
  lastCameraResetVersion: number;
  objectsDirty: boolean;
  gridState: AdaptiveGridState;
  baselinePlaneMode: number;
};
