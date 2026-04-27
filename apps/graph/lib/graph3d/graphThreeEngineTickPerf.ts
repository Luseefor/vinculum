import {
  LONG_FRAME_LOG_COOLDOWN_MS,
  LONG_FRAME_MS,
  PERF_SAMPLE_WINDOW_MS
} from "./graphThreeEngineConstants";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";

export function applyGraphThreeTickPerfSampling(
  now: number,
  frameDeltaMs: number,
  runtime: GraphThreeEngineTickRuntime,
  perfBadge: HTMLDivElement,
  objectCount: number
): void {
  runtime.sampleFrames += 1;
  runtime.sampleWorstFrameMs = Math.max(runtime.sampleWorstFrameMs, frameDeltaMs);

  if (frameDeltaMs > LONG_FRAME_MS && now - runtime.lastLongFrameLogAt > LONG_FRAME_LOG_COOLDOWN_MS) {
    runtime.lastLongFrameLogAt = now;
    console.warn("[graph3d] long frame", {
      frameMs: Number(frameDeltaMs.toFixed(2)),
      objectCount
    });
  }

  const sampleElapsedMs = now - runtime.sampleWindowStart;
  if (sampleElapsedMs >= PERF_SAMPLE_WINDOW_MS) {
    const fps = (runtime.sampleFrames * 1000) / sampleElapsedMs;
    perfBadge.textContent = `FPS ${Math.round(fps)} · Frame ${runtime.sampleWorstFrameMs.toFixed(1)}ms`;
    runtime.sampleWindowStart = now;
    runtime.sampleFrames = 0;
    runtime.sampleWorstFrameMs = 0;
  }
}
