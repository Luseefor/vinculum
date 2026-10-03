import { beforeEach, describe, expect, it, vi } from "vitest";
import { Group, InstancedMesh, LineSegments, Raycaster, Vector3, type Object3D } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { updateAnalysisOverlays } from "@/lib/graph3d/buildAnalysisOverlays";
import {
  streamlineOverlayCacheKey,
  updateStreamlineOverlays,
  type StreamlineOverlayFrame
} from "@/lib/graph3d/buildStreamlineOverlays";
import { computeStreamlineData } from "@/lib/math/computeStreamlineData";
import type { StreamlineComputeOkResult } from "@/lib/compute/geometryComputeProtocol";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";

function addRotation3D(): string {
  const store = useGraphStore.getState();
  const id = store.addVectorFieldObject("3d");
  store.updateVectorFieldExpression(id, "pExpr", "-y");
  store.updateVectorFieldExpression(id, "qExpr", "x");
  store.updateVectorFieldExpression(id, "rExpr", "0");
  return id;
}

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function enableStreamlines(id: string) {
  const object = liveObject(id);
  if (object.kind !== "vectorField") {
    throw new Error("expected vector field");
  }
  const identity = vectorCalculusSourceIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (!identity) {
    throw new Error("expected identity");
  }
  useGraphStore.getState().setStreamlineConfig(
    id,
    { dimension: object.dimension, enabled: true },
    identity
  );
}

function seedRotationResult(id: string) {
  const computed = computeStreamlineData({
    dimension: "3d",
    pExpr: "-y",
    qExpr: "x",
    rExpr: "0",
    domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -2, zMax: 2 },
    seedDensity: 2,
    length: "medium",
    quality: "medium",
    params: {}
  });
  if (computed.status !== "ok") {
    throw new Error("expected ok streamlines");
  }
  useStreamlineResultsStore.getState().setResult(`streamline:${id}`, {
    signature: "test-signature",
    result: {
      status: "ok",
      dimension: "3d",
      points: computed.points,
      offsets: computed.offsets,
      closed: computed.closed,
      streamlineCount: computed.streamlineCount,
      totalPoints: computed.totalPoints,
      evaluationCount: computed.evaluationCount
    } satisfies StreamlineComputeOkResult
  });
}

function makeFrame(
  objects: GraphObject[],
  overrides: Partial<StreamlineOverlayFrame> = {}
): { frame: StreamlineOverlayFrame; overlayRoot: Group } {
  const overlayRoot = new Group();
  const frame: StreamlineOverlayFrame = {
    configs: useGraphStore.getState().ui.streamlineVizBySourceId,
    objects,
    objectNodes: new Map<string, Object3D>(objects.map((o) => [o.id, new Group()])),
    results: useStreamlineResultsStore.getState().entries,
    overlayRoot,
    cache: new Map(),
    // Identity uses parameter KEYS: the frame scope must carry the same
    // keys the config was created with.
    params: getEditorParameterScope(),
    ...overrides
  };
  return { frame, overlayRoot };
}

