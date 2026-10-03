import { describe, expect, it, vi } from "vitest";
import {
  Group,
  Mesh,
  PerspectiveCamera,
  Plane,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type Object3D
} from "three";
import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { buildIndexedSurfaceMeshGroup } from "@/lib/graph3d/buildIndexedSurfaceMesh";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { pickAnalysisSourcePoint } from "@/lib/graph3d/graphThreeAnalysisPick";
import { attemptAnalysisPick, createGraphThreePointerInputHandlers, getAnalysisPickPreview } from "@/lib/graph3d/graphThreeEngineInputPointer";
import type { PickWorldFromCanvasArgs } from "@/lib/graph3d/graphThreeEnginePickWorld";
import type { GraphThreeEngineInputHandlersDeps } from "@/lib/graph3d/graphThreeEngineInputTypes";
import { useGraphStore } from "@/store/graphStore";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";

function makeSphereRoot(): Group {
  const computed = computeImplicitSurfaceData({
    equation: "x^2 + y^2 + z^2 = 1",
    domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
    resolution: 32,
    params: {}
  });
  if (computed.status !== "ok") {
    throw new Error("sphere failed");
  }
  const group = buildIndexedSurfaceMeshGroup({
    id: "sphere-1",
    color: "#3b82f6",
    wireframe: false,
    positions: computed.positions,
    indices: computed.indices,
    theme: "dark",
    tokens: getGraphThemeTokens("dark"),
    repairZeroNormals: true
  });
  if (!group) {
    throw new Error("no group");
  }
  const root = new Group();
  root.add(group);
  return root;
}

function makeArgs(objectsRoot: Group, camera: PerspectiveCamera): PickWorldFromCanvasArgs {
  return {
    renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } } as unknown as PickWorldFromCanvasArgs["renderer"],
    camera,
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    objectsRoot,
    baselinePlane: { distanceToPoint: () => 0 } as unknown as PickWorldFromCanvasArgs["baselinePlane"],
    tempGround: new Vector3(),
    pickOverride: null
  };
}

