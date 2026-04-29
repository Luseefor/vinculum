import type { GraphObject } from "@vinculum/scene/types";
import { MAX_SURFACE_RESOLUTION } from "@vinculum/scene/defaults";
import { MAX_PARAMETRIC_CURVE_SAMPLES } from "@/lib/math/expressionSafety";
import { reportWarning } from "@/lib/monitoring/errorReporting";

export type PerformanceWarningLevel = "ok" | "warning" | "critical";

export interface ScenePressure {
  objectCount: number;
  visibleObjectCount: number;
  surfaceResolutionMax: number;
  parametricSamplesMax: number;
  surfaceResolutionPressure: number; // 0..1
  parametricSamplePressure: number; // 0..1
}

export interface PerformanceMetricsSnapshot {
  fps: number | null;
  averageFrameTimeMs: number | null;
  lastFrameTimeMs: number | null;
  lastPaintTimeMs: number | null;
  scenePressure: ScenePressure;
  warningLevel: PerformanceWarningLevel;
  warningItems: string[];
  warningSummary: string;
}

export interface FrameSampleInput {
  nowMs: number;
  frameTimeMs: number;
  viewport: "3d-viewport" | "2d-viewport";
  scenePressure: ScenePressure;
}

export interface PaintSampleInput {
  nowMs: number;
  paintTimeMs: number;
  viewport: "2d-viewport";
  scenePressure: ScenePressure;
}

export type CriticalPerformanceReporter = (payload: {
  message: string;
  context: Parameters<typeof reportWarning>[1];
}) => void;

const DEFAULT_WINDOW_MS = 1000;
const DEFAULT_WARNING_THROTTLE_MS = 5_000;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function computeScenePressureFromObjects(objects: readonly GraphObject[]): ScenePressure {
  const visibleObjects = objects.filter((o) => o.visible);

  let surfaceResolutionMax = 0;
  let parametricSamplesMax = 0;

  for (const o of visibleObjects) {
    if (o.kind === "surface") {
      surfaceResolutionMax = Math.max(surfaceResolutionMax, o.resolution);
    } else if (o.kind === "parametricCurve") {
      parametricSamplesMax = Math.max(parametricSamplesMax, o.samples);
    }
  }

  const surfaceResolutionPressure = clamp01(surfaceResolutionMax / MAX_SURFACE_RESOLUTION);
  const parametricSamplePressure = clamp01(parametricSamplesMax / MAX_PARAMETRIC_CURVE_SAMPLES);

  return {
    objectCount: objects.length,
    visibleObjectCount: visibleObjects.length,
    surfaceResolutionMax,
    parametricSamplesMax,
    surfaceResolutionPressure,
    parametricSamplePressure
  };
}

export interface HeavySceneWarningEvaluationInput {
  scenePressure: ScenePressure;
  lastFrameTimeMs: number | null;
  averageFrameTimeMs: number | null;
}

export interface HeavySceneWarningEvaluationResult {
  level: PerformanceWarningLevel;
  items: string[];
  summary: string;
}

export function evaluateHeavySceneWarnings(
  input: HeavySceneWarningEvaluationInput
): HeavySceneWarningEvaluationResult {
  const items: string[] = [];

  const { objectCount, visibleObjectCount, surfaceResolutionPressure, parametricSamplePressure } = input.scenePressure;
  const last = input.lastFrameTimeMs ?? 0;
  const avg = input.averageFrameTimeMs ?? input.lastFrameTimeMs ?? 0;

  let level: PerformanceWarningLevel = "ok";

  const consider = (candidateLevel: PerformanceWarningLevel, message: string) => {
    if (candidateLevel === "critical" && level !== "critical") level = "critical";
    if (candidateLevel === "warning" && level === "ok") level = "warning";
    if (candidateLevel !== "ok") items.push(message);
  };

  // Object complexity
  if (objectCount >= 20) {
    consider("critical", "Heavy scene: High object count may reduce performance.");
  } else if (objectCount >= 10) {
    consider("warning", "Heavy scene: High object count may reduce performance.");
  }

  if (visibleObjectCount >= 16) {
    consider("critical", "Too many visible objects may slow rendering.");
  } else if (visibleObjectCount >= 8) {
    consider("warning", "Too many visible objects may slow rendering.");
  }

  // Surface/curve pressure
  if (surfaceResolutionPressure >= 0.92) {
    consider("critical", "Heavy scene: High surface resolution may reduce performance.");
  } else if (surfaceResolutionPressure >= 0.75) {
    consider("warning", "Heavy scene: High surface resolution may reduce performance.");
  }

  if (parametricSamplePressure >= 0.98) {
    consider("critical", "Heavy scene: High curve sampling may reduce performance.");
  } else if (parametricSamplePressure >= 0.5) {
    consider("warning", "Heavy scene: High curve sampling may reduce performance.");
  }

  // Frame timing pressure
  if (last >= 70 || avg >= 50) {
    consider("critical", "Performance is slow. Try reducing resolution or visible objects.");
  } else if (last >= 40 || avg >= 25) {
    consider("warning", "Performance may be slow. Try reducing resolution or visible objects.");
  }

  if (level === "ok") {
    return { level: "ok", items: [], summary: "Light scene" };
  }

  const summary = level === "critical" ? "Heavy scene (critical)" : "Heavy scene (warning)";
  return { level, items, summary };
}

