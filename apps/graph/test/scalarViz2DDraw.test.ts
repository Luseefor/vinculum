import { beforeEach, describe, expect, it } from "vitest";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import type { AxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasTypes";
import {
  buildScalarGradientArrows,
  clearScalarBitmapCacheForTests,
  drawScalarContours,
  drawScalarHeatLayer,
  scalarBitmapCacheSizeForTests,
  scalarHeatBitmap
} from "@/components/graph/graph2d/graph2dCanvasScalarViz";
import { computeScalarFieldData } from "@/lib/math/computeScalarFieldData";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";

const XY: AxisPairSpec = { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" };
const XZ: AxisPairSpec = { horizontal: "x", vertical: "z", horizontalLabel: "X", verticalLabel: "Z" };

function addSurface(equation = "z = x^2 + y^2"): string {
  const store = useGraphStore.getState();
  const id = store.addSurfaceObject();
  store.updateSurfaceEquation(id, equation);
  return id;
}

function enableViz(id: string, patch: Record<string, unknown> = { showHeatmap: true }) {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  const identity = scalarVizMathIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (!identity) {
    throw new Error("expected identity");
  }
  useGraphStore.getState().setScalarVizConfig(id, patch, identity);
}

function mockContext() {
  const calls: { name: string; args: unknown[] }[] = [];
  const handler: ProxyHandler<object> = {
    get: (_target, property) => {
      if (property === "canvas") {
        return undefined;
      }
      return (...args: unknown[]) => {
        calls.push({ name: String(property), args });
      };
    },
    set: () => true
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls };
}

function okResult() {
  const computed = computeScalarFieldData({
    source: { kind: "surface", equation: "z = x^2 + y^2", orientation: "z" },
    target: { kind: "domain2D", domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 } },
    resolution: 32,
    contourCount: 8,
    gradientDensity: 8,
    params: {}
  });
  if (computed.status !== "ok") {
    throw new Error("expected ok grid");
  }
  return computed;
}

describe("scalar attach gate (S23)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("attaches scalar refs only for enabled, live, pair-matched sources", () => {
    const id = addSurface();
    const objects = useGraphStore.getState().scene.objects;
    const params = getEditorParameterScope();
    // Disabled: no attachment (existing behavior preserved).
    expect(
      buildRenderableGraphsFromScene(objects, XY, params).some((g) => g.scalarField)
    ).toBe(false);
    enableViz(id);
    const attached = buildRenderableGraphsFromScene(
      useGraphStore.getState().scene.objects,
      XY,
      params,
      useGraphStore.getState().ui.scalarVizBySourceId
    );
    const scalarGraphs = attached.filter((g) => g.scalarField);
    expect(scalarGraphs).toHaveLength(1);
    expect(scalarGraphs[0]?.scalarField?.sourceId).toBe(id);
    // Wrong pair (xz for a z-source): hidden, never reinterpreted.
    const mismatched = buildRenderableGraphsFromScene(
      useGraphStore.getState().scene.objects,
      XZ,
      params,
      useGraphStore.getState().ui.scalarVizBySourceId
    );
    expect(mismatched.some((g) => g.scalarField)).toBe(false);
  });

  it("drops stale configs at attach time", () => {
    const id = addSurface();
    enableViz(id);
    useGraphStore.getState().updateSurfaceEquation(id, "z = x^2 - y^2");
    // Equation edits prune the config, so nothing attaches.
    const graphs = buildRenderableGraphsFromScene(
      useGraphStore.getState().scene.objects,
      XY,
      getEditorParameterScope(),
      useGraphStore.getState().ui.scalarVizBySourceId
    );
    expect(graphs.some((g) => g.scalarField)).toBe(false);
  });
});

