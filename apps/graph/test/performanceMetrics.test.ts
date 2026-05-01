import { describe, expect, it, vi } from "vitest";
import {
  computeScenePressureFromObjects,
  createPerformanceMetricsTracker,
  evaluateHeavySceneWarnings
} from "@/lib/performance/performanceMetrics";
import type { GraphObject } from "@vinculum/scene/types";

describe("performanceMetrics", () => {
  it("computeScenePressureFromObjects does not mutate inputs", () => {
    const surface: GraphObject = Object.freeze({
      id: "s1",
      kind: "surface",
      color: "#fff",
      visible: true,
      equation: "x + y",
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
      resolution: 80,
      appearance: { wireframe: false },
      orientation: "z"
    });

    const curve: GraphObject = Object.freeze({
      id: "c1",
      kind: "parametricCurve",
      color: "#fff",
      visible: true,
      xExpr: "cos(t)",
      yExpr: "sin(t)",
      zExpr: "t",
      tMin: 0,
      tMax: 1,
      samples: 2200
    });

    const objects = Object.freeze([surface, curve]);
    const pressure = computeScenePressureFromObjects(objects);
    expect(pressure.objectCount).toBe(2);
    expect(pressure.visibleObjectCount).toBe(2);
    expect(pressure.surfaceResolutionMax).toBe(80);
    expect(pressure.parametricSamplesMax).toBe(2200);
  });

  it("evaluateHeavySceneWarnings escalates object-count to critical", () => {
    const result = evaluateHeavySceneWarnings({
      scenePressure: {
        objectCount: 20,
        visibleObjectCount: 0,
        surfaceResolutionMax: 0,
        parametricSamplesMax: 0,
        surfaceResolutionPressure: 0,
        parametricSamplePressure: 0
      },
      lastFrameTimeMs: 10,
      averageFrameTimeMs: 10
    });

    expect(result.level).toBe("critical");
    expect(result.items.join(" ")).toMatch(/object count/i);
  });

  it("evaluateHeavySceneWarnings uses surface resolution pressure", () => {
    const result = evaluateHeavySceneWarnings({
      scenePressure: {
        objectCount: 0,
        visibleObjectCount: 0,
        surfaceResolutionMax: 0,
        parametricSamplesMax: 0,
        surfaceResolutionPressure: 0.8,
        parametricSamplePressure: 0
      },
      lastFrameTimeMs: 10,
      averageFrameTimeMs: 10
    });

    expect(result.level).toBe("warning");
    expect(result.items.join(" ")).toMatch(/surface resolution/i);
  });

  it("evaluateHeavySceneWarnings uses parametric sample pressure", () => {
    const result = evaluateHeavySceneWarnings({
      scenePressure: {
        objectCount: 0,
        visibleObjectCount: 0,
        surfaceResolutionMax: 0,
        parametricSamplesMax: 0,
        surfaceResolutionPressure: 0,
        parametricSamplePressure: 0.99
      },
      lastFrameTimeMs: 10,
      averageFrameTimeMs: 10
    });

    expect(result.level).toBe("critical");
    expect(result.items.join(" ")).toMatch(/curve sampling/i);
  });

  it("evaluateHeavySceneWarnings uses slow frame time", () => {
    const result = evaluateHeavySceneWarnings({
      scenePressure: {
        objectCount: 0,
        visibleObjectCount: 0,
        surfaceResolutionMax: 0,
        parametricSamplesMax: 0,
        surfaceResolutionPressure: 0,
        parametricSamplePressure: 0
      },
      lastFrameTimeMs: 80,
      averageFrameTimeMs: 10
    });

    expect(result.level).toBe("critical");
    expect(result.items.join(" ")).toMatch(/performance is slow/i);
  });

  it("createPerformanceMetricsTracker computes fps and average frame time", () => {
    const reporter = vi.fn();
    const tracker = createPerformanceMetricsTracker({
      windowMs: 1000,
      warningThrottleMs: 10_000,
      reporter
    });

    const scenePressure = {
      objectCount: 1,
      visibleObjectCount: 1,
      surfaceResolutionMax: 0,
      parametricSamplesMax: 0,
      surfaceResolutionPressure: 0,
      parametricSamplePressure: 0
    };

    // 11 frames across 1000ms (0..1000 inclusive): fps = 11.
    // Use a frame time that should not be `critical` (>=70ms / avg>=50ms).
    const frameTimeMs = 40;
    let lastMetrics: ReturnType<typeof tracker.recordFrameSample> | null = null;
    for (let i = 0; i <= 10; i++) {
      lastMetrics = tracker.recordFrameSample({
        nowMs: i * 100,
        frameTimeMs,
        viewport: "3d-viewport",
        scenePressure
      });
    }

    expect(lastMetrics).not.toBeNull();
    const metrics = lastMetrics!.metrics;
    expect(metrics.averageFrameTimeMs).toBeCloseTo(frameTimeMs, 6);
    expect(metrics.fps).toBeCloseTo(11, 6);
    expect(reporter).not.toHaveBeenCalled();
  });

  it("critical monitoring reporting is throttled", () => {
    const reporter = vi.fn();
    const tracker = createPerformanceMetricsTracker({
      windowMs: 100,
      warningThrottleMs: 5_000,
      reporter
    });

    const criticalPressure = {
      objectCount: 20,
      visibleObjectCount: 0,
      surfaceResolutionMax: 0,
      parametricSamplesMax: 0,
      surfaceResolutionPressure: 0,
      parametricSamplePressure: 0
    };

    // First evaluation window boundary at nowMs=100
    tracker.recordFrameSample({
      nowMs: 0,
      frameTimeMs: 10,
      viewport: "3d-viewport",
      scenePressure: criticalPressure
    });
    tracker.recordFrameSample({
      nowMs: 100,
      frameTimeMs: 10,
      viewport: "3d-viewport",
      scenePressure: criticalPressure
    });

    // Second window boundary at nowMs=200 (should be throttled)
    tracker.recordFrameSample({
      nowMs: 200,
      frameTimeMs: 10,
      viewport: "3d-viewport",
      scenePressure: criticalPressure
    });

    expect(reporter).toHaveBeenCalledTimes(1);
  });
});

