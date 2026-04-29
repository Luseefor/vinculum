import {
  LONG_FRAME_LOG_COOLDOWN_MS,
  LONG_FRAME_MS,
  PERF_SAMPLE_WINDOW_MS
} from "./graphThreeEngineConstants";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";
import type { ScenePressure } from "@/lib/performance/performanceMetrics";

export function applyGraphThreeTickPerfSampling(
  now: number,
  frameDeltaMs: number,
  runtime: GraphThreeEngineTickRuntime,
  perfBadge: HTMLDivElement,
  scenePressure: ScenePressure
): void {
  runtime.sampleFrames += 1;
  runtime.sampleFrameTimeSumMs += frameDeltaMs;
  runtime.sampleWorstFrameMs = Math.max(runtime.sampleWorstFrameMs, frameDeltaMs);

  if (frameDeltaMs > LONG_FRAME_MS && now - runtime.lastLongFrameLogAt > LONG_FRAME_LOG_COOLDOWN_MS) {
    runtime.lastLongFrameLogAt = now;
    console.warn("[graph3d] long frame", {
      frameMs: Number(frameDeltaMs.toFixed(2)),
      objectCount: scenePressure.objectCount
    });
  }

  const sampleElapsedMs = now - runtime.sampleWindowStart;
  if (sampleElapsedMs >= PERF_SAMPLE_WINDOW_MS) {
    const fps = (runtime.sampleFrames * 1000) / sampleElapsedMs;
    const avgFrameMs = runtime.sampleFrameTimeSumMs / runtime.sampleFrames;
    perfBadge.textContent = `FPS ${Math.round(fps)} · Avg ${avgFrameMs.toFixed(1)}ms · Vis ${scenePressure.visibleObjectCount}/${scenePressure.objectCount} · Res ${Math.round(scenePressure.surfaceResolutionMax)} · Smp ${Math.round(scenePressure.parametricSamplesMax)}`;
    runtime.sampleWindowStart = now;
    runtime.sampleFrames = 0;
    runtime.sampleFrameTimeSumMs = 0;
    runtime.sampleWorstFrameMs = 0;
  }
}
