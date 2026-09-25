import { beforeEach, describe, expect, it } from "vitest";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import type { AxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasTypes";
import { drawStreamlines2D } from "@/components/graph/graph2d/graph2dCanvasStreamlines";
import { computeStreamlineData } from "@/lib/math/computeStreamlineData";
import type { StreamlineComputeOkResult } from "@/lib/compute/geometryComputeProtocol";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";

const XY: AxisPairSpec = { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" };
const XZ: AxisPairSpec = { horizontal: "x", vertical: "z", horizontalLabel: "X", verticalLabel: "Z" };

function addRotation2D(): string {
  const store = useGraphStore.getState();
  const id = store.addVectorFieldObject("2d");
  store.updateVectorFieldExpression(id, "pExpr", "-y");
  store.updateVectorFieldExpression(id, "qExpr", "x");
  return id;
}

function enableStreamlines(id: string) {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  const identity = vectorCalculusSourceIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (!identity) {
    throw new Error("expected identity");
  }
  useGraphStore.getState().setStreamlineConfig(id, { dimension: "2d", enabled: true }, identity);
}

function rotationResult(): StreamlineComputeOkResult {
  const computed = computeStreamlineData({
    dimension: "2d",
    pExpr: "-y",
    qExpr: "x",
    rExpr: "",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    seedDensity: 4,
    length: "medium",
    quality: "medium",
    params: {}
  });
  if (computed.status !== "ok") {
    throw new Error("expected ok streamlines");
  }
  return {
    status: "ok",
    dimension: "2d",
    points: computed.points,
    offsets: computed.offsets,
    closed: computed.closed,
    streamlineCount: computed.streamlineCount,
    totalPoints: computed.totalPoints,
    evaluationCount: computed.evaluationCount
  };
}

function mockContext() {
  const calls: { name: string; args: unknown[] }[] = [];
  const handler: ProxyHandler<object> = {
    get: (_target, property) => (...args: unknown[]) => {
      calls.push({ name: String(property), args });
    },
    set: () => true
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls };
}

describe("streamline attach gate (S24)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("attaches refs only for enabled live 2D configs", () => {
    const id = addRotation2D();
    const params = getEditorParameterScope();
    expect(
      buildRenderableGraphsFromScene(useGraphStore.getState().scene.objects, XY, params).some(
        (g) => g.streamlines
      )
    ).toBe(false);
    enableStreamlines(id);
    const attached = buildRenderableGraphsFromScene(
      useGraphStore.getState().scene.objects,
      XY,
      params,
      {},
      useGraphStore.getState().ui.streamlineVizBySourceId
    );
    expect(attached.filter((g) => g.streamlines)).toHaveLength(1);
    expect(attached.find((g) => g.streamlines)?.streamlines?.sourceId).toBe(id);
  });

  it("drops stale configs at attach time", () => {
    const id = addRotation2D();
    enableStreamlines(id);
    useGraphStore.getState().updateVectorFieldExpression(id, "pExpr", "y");
    const graphs = buildRenderableGraphsFromScene(
      useGraphStore.getState().scene.objects,
      XY,
      getEditorParameterScope(),
      {},
      useGraphStore.getState().ui.streamlineVizBySourceId
    );
    expect(graphs.some((g) => g.streamlines)).toBe(false);
  });
});

describe("drawStreamlines2D batches (S24 PART 13)", () => {
  it("strokes one connected path per curve plus midpoint heads", () => {
    const result = rotationResult();
    const { ctx, calls } = mockContext();
    const dc = { ctx, width: 800, height: 600, centerX: 0, centerY: 0, scale: 60 };
    // Screen scale ×60: midpoint shafts span tens of pixels, so every
    // curve earns a head (identity transforms would skip sub-pixel ones).
    drawStreamlines2D(result, "#3b82f6", XY, dc, (x, y) => ({ x: x * 60 + 400, y: -y * 60 + 300 }));
    const strokes = calls.filter((call) => call.name === "stroke");
    // One stroke per curve plus one head batch.
    expect(strokes).toHaveLength(result.streamlineCount + 1);
    const moveTos = calls.filter((call) => call.name === "moveTo");
    // One moveTo per curve start plus two per head (barbs share the tip).
    expect(moveTos.length).toBeGreaterThanOrEqual(result.streamlineCount);
    const saveCount = calls.filter((call) => call.name === "save").length;
    const restoreCount = calls.filter((call) => call.name === "restore").length;
    expect(saveCount).toBe(restoreCount);
  });

  it("draws nothing for empty results", () => {
    const { ctx, calls } = mockContext();
    drawStreamlines2D(
      {
        status: "ok",
        dimension: "2d",
        points: new Float32Array(0),
        offsets: new Uint32Array([0]),
        closed: new Uint8Array(0),
        streamlineCount: 0,
        totalPoints: 0,
        evaluationCount: 0
      },
      "#3b82f6",
      XY,
      { ctx, width: 100, height: 100, centerX: 0, centerY: 0, scale: 10 },
      (x, y) => ({ x, y })
    );
    expect(calls.filter((call) => call.name === "stroke")).toHaveLength(0);
  });

  it("projects points through the axis pair (PART 42)", () => {
    // A point at math (2, 3) lands at horizontal=2, vertical=3 under xy
    // and horizontal=2, vertical=0 under xz (z=0 plane semantics).
    const seen: { x: number; y: number }[] = [];
    const result = rotationResult();
    const { ctx } = mockContext();
    const dc = { ctx, width: 800, height: 600, centerX: 0, centerY: 0, scale: 60 };
    drawStreamlines2D(result, "#3b82f6", XZ, dc, (x, y) => {
      seen.push({ x, y });
      return { x, y };
    });
    // Every projected vertical coordinate is the z=0 plane (identity
    // transform here exposes raw pair values).
    for (const point of seen) {
      expect(point.y).toBe(0);
    }
    expect(seen.length).toBeGreaterThan(0);
  });
});
