import { beforeEach, describe, expect, it } from "vitest";
import { Group, Raycaster, Vector3, type LineSegments, type Mesh, type Object3D } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { computeScalarFieldData } from "@/lib/math/computeScalarFieldData";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import type { ScalarSliceOverlayFrame } from "@/lib/graph3d/buildScalarSliceOverlays";
import {
  explicitSurfaceMathPoint,
  scalarSurfaceCacheKey,
  scalarSurfaceContourCacheKey,
  scalarSurfaceGradientCacheKey,
  updateScalarSurfaceOverlays
} from "@/lib/graph3d/buildScalarSurfaceOverlays";
import { updateAnalysisOverlays } from "@/lib/graph3d/buildAnalysisOverlays";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ScalarFieldComputeOkResult } from "@/lib/compute/geometryComputeProtocol";

const EQUATION = "z = x^2 + y^2";

function addSurface(): string {
  const store = useGraphStore.getState();
  const id = store.addSurfaceObject();
  store.updateSurfaceEquation(id, EQUATION);
  return id;
}

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function enable(id: string, patch: Record<string, unknown>) {
  const identity = scalarVizMathIdentity(
    liveObject(id),
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (!identity) {
    throw new Error("expected identity");
  }
  useGraphStore.getState().setScalarVizConfig(id, patch, identity);
}

function seedResult(id: string, gradientDensity = 0) {
  const source = liveObject(id);
  if (source.kind !== "surface") throw new Error("expected surface");
  const computed = computeScalarFieldData({
    source: { kind: "surface", equation: source.equation, orientation: source.orientation ?? "z" },
    target: { kind: "domain2D", domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 } },
    resolution: 24,
    contourCount: 4,
    gradientDensity,
    params: {}
  });
  if (computed.status !== "ok") {
    throw new Error("expected ok grid");
  }
  const { status: _status, ...rest } = computed;
  useScalarVizResultsStore.getState().setResult(`scalar:${id}`, {
    signature: "sig",
    result: { status: "ok", ...rest } as ScalarFieldComputeOkResult
  });
}

function makeFrame(objects: GraphObject[]): ScalarSliceOverlayFrame {
  return {
    configs: useGraphStore.getState().ui.scalarVizBySourceId,
    objects,
    objectNodes: new Map<string, Object3D>(objects.map((o) => [o.id, new Group()])),
    results: useScalarVizResultsStore.getState().entries,
    overlayRoot: new Group(),
    cache: new Map(),
    theme: "light",
    params: getEditorParameterScope()
  };
}

