import type { AdaptiveGridState } from "@/lib/graph/adaptiveGridState";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import type { ScenePressure } from "@/lib/performance/performanceMetrics";

export type GraphThreeEngineTickRuntime = {
  isContextLost: boolean;
  isAltDown: boolean;
  lastFrameTime: number;
  lastFrameDeltaMs: number;
  sampleWindowStart: number;
  sampleFrames: number;
  sampleFrameTimeSumMs: number;
  sampleWorstFrameMs: number;
  lastLongFrameLogAt: number;
  lastBaselinePlanePair: "xy" | "xz" | "yz";
  lastDomTheme: ResolvedTheme;
  lastCameraResetVersion: number;
  objectsDirty: boolean;
  gridState: AdaptiveGridState;
  baselinePlaneMode: number;
  scenePressure: ScenePressure;
  // S24-R1: streamline toggles are ui-only (never set objectsDirty), so
  // pressure tracks the configs map ref to stay fresh without a rebuild.
  lastStreamlineConfigs: Record<string, unknown> | null;
};
