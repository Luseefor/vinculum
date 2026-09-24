import { beforeEach, describe, expect, it, vi } from "vitest";
import { Group, Raycaster, Vector3, type Object3D } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { updateAnalysisOverlays } from "@/lib/graph3d/buildAnalysisOverlays";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { computeScalarFieldData } from "@/lib/math/computeScalarFieldData";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import {
  scalarSliceCacheKey,
  scalarSliceContourCacheKey,
  slicePlaneFrame,
  updateScalarSliceOverlays,
  type ScalarSliceOverlayFrame
} from "@/lib/graph3d/buildScalarSliceOverlays";
import type { ScalarFieldComputeOkResult } from "@/lib/compute/geometryComputeProtocol";

function addImplicit(equation = "x^2+y^2+z^2-1"): string {
  const store = useGraphStore.getState();
  const id = store.addImplicitSurface();
  store.updateImplicitSurfaceExpression(id, "equation", equation);
  return id;
}

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function identityOf(id: string): string {
  const identity = scalarVizMathIdentity(
    liveObject(id),
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (!identity) {
    throw new Error("expected identity");
  }
  return identity;
}

function enableSlice(id: string, patch: Record<string, unknown> = {}) {
  useGraphStore.getState().setScalarVizConfig(
    id,
    { sliceEnabled: true, slicePlane: "xy", sliceValue: 0, ...patch },
    identityOf(id)
  );
  return useGraphStore.getState().ui.scalarVizBySourceId[id];
}

function seedSliceResult(id: string, planeValue = 0, resolution = 32) {
  const computed = computeScalarFieldData({
    source: { kind: "implicit", equation: "x^2+y^2+z^2-1" },
    target: {
      kind: "slice",
      plane: "xy",
      planeValue,
      domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 }
    },
    resolution,
    contourCount: 8,
    gradientDensity: 0,
    params: {}
  });
  if (computed.status !== "ok") {
    throw new Error("expected ok slice grid");
  }
  useScalarVizResultsStore.getState().setResult(`slice:${id}`, {
    signature: "test-signature",
    result: {
      status: "ok",
      values: computed.values,
      valid: computed.valid,
      width: computed.width,
      height: computed.height,
      domain: computed.domain,
      min: computed.min,
      max: computed.max,
      validCount: computed.validCount,
      totalSamples: computed.totalSamples,
      levels: computed.levels,
      contourSegments: computed.contourSegments,
      contourSegmentCount: computed.contourSegmentCount,
      contourStatus: computed.contourStatus,
      gradientPositions: computed.gradientPositions,
      gradientVectors: computed.gradientVectors,
      gradientMagnitudes: computed.gradientMagnitudes,
      gradientValidCount: computed.gradientValidCount,
      gradientMaxMagnitude: computed.gradientMaxMagnitude,
      gradientStatus: computed.gradientStatus
    } satisfies ScalarFieldComputeOkResult
  });
}

function makeFrame(
  objects: GraphObject[],
  overrides: Partial<ScalarSliceOverlayFrame> = {}
): { frame: ScalarSliceOverlayFrame; overlayRoot: Group } {
  const overlayRoot = new Group();
  const frame: ScalarSliceOverlayFrame = {
    configs: useGraphStore.getState().ui.scalarVizBySourceId,
    objects,
    objectNodes: new Map<string, Object3D>(objects.map((o) => [o.id, new Group()])),
    results: useScalarVizResultsStore.getState().entries,
    overlayRoot,
    cache: new Map(),
    theme: "dark",
    // Identity uses parameter KEYS: the frame scope must carry the same
    // keys the config was created with (S22-R1 lesson).
    params: getEditorParameterScope(),
    ...overrides
  };
  return { frame, overlayRoot };
}

describe("slicePlaneFrame (S23 PART 15)", () => {
  it("maps XY at z=c to world Y=c", () => {
    // Math (x,y,c) -> world (x,c,y): the world up-axis carries the held
    // value, never a swapped coordinate.
    const frame = slicePlaneFrame("xy", 4);
    expect(frame.mathPoint(1, 2)).toEqual({ x: 1, y: 2, z: 4 });
  });

  it("maps XZ at y=c and YZ at x=c without swaps", () => {
    expect(slicePlaneFrame("xz", 5).mathPoint(1, 2)).toEqual({ x: 1, y: 5, z: 2 });
    expect(slicePlaneFrame("yz", 6).mathPoint(1, 2)).toEqual({ x: 6, y: 1, z: 2 });
  });
});