describe("explicit surface 3D heat map and contours", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("maps (u, v, f) through the surface orientation", () => {
    expect(explicitSurfaceMathPoint("z", 1, 2, 3)).toEqual({ x: 1, y: 2, z: 3 });
    expect(explicitSurfaceMathPoint("x", 1, 2, 3)).toEqual({ x: 3, y: 1, z: 2 });
    expect(explicitSurfaceMathPoint("y", 1, 2, 3)).toEqual({ x: 1, y: 3, z: 2 });
  });

  it.each(["x", "y", "z"] as const)("anchors %s-oriented gradient arrows on the surface without turning them into normals", orientation => {
    const id = addSurface();
    useGraphStore.getState().updateSurfaceOrientation(id, orientation);
    const vars = orientation === "x" ? ["y", "z"] : orientation === "y" ? ["x", "z"] : ["x", "y"];
    useGraphStore.getState().updateSurfaceEquation(id, `${orientation} = ${vars[0]}^2 + ${vars[1]}^2`);
    enable(id, { showGradient: true, gradientDensity: 4 });
    seedResult(id, 4);
    const frame = makeFrame([liveObject(id)]);
    updateScalarSurfaceOverlays(frame);
    const key = scalarSurfaceGradientCacheKey(id);
    const group = frame.cache.get(key)!.group;
    const samples = group.userData.vectorFieldSamples;
    expect(samples.validCount).toBe(16);
    const dependent = orientation === "x" ? 0 : orientation === "y" ? 1 : 2;
    for (let i = 0; i < samples.validCount; i++) {
      const point = Array.from(samples.positions.slice(i * 3, i * 3 + 3)) as number[];
      const independent = point.filter((_, axis) => axis !== dependent);
      expect(point[dependent]).toBeCloseTo(independent[0]! ** 2 + independent[1]! ** 2, 1);
      expect(samples.vectors[i * 3 + dependent]).toBe(0);
      const vector = Array.from(samples.vectors.slice(i * 3, i * 3 + 3)).filter((_, axis) => axis !== dependent) as number[];
      expect(vector[0]).toBeCloseTo(2 * independent[0]!, 4);
      expect(vector[1]).toBeCloseTo(2 * independent[1]!, 4);
    }
    expect(new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0)).intersectObject(group, true)).toEqual([]);
    updateScalarSurfaceOverlays(frame);
    expect(frame.cache.get(key)!.group).toBe(group);
    frame.objectNodes.get(id)!.visible = false;
    updateScalarSurfaceOverlays(frame);
    expect(group.visible).toBe(false);
    enable(id, { showGradient: false });
    updateScalarSurfaceOverlays({ ...frame, configs: useGraphStore.getState().ui.scalarVizBySourceId });
    expect(frame.cache.has(key)).toBe(false);
  });

  it("drapes the heat mesh on z = f(x, y) and reuses it across frames", () => {
    const id = addSurface();
    enable(id, { showHeatmap: true });
    seedResult(id);
    const frame = makeFrame([liveObject(id)]);
    updateScalarSurfaceOverlays(frame);
    const group = frame.cache.get(scalarSurfaceCacheKey(id))!.group;
    expect(frame.overlayRoot.children).toEqual([group]);
    const mesh = group.children[0] as Mesh;
    const positions = mesh.geometry.getAttribute("position");
    // World y is math z: every vertex sits on x^2 + z_world^2.
    for (let i = 0; i < positions.count; i += 37) {
      const x = positions.getX(i);
      const worldZ = positions.getZ(i);
      expect(positions.getY(i)).toBeCloseTo(x * x + worldZ * worldZ, 4);
    }
    const raycaster = new Raycaster(new Vector3(0, 10, 0), new Vector3(0, -1, 0));
    expect(raycaster.intersectObject(group, true)).toEqual([]);

    updateScalarSurfaceOverlays(frame);
    expect(frame.cache.get(scalarSurfaceCacheKey(id))!.group).toBe(group);
  });

  it("lifts contour segments onto their level height", () => {
    const id = addSurface();
    enable(id, { showContours: true, contourCount: 4 });
    seedResult(id);
    const frame = makeFrame([liveObject(id)]);
    updateScalarSurfaceOverlays(frame);
    expect(frame.cache.has(scalarSurfaceCacheKey(id))).toBe(false);
    const lines = frame.cache.get(scalarSurfaceContourCacheKey(id))!.group.children[0] as LineSegments;
    const positions = lines.geometry.getAttribute("position");
    expect(positions.count).toBeGreaterThan(0);
    for (let i = 0; i < positions.count; i += 11) {
      const x = positions.getX(i);
      const worldZ = positions.getZ(i);
      expect(Math.abs(positions.getY(i) - (x * x + worldZ * worldZ))).toBeLessThan(0.15);
    }
  });

  it("hides with the source, drops on toggle-off, and survives the analysis pass", () => {
    const id = addSurface();
    enable(id, { showHeatmap: true });
    seedResult(id);
    const frame = makeFrame([liveObject(id)]);
    updateScalarSurfaceOverlays(frame);
    frame.objectNodes.get(id)!.visible = false;
    updateScalarSurfaceOverlays(frame);
    expect(frame.cache.get(scalarSurfaceCacheKey(id))!.group.visible).toBe(false);

    updateAnalysisOverlays({
      analyses: {},
      objects: frame.objects,
      objectNodes: frame.objectNodes,
      overlayRoot: frame.overlayRoot,
      cache: frame.cache,
      theme: "light",
      params: frame.params,
      tokens: getGraphThemeTokens("light"),
      computeStatusOf: () => "idle",
      clearAnalysis: () => {}
    });
    expect(frame.cache.has(scalarSurfaceCacheKey(id))).toBe(true);

    enable(id, { showHeatmap: false });
    updateScalarSurfaceOverlays({ ...frame, configs: useGraphStore.getState().ui.scalarVizBySourceId });
    expect(frame.cache.size).toBe(0);
    expect(frame.overlayRoot.children).toHaveLength(0);
  });
});