export interface PerformanceTracker {
  recordFrameSample(input: FrameSampleInput): {
    metrics: PerformanceMetricsSnapshot;
    warningUpdate: { shouldUpdateBadge: boolean; warningLevel: PerformanceWarningLevel; warningItems: string[]; warningSummary: string };
  };
  recordPaintSample(input: PaintSampleInput): {
    metrics: PerformanceMetricsSnapshot;
    warningUpdate: { shouldUpdateBadge: boolean; warningLevel: PerformanceWarningLevel; warningItems: string[]; warningSummary: string };
  };
  getLatest(): PerformanceMetricsSnapshot;
}

export function createPerformanceMetricsTracker(options?: {
  windowMs?: number;
  warningThrottleMs?: number;
  reporter?: CriticalPerformanceReporter;
}): PerformanceTracker {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const warningThrottleMs = options?.warningThrottleMs ?? DEFAULT_WARNING_THROTTLE_MS;
  const reporter: CriticalPerformanceReporter =
    options?.reporter ??
    ((payload) => {
      reportWarning(payload.message, payload.context);
    });

  let lastSampleWindowStartMs: number | null = null;
  let sampleFrames = 0;
  let frameTimeSumMs = 0;
  let worstFrameTimeMs = 0;

  let lastFrameTimeMs: number | null = null;
  let lastPaintTimeMs: number | null = null;

  let latestScenePressure: ScenePressure = {
    objectCount: 0,
    visibleObjectCount: 0,
    surfaceResolutionMax: 0,
    parametricSamplesMax: 0,
    surfaceResolutionPressure: 0,
    parametricSamplePressure: 0
  };

  let latest: PerformanceMetricsSnapshot = {
    fps: null,
    averageFrameTimeMs: null,
    lastFrameTimeMs: null,
    lastPaintTimeMs: null,
    scenePressure: latestScenePressure,
    warningLevel: "ok",
    warningItems: [],
    warningSummary: "Light scene"
  };

  let lastEmittedWarningLevel: PerformanceWarningLevel = "ok";
  let lastWarningEmitAtMs: number = 0;

  // Allow immediate reporting on first critical evaluation.
  let lastCriticalReportAtMs: number = -Infinity;
  let lastCriticalSignature: string = "";

  const computeMetricsAndWarnings = (nowMs: number, averageFrameTimeMs: number | null, fps: number | null) => {
    const evaluation = evaluateHeavySceneWarnings({
      scenePressure: latestScenePressure,
      lastFrameTimeMs,
      averageFrameTimeMs
    });

    latest = {
      ...latest,
      fps,
      averageFrameTimeMs,
      lastFrameTimeMs,
      lastPaintTimeMs,
      scenePressure: latestScenePressure,
      warningLevel: evaluation.level,
      warningItems: evaluation.items,
      warningSummary: evaluation.summary
    };

    const shouldUpdateBadge =
      evaluation.level !== lastEmittedWarningLevel ||
      nowMs - lastWarningEmitAtMs > 2_000;

    if (shouldUpdateBadge) {
      lastEmittedWarningLevel = evaluation.level;
      lastWarningEmitAtMs = nowMs;
    }

    // Monitoring: only report critical (and throttle).
    if (evaluation.level === "critical") {
      const signature = evaluation.items.join("|");
      const isThrottled = nowMs - lastCriticalReportAtMs < warningThrottleMs;
      const signatureChanged = signature !== lastCriticalSignature;

      if ((!isThrottled && signatureChanged) || (!isThrottled && !signatureChanged)) {
        lastCriticalReportAtMs = nowMs;
        lastCriticalSignature = signature;

        reporter({
          message: "Heavy scene performance pressure detected.",
          context: {
            featureArea: "editor-shell",
            operation: "performance-heavy-scene",
            details: {
              warningLevel: evaluation.level,
              warningItems: evaluation.items,
              fps,
              averageFrameTimeMs,
              lastFrameTimeMs,
              lastPaintTimeMs,
              ...latestScenePressure
            }
          }
        });
      }
    }

    return {
      metrics: latest,
      warningUpdate: {
        shouldUpdateBadge,
        warningLevel: evaluation.level,
        warningItems: evaluation.items,
        warningSummary: evaluation.summary
      }
    };
  };

  const record = (
    input: FrameSampleInput | PaintSampleInput
  ): { metrics: PerformanceMetricsSnapshot; warningUpdate: { shouldUpdateBadge: boolean; warningLevel: PerformanceWarningLevel; warningItems: string[]; warningSummary: string } } => {
    const nowMs = input.nowMs;
    latestScenePressure = input.scenePressure;

    if ("frameTimeMs" in input) {
      lastFrameTimeMs = input.frameTimeMs;
    } else {
      lastPaintTimeMs = input.paintTimeMs;
      lastFrameTimeMs = input.paintTimeMs; // treat paint as the "frame" duration for warning evaluation
    }

    if (lastSampleWindowStartMs === null) {
      lastSampleWindowStartMs = nowMs;
      sampleFrames = 0;
      frameTimeSumMs = 0;
      worstFrameTimeMs = 0;
    }

    const currentFrameTime = "frameTimeMs" in input ? input.frameTimeMs : input.paintTimeMs;
    sampleFrames += 1;
    frameTimeSumMs += currentFrameTime;
    worstFrameTimeMs = Math.max(worstFrameTimeMs, currentFrameTime);

    const elapsed = nowMs - lastSampleWindowStartMs;
    if (elapsed >= windowMs) {
      const fps = sampleFrames > 0 ? (sampleFrames * 1000) / elapsed : null;
      const avg = sampleFrames > 0 ? frameTimeSumMs / sampleFrames : null;

      // Reset sample window.
      lastSampleWindowStartMs = nowMs;
      sampleFrames = 0;
      frameTimeSumMs = 0;
      worstFrameTimeMs = 0;

      return computeMetricsAndWarnings(nowMs, avg, fps);
    }

    // No sample-window update. Still compute warning level occasionally,
    // but keep it lightweight.
    const shouldUpdateBadge = lastEmittedWarningLevel !== latest.warningLevel;
    return {
      metrics: latest,
      warningUpdate: {
        shouldUpdateBadge: false,
        warningLevel: latest.warningLevel,
        warningItems: latest.warningItems,
        warningSummary: latest.warningSummary
      }
    };
  };

  return {
    recordFrameSample: (input: FrameSampleInput) => record(input),
    recordPaintSample: (input: PaintSampleInput) => record(input),
    getLatest: () => latest
  };
}