describe("updateStreamlineOverlays (S24 PART 14/15/45)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useStreamlineResultsStore.getState().clearAll();
  });

  it("builds O(1) nodes per source and reuses them", () => {
    const id = addRotation3D();
    enableStreamlines(id);
    seedRotationResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    // One group: 1 LineSegments + ≤1 InstancedMesh, independent of curve count.
    expect(overlayRoot.children).toHaveLength(1);
    const group = frame.cache.get(streamlineOverlayCacheKey(id))!.group;
    expect(group.children.filter((child) => child instanceof LineSegments)).toHaveLength(1);
    expect(group.children.filter((child) => child instanceof InstancedMesh).length).toBeLessThanOrEqual(1);
    updateStreamlineOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.cache.get(streamlineOverlayCacheKey(id))!.group).toBe(group);
  });

  it("places lines through mathToWorld3D and heads along +F", () => {
    const id = addRotation3D();
    enableStreamlines(id);
    seedRotationResult(id);
    const { frame } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    const group = frame.cache.get(streamlineOverlayCacheKey(id))!.group;
    const lines = group.children.find((child) => child instanceof LineSegments) as LineSegments;
    const positions = lines.geometry.getAttribute("position") as { array: ArrayLike<number>; count: number };
    expect(positions.count).toBeGreaterThan(0);
    // World y carries math z (rotation plane z is constant per curve):
    // every vertex has a finite world position from the (x,z,y) mapping.
    for (let i = 0; i < positions.count; i += 1) {
      expect(Number.isFinite(positions.array[i * 3])).toBe(true);
      expect(Number.isFinite(positions.array[i * 3 + 1])).toBe(true);
      expect(Number.isFinite(positions.array[i * 3 + 2])).toBe(true);
    }
    const heads = group.children.find((child) => child instanceof InstancedMesh) as
      | InstancedMesh
      | undefined;
    expect(heads).toBeDefined();
    // Nothing participates in raycasting.
    const raycaster = new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
    expect(raycaster.intersectObject(group, true)).toEqual([]);
  });

  it("maps (1,2,3) to world (1,3,2) with no manual permutation", () => {
    // Direct world-mapping pin through a synthetic two-point curve.
    const id = addRotation3D();
    enableStreamlines(id);
    useStreamlineResultsStore.getState().setResult(`streamline:${id}`, {
      signature: "s",
      result: {
        status: "ok",
        dimension: "3d",
        points: new Float32Array([1, 2, 3, 1.5, 2, 3]),
        offsets: new Uint32Array([0, 2]),
        closed: new Uint8Array([0]),
        streamlineCount: 1,
        totalPoints: 2,
        evaluationCount: 8
      }
    });
    const { frame } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    const group = frame.cache.get(streamlineOverlayCacheKey(id))!.group;
    const lines = group.children.find((child) => child instanceof LineSegments) as LineSegments;
    const positions = lines.geometry.getAttribute("position") as { array: ArrayLike<number> };
    expect([positions.array[0], positions.array[1], positions.array[2]]).toEqual([1, 3, 2]);
  });

  it("renders direction cones for 2D results in 3D views (S24-R1)", () => {
    // 2D points pad z=0: the head-size span must ignore the padded axis,
    // or every 2D overlay would silently lose its cones.
    const store = useGraphStore.getState();
    const id = store.addVectorFieldObject("2d");
    const object = liveObject(id);
    if (object.kind !== "vectorField") {
      throw new Error("expected vector field");
    }
    const identity = vectorCalculusSourceIdentity(
      object,
      useEditorStore.getState().parameters.map((p) => p.id)
    );
    if (!identity) {
      throw new Error("expected identity");
    }
    useGraphStore.getState().setStreamlineConfig(id, { dimension: "2d", enabled: true }, identity);
    useStreamlineResultsStore.getState().setResult(`streamline:${id}`, {
      signature: "s",
      result: {
        status: "ok",
        dimension: "2d",
        points: new Float32Array([0, 0, 2, 0, 4, 0]),
        offsets: new Uint32Array([0, 3]),
        closed: new Uint8Array([0]),
        streamlineCount: 1,
        totalPoints: 3,
        evaluationCount: 12
      }
    });
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    const group = frame.cache.get(streamlineOverlayCacheKey(id))!.group;
    const heads = group.children.find((child) => child instanceof InstancedMesh) as
      | InstancedMesh
      | undefined;
    expect(heads).toBeDefined();
    expect(heads?.count).toBe(1);
  });

  it("hides lines when the source is hidden but keeps config and cache", () => {
    const id = addRotation3D();
    enableStreamlines(id);
    seedRotationResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    frame.objectNodes.get(id)!.visible = false;
    updateStreamlineOverlays(frame);
    expect(frame.cache.get(streamlineOverlayCacheKey(id))!.group.visible).toBe(false);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeDefined();
  });

  it("drops overlays for stale sources without clearing configs (S23-R1 rule)", () => {
    const id = addRotation3D();
    enableStreamlines(id);
    seedRotationResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    const edited = { ...liveObject(id), pExpr: "y" };
    updateStreamlineOverlays({ ...frame, objects: [edited] });
    expect(overlayRoot.children).toHaveLength(0);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeDefined();

    updateStreamlineOverlays({ ...frame, configs: {} });
    expect(frame.cache.size).toBe(0);
  });

  it("coexists with analysis, curl, and slice namespaces (S24 PART 44/45)", () => {
    const id = addRotation3D();
    enableStreamlines(id);
    seedRotationResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateStreamlineOverlays(frame);
    const group = frame.cache.get(streamlineOverlayCacheKey(id))!.group;
    // Foreign namespaces survive the streamline GC.
    frame.cache.set("s-1", { key: "surface-key", group: new Group() });
    frame.cache.set("curl:other", { key: "curl-key", group: new Group() });
    frame.cache.set("scalar-slice:other", { key: "slice-key", group: new Group() });
    updateStreamlineOverlays({ ...frame, results: useStreamlineResultsStore.getState().entries });
    expect(frame.cache.has("s-1")).toBe(true);
    expect(frame.cache.has("curl:other")).toBe(true);
    expect(frame.cache.has("scalar-slice:other")).toBe(true);
    // And the analysis GC (which runs first in the tick) spares streamline keys.
    updateAnalysisOverlays({
      analyses: {},
      objects: [liveObject(id)],
      objectNodes: frame.objectNodes,
      overlayRoot,
      cache: frame.cache,
      theme: "dark",
      params: getEditorParameterScope(),
      tokens: getGraphThemeTokens("dark"),
      computeStatusOf: () => "idle",
      clearAnalysis: vi.fn()
    });
    expect(frame.cache.get(streamlineOverlayCacheKey(id))!.group).toBe(group);
    expect(overlayRoot.children).toContain(group);
  });
});