describe("pickAnalysisSourcePoint (S21 pick robustness)", () => {
  it("picks the visible front on a vertex-threading center click (S21-R debug)", () => {
    const root = makeSphereRoot();
    // Browser-exact failing configuration: fov 48 with a 1-ULP camera
    // offset threads diagonal mesh vertices; a single ray misses every
    // front face yet catches shared back vertices.
    const camera = new PerspectiveCamera(48, 1.4265625, 0.05, 30000);
    camera.position.set(6, 6, 6.000000000000001);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const args = makeArgs(root, camera);
    const point = pickAnalysisSourcePoint({ clientX: 50, clientY: 50 }, args, "sphere-1");
    expect(point).not.toBeNull();
    // Front hemisphere: all components positive for this camera.
    expect(point!.x).toBeGreaterThan(0);
    expect(point!.y).toBeGreaterThan(0);
    expect(point!.z).toBeGreaterThan(0);
    const radius = Math.sqrt(point!.x ** 2 + point!.y ** 2 + point!.z ** 2);
    expect(radius).toBeCloseTo(1, 2);
  });

  it("does not let visible wide strokes occlude an analysis surface", () => {
    const root = makeSphereRoot();
    const stroke = new Mesh(new SphereGeometry(2));
    stroke.userData.wideStroke = true;
    stroke.userData.vinculumId = "line-1";
    root.add(stroke);
    const camera = new PerspectiveCamera(48, 1, 0.05, 30000);
    camera.position.set(6, 6, 6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    root.updateMatrixWorld(true);
    const point = pickAnalysisSourcePoint({ clientX: 50, clientY: 50 }, makeArgs(root, camera), "sphere-1");
    expect(point).not.toBeNull();
    expect(Math.hypot(point!.x, point!.y, point!.z)).toBeCloseTo(1, 2);
    stroke.geometry.dispose();
  });

  it("ignores clicks on other objects and empty space", () => {
    const root = makeSphereRoot();
    const camera = new PerspectiveCamera(48, 1.4265625, 0.05, 30000);
    camera.position.set(6, 6, 6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const args = makeArgs(root, camera);
    // Wrong source id: the sphere occludes nothing else, first identified
    // hit belongs to another object → null.
    expect(pickAnalysisSourcePoint({ clientX: 50, clientY: 50 }, args, "other-1")).toBeNull();
    // Corner ray misses everything.
    expect(pickAnalysisSourcePoint({ clientX: 99, clientY: 1 }, args, "sphere-1")).toBeNull();
  });

  it("attributes hits through nested groups via parent walk", () => {
    const inner = new Group();
    const mesh = new Mesh(new SphereGeometry(1, 24, 18));
    inner.add(mesh);
    const root = new Group();
    root.add(inner);
    (root as unknown as { userData: { vinculumId: string } }).userData = { vinculumId: "nested-1" };
    const camera = new PerspectiveCamera(48, 1.4265625, 0.05, 30000);
    camera.position.set(6, 6, 6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const args = makeArgs(root, camera);
    const point = pickAnalysisSourcePoint({ clientX: 50, clientY: 50 }, args, "nested-1");
    expect(point).not.toBeNull();
  });
});

function makeAttemptDeps(objectsRoot: Group): GraphThreeEngineInputHandlersDeps {
  const camera = new PerspectiveCamera(48, 1, 0.05, 30000);
  camera.position.set(6, 6, 6);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return {
    renderer: {
      domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }
    },
    camera,
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    objectsRoot,
    baselinePlane: new Plane(new Vector3(0, 1, 0), 0),
    tempGround: new Vector3()
  } as unknown as GraphThreeEngineInputHandlersDeps;
}

describe("attemptAnalysisPick gates (S21 PART 35)", () => {
  it("previews the same surface point as the click, in math coordinates, without committing history", () => {
    useGraphStore.getState().resetScene();
    useGeometryComputeStore.getState().clearAll();
    const store = useGraphStore.getState();
    const id = store.addImplicitSurface();
    store.updateImplicitSurfaceExpression(id, "equation", "x^2+y^2+z^2=1");
    store.armDifferentialAnalysisPick(id);
    const root = makeSphereRoot();
    root.children[0]!.userData.vinculumId = id;
    const deps = makeAttemptDeps(root);
    deps.mutable = { hoverProbePoint: null, analysisPickDown: null, primitivePickDown: null, isSketching: false, sketchPoints: [] };
    deps.setHoverProbeBadge = vi.fn();
    deps.formatProbe = point => JSON.stringify(point);
    const point = getAnalysisPickPreview(deps, id, { clientX: 50, clientY: 50 });
    expect(point).not.toBeNull();
    const handlers = createGraphThreePointerInputHandlers(deps);
    handlers.handlePointerMove({ clientX: 50, clientY: 50 } as PointerEvent);
    expect(deps.setHoverProbeBadge).toHaveBeenLastCalledWith(`Pick ${JSON.stringify(point)}`, 50, 50);
    expect(deps.mutable.hoverProbePoint).toEqual({ x: point!.x, y: point!.z, z: point!.y });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBe(id);
    attemptAnalysisPick(deps, id, { clientX: 50, clientY: 50 });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]?.point).toEqual(point);
    expect(deps.setHoverProbeBadge).toHaveBeenLastCalledWith(null, 0, 0);
    expect(deps.mutable.hoverProbePoint).toBeNull();
  });

  it("does not preview pending, hidden, occluded or missed sources", () => {
    useGraphStore.getState().resetScene();
    useGeometryComputeStore.getState().clearAll();
    const id = useGraphStore.getState().addImplicitSurface();
    const root = makeSphereRoot();
    root.children[0]!.userData.vinculumId = id;
    const deps = makeAttemptDeps(root);
    useGeometryComputeStore.getState().setStatus(id, "pending");
    expect(getAnalysisPickPreview(deps, id, { clientX: 50, clientY: 50 })).toBeNull();
    useGeometryComputeStore.getState().clearAll();
    useGraphStore.getState().toggleObjectVisibility(id);
    expect(getAnalysisPickPreview(deps, id, { clientX: 50, clientY: 50 })).toBeNull();
    useGraphStore.getState().toggleObjectVisibility(id);
    expect(getAnalysisPickPreview(deps, id, { clientX: 99, clientY: 1 })).toBeNull();
    expect(getAnalysisPickPreview(deps, "other", { clientX: 50, clientY: 50 })).toBeNull();
  });

  it("refuses picks while the source has pending compute and stays armed", () => {
    useGraphStore.getState().resetScene();
    useGeometryComputeStore.getState().clearAll();
    const store = useGraphStore.getState();
    const id = store.addImplicitSurface();
    store.updateImplicitSurfaceExpression(id, "equation", "x^2+y^2+z^2=1");
    store.armDifferentialAnalysisPick(id);
    useGeometryComputeStore.getState().setStatus(id, "pending");

    const root = makeSphereRoot();
    const node = root.children[0];
    if (node) {
      (node as unknown as { userData: { vinculumId: string } }).userData = { vinculumId: id };
    }
    attemptAnalysisPick(makeAttemptDeps(root), id, { clientX: 50, clientY: 50 });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBe(id);
    useGeometryComputeStore.getState().clearAll();
  });

  it("records the pick with live math identity once settled", () => {
    useGraphStore.getState().resetScene();
    useGeometryComputeStore.getState().clearAll();
    const store = useGraphStore.getState();
    const id = store.addImplicitSurface();
    store.updateImplicitSurfaceExpression(id, "equation", "x^2+y^2+z^2=1");
    store.armDifferentialAnalysisPick(id);

    const root = makeSphereRoot();
    const node = root.children[0];
    if (node) {
      (node as unknown as { userData: { vinculumId: string } }).userData = { vinculumId: id };
    }
    attemptAnalysisPick(makeAttemptDeps(root), id, { clientX: 50, clientY: 50 });
    const record = useGraphStore.getState().ui.differentialAnalysisBySourceId[id];
    expect(record).toBeDefined();
    const live = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(record?.structure).toBe(live ? analysisSourceIdentity(live) : null);
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBeNull();
    useGeometryComputeStore.getState().clearAll();
  });

  it("disarms and ignores unsupported kinds", () => {
    useGraphStore.getState().resetScene();
    useGeometryComputeStore.getState().clearAll();
    const store = useGraphStore.getState();
    const id = store.addPlaneObject();
    store.armDifferentialAnalysisPick(id);
    attemptAnalysisPick(makeAttemptDeps(new Group()), id, { clientX: 50, clientY: 50 });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBeNull();
    useGeometryComputeStore.getState().clearAll();
  });
});