let globalTracker = createPerformanceMetricsTracker();

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();

export function resetPerformanceMetricsForTests(): void {
  globalTracker = createPerformanceMetricsTracker();
  subscribers.clear();
}

export function getLatestPerformanceMetrics(): PerformanceMetricsSnapshot {
  return globalTracker.getLatest();
}

export function getLatestPerformanceMetricsSnapshot(): PerformanceMetricsSnapshot {
  return globalTracker.getLatest();
}

export function subscribePerformanceMetrics(listener: Subscriber): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function notifySubscribers(): void {
  for (const listener of subscribers) {
    try {
      listener();
    } catch {
      // No-op: never let UI subscribe errors break rendering.
    }
  }
}

// Module-level wrapper used by runtime paths.
export function recordFrameSample(input: FrameSampleInput): void {
  const next = globalTracker.recordFrameSample(input);
  // Emit at sample-window boundaries only (returned shouldUpdateBadge already accounts for that).
  if (next.warningUpdate.shouldUpdateBadge) {
    notifySubscribers();
  }
}

export function recordPaintSample(input: PaintSampleInput): void {
  const next = globalTracker.recordPaintSample(input);
  if (next.warningUpdate.shouldUpdateBadge) {
    notifySubscribers();
  }
}

export function getLatestPerformanceMetricsSingleton(): PerformanceMetricsSnapshot {
  return globalTracker.getLatest();
}