describe("updateScalarSliceOverlays lifecycle (S23 PART 28/30/31)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("builds one mesh plus one contour lineset and reuses them", () => {
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(frame);
    expect(overlayRoot.children).toHaveLength(2);
    expect(frame.cache.has(scalarSliceCacheKey(id))).toBe(true);
    expect(frame.cache.has(scalarSliceContourCacheKey(id))).toBe(true);
    const mesh = frame.cache.get(scalarSliceCacheKey(id))!.group;
    updateScalarSliceOverlays(frame);
    expect(overlayRoot.children).toHaveLength(2);
    expect(frame.cache.get(scalarSliceCacheKey(id))!.group).toBe(mesh);
  });

  it("lays the XY slice flat at world height c with correct vertex colors", () => {
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(frame);
    const group = frame.cache.get(scalarSliceCacheKey(id))!.group;
    const mesh = group.children[0] as import("three").Mesh;
    const positions = mesh.geometry.getAttribute("position") as { array: ArrayLike<number>; count: number };
    // Every vertex sits at world y = 0 (math z = 0 plane).
    for (let i = 0; i < positions.count; i += 1) {
      expect(positions.array[i * 3 + 1]).toBeCloseTo(0, 10);
    }
    // Nothing participates in raycasting.
    const raycaster = new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
    expect(raycaster.intersectObject(group, true)).toEqual([]);
  });

  it("hides the slice when the source is hidden but keeps config and cache", () => {
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(frame);
    expect(overlayRoot.children).toHaveLength(2);
    const node = frame.objectNodes.get(id)!;
    node.visible = false;
    updateScalarSliceOverlays(frame);
    expect(frame.cache.get(scalarSliceCacheKey(id))!.group.visible).toBe(false);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeDefined();
  });

  it("drops overlays for stale sources without touching configs (S23-R1)", () => {
    // Config lifecycle belongs to store actions + the syncScalarViz
    // backstop — never to this overlay path (it also serves dual-purpose
    // surface configs, which must survive the 3D tick untouched).
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(frame);
    expect(overlayRoot.children).toHaveLength(2);
    const edited = { ...liveObject(id), equation: "x^2+y^2+z^2-4" };
    updateScalarSliceOverlays({ ...frame, objects: [edited] });
    expect(overlayRoot.children).toHaveLength(0);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeDefined();

    updateScalarSliceOverlays({ ...frame, configs: {} });
    expect(frame.cache.size).toBe(0);
  });

  it("ignores non-implicit sources and disabled slices", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.setScalarVizConfig(surfaceId, { sliceEnabled: true }, "stale");
    const { frame, overlayRoot } = makeFrame([liveObject(surfaceId)]);
    updateScalarSliceOverlays(frame);
    expect(overlayRoot.children).toHaveLength(0);
    // S23-R1: the surface 2D half is untouched by the slice path.
    expect(useGraphStore.getState().ui.scalarVizBySourceId[surfaceId]).toBeDefined();

    const id = addImplicit();
    const { frame: idle } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(idle);
    expect(idle.overlayRoot.children).toHaveLength(0);
  });

  it("shares the overlay cache namespace without disturbing analysis overlays", () => {
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    frame.cache.set("s-1", { key: "surface-key", group: new Group() });
    overlayRoot.add(frame.cache.get("s-1")!.group);
    updateScalarSliceOverlays(frame);
    expect(frame.cache.has("s-1")).toBe(true);
    expect(frame.cache.has(scalarSliceCacheKey(id))).toBe(true);
  });

  it("survives the analysis overlay pass on a shared cache (S23-R1)", () => {
    // Tick order runs the analysis GC before the slice sync on the same
    // map: neither may claim the other's namespace, or slice meshes
    // would rebuild (new geometry + texture upload) every frame.
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame, overlayRoot } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(frame);
    const meshGroup = frame.cache.get(scalarSliceCacheKey(id))!.group;
    const contourGroup = frame.cache.get(scalarSliceContourCacheKey(id))!.group;
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
    expect(frame.cache.get(scalarSliceCacheKey(id))!.group).toBe(meshGroup);
    expect(frame.cache.get(scalarSliceContourCacheKey(id))!.group).toBe(contourGroup);
    expect(overlayRoot.children).toContain(meshGroup);
    // And back the other way: the slice pass keeps analysis entries.
    frame.cache.set("s-9", { key: "surface-key", group: new Group() });
    updateScalarSliceOverlays({ ...frame, results: useScalarVizResultsStore.getState().entries });
    expect(frame.cache.has("s-9")).toBe(true);
  });

  it("disposes the slice DataTexture on rebuild (S23-R1)", () => {
    const id = addImplicit();
    enableSlice(id);
    seedSliceResult(id);
    const { frame } = makeFrame([liveObject(id)]);
    updateScalarSliceOverlays(frame);
    const mesh = frame.cache.get(scalarSliceCacheKey(id))!.group.children[0] as import("three").Mesh;
    const material = mesh.material as import("three").MeshBasicMaterial;
    const texture = material.map;
    expect(texture).not.toBeNull();
    const disposeSpy = vi.spyOn(texture!, "dispose");
    useScalarVizResultsStore.getState().setResult(`slice:${id}`, {
      ...(useScalarVizResultsStore.getState().entries[`slice:${id}`] as {
        signature: string;
        result: ScalarFieldComputeOkResult;
      }),
      signature: "changed-signature"
    });
    updateScalarSliceOverlays({
      ...frame,
      results: useScalarVizResultsStore.getState().entries
    });
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it("shifts the quaternion-free contour mapping onto the held plane", () => {
    // Asymmetric slice: plane XZ at y=5 over F=x+2y+3z — contour points
    // must carry world z from math y=5 (PART 15 pin through rendering).
    const id = addImplicit("x + 2*y + 3*z");
    enableSlice(id, { slicePlane: "xz", sliceValue: 5 });
    const computed = computeScalarFieldData({
      source: { kind: "implicit", equation: "x + 2*y + 3*z" },
      target: {
        kind: "slice",
        plane: "xz",
        planeValue: 5,
        domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 }
      },
      resolution: 32,
      contourCount: 4,
      gradientDensity: 0,
      params: {}
    });
    if (computed.status !== "ok") {
      throw new Error("expected ok slice grid");
    }
    useScalarVizResultsStore.getState().setResult(`slice:${id}`, {
      signature: "s",
      result: {
        status: "ok",
        values: computed.values,
        valid: computed.valid,
        width: computed.width,
        height: computed.height,
        domain: computed.domain,
        min: computed.min,
        max: computed.max,
        validCount: computed.validCount,
        totalSamples: computed.totalSamples,
        levels: computed.levels,
        contourSegments: computed.contourSegments,
        contourSegmentCount: computed.contourSegmentCount,
        contourStatus: computed.contourStatus,
        gradientPositions: computed.gradientPositions,
        gradientVectors: computed.gradientVectors,
        gradientMagnitudes: computed.gradientMagnitudes,
        gradientValidCount: computed.gradientValidCount,
        gradientMaxMagnitude: computed.gradientMaxMagnitude,
        gradientStatus: computed.gradientStatus
      } satisfies ScalarFieldComputeOkResult
    });
    const frame = makeFrame([liveObject(id)], {
      configs: useGraphStore.getState().ui.scalarVizBySourceId
    }).frame;
    updateScalarSliceOverlays(frame);
    const contours = frame.cache.get(scalarSliceContourCacheKey(id))?.group;
    expect(contours).toBeDefined();
    const lines = contours?.children[0] as import("three").LineSegments;
    const positions = lines.geometry.getAttribute("position") as { array: ArrayLike<number>; count: number };
    // World z carries math y=5 for every contour vertex.
    for (let i = 0; i < positions.count; i += 1) {
      expect(positions.array[i * 3 + 2]).toBeCloseTo(5, 8);
    }
  });
});