describe("scalar heat bitmaps (S23 PART 22)", () => {
  beforeEach(() => {
    clearScalarBitmapCacheForTests();
  });

  it("degrades gracefully without a 2D context (jsdom)", () => {
    // jsdom canvases have no 2D context: the builder returns null instead
    // of throwing, and the layer draws nothing.
    expect(scalarHeatBitmap("s", "sig", "dark", okResult())).toBeNull();
    const { ctx, calls } = mockContext();
    drawScalarHeatLayer(
      [
        {
          attachment: { sourceId: "s", domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 } },
          signature: "sig",
          result: okResult()
        }
      ],
      "dark",
      { ctx, width: 800, height: 600, centerX: 0, centerY: 0, scale: 60 },
      (x, y) => ({ x: x * 60 + 400, y: -y * 60 + 300 })
    );
    expect(calls.some((call) => call.name === "drawImage")).toBe(false);
    expect(scalarBitmapCacheSizeForTests()).toBe(0);
  });
});

describe("scalar contour batches (S23 PART 27)", () => {
  it("strokes every segment exactly once per pass with save/restore balance", () => {
    const result = okResult();
    const { ctx, calls } = mockContext();
    const dc = { ctx, width: 800, height: 600, centerX: 0, centerY: 0, scale: 60 };
    drawScalarContours(
      result.contourSegments,
      result.contourSegmentCount,
      dc,
      (x, y) => ({ x, y }),
      "dark"
    );
    const strokes = calls.filter((call) => call.name === "stroke");
    // Underlay + ink passes.
    expect(strokes).toHaveLength(2);
    const moveTos = calls.filter((call) => call.name === "moveTo");
    // One moveTo per segment per pass.
    expect(moveTos).toHaveLength(result.contourSegmentCount * 2);
    // Balanced save/restore around the clipped batch.
    expect(calls.filter((call) => call.name === "save")).toHaveLength(
      calls.filter((call) => call.name === "restore").length
    );
  });

  it("draws nothing for empty contour sets", () => {
    const { ctx, calls } = mockContext();
    drawScalarContours(
      new Float32Array(0),
      0,
      { ctx, width: 100, height: 100, centerX: 0, centerY: 0, scale: 10 },
      (x, y) => ({ x, y }),
      "light"
    );
    expect(calls).toHaveLength(0);
  });
});

describe("scalar gradient arrows (S23 PART 14/29)", () => {
  it("maps worker gradients to S20 arrow structs without projection", () => {
    const result = okResult();
    const arrows = buildScalarGradientArrows(
      result,
      { uMin: -5, uMax: 5, vMin: -5, vMax: 5 },
      8,
      1,
      false
    );
    expect(arrows).not.toBeNull();
    expect(arrows?.count).toBe(result.gradientValidCount);
    expect(arrows?.maxMagnitude).toBeCloseTo(result.gradientMaxMagnitude, 10);
    // Bases carry grid (u, v) directly; directions are unit length.
    for (let i = 0; i < (arrows?.count ?? 0); i += 1) {
      const baseX = arrows?.bases[i * 2] as number;
      const baseY = arrows?.bases[i * 2 + 1] as number;
      const dirX = arrows?.directions[i * 2] as number;
      const dirY = arrows?.directions[i * 2 + 1] as number;
      expect(baseX).toBeCloseTo(result.gradientPositions[i * 3] as number, 12);
      expect(baseY).toBeCloseTo(result.gradientPositions[i * 3 + 1] as number, 12);
      const length = Math.sqrt(dirX * dirX + dirY * dirY);
      expect(length).toBeCloseTo(1, 12);
      // f=x^2+y^2 gradient points radially outward: direction parallel to
      // the base position (away from origin).
      const cross = baseX * dirY - baseY * dirX;
      const dot = baseX * dirX + baseY * dirY;
      if (Math.hypot(baseX, baseY) > 1e-9) {
        expect(Math.abs(cross) / Math.hypot(baseX, baseY)).toBeLessThan(1e-9);
        expect(dot).toBeGreaterThan(0);
      }
    }
  });

  it("returns null for unavailable gradients", () => {
    const result = okResult();
    expect(
      buildScalarGradientArrows(
        { ...result, gradientStatus: "unavailable", gradientValidCount: 0 },
        { uMin: -5, uMax: 5, vMin: -5, vMax: 5 },
        8,
        1,
        false
      )
    ).toBeNull();
  });
});
