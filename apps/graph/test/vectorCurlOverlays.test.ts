import { beforeEach, describe, expect, it, vi } from "vitest";
import { Group, Quaternion, Raycaster, Vector3, type Object3D } from "three";
import type { GraphObject, VectorFieldObject } from "@vinculum/scene/types";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import {
  buildCurlArrowGroup,
  curlOverlayCacheKey,
  updateVectorCurlOverlays,
  type VectorCurlOverlayFrame
} from "@/lib/graph3d/buildAnalysisOverlays";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

function makeField3D(
  pExpr = "-y",
  qExpr = "x",
  rExpr = "0",
  id = "f-1"
): VectorFieldObject {
  return {
    id,
    kind: "vectorField",
    dimension: "3d",
    color: "#3b82f6",
    visible: true,
    pExpr,
    qExpr,
    rExpr,
    density: 8,
    scale: 1,
    normalize: false,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 }
  };
}

function recordFor(object: GraphObject, point = { x: 1, y: 2, z: 3 }, showCurl = true) {
  const structure = vectorCalculusSourceIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (structure === null) {
    throw new Error("recordFor requires a vector field");
  }
  return { sourceId: object.id, point: { ...point }, structure, showCurl };
}

function makeFrame(
  objects: GraphObject[],
  records: VectorCurlOverlayFrame["records"],
  overrides: Partial<VectorCurlOverlayFrame> = {}
): { frame: VectorCurlOverlayFrame; overlayRoot: Group; clearVectorCalculus: ReturnType<typeof vi.fn> } {
  const overlayRoot = new Group();
  const clearVectorCalculus = vi.fn();
  const frame: VectorCurlOverlayFrame = {
    records,
    objects,
    objectNodes: new Map<string, Object3D>(objects.map((o) => [o.id, new Group()])),
    overlayRoot,
    cache: new Map(),
    theme: "dark",
    // Identity uses parameter KEYS: the frame scope must carry the same
    // keys the record was created with (production tick passes the live
    // editor scope; tests mirror it so identities match).
    params: getEditorParameterScope(),
    tokens: getGraphThemeTokens("dark"),
    clearVectorCalculus,
    ...overrides
  };
  return { frame, overlayRoot, clearVectorCalculus };
}

describe("curl arrow builder (S22 PART 13)", () => {
  it("aims along the world-mapped curl with domain-relative length", () => {
    const group = buildCurlArrowGroup({
      sourceId: "f-1",
      pointWorld: { x: 1, y: 3, z: 2 },
      directionWorld: { x: 0, y: 2, z: 0 },
      length: 1.2,
      color: "#f8fafc",
      roughness: 0.6,
      metalness: 0
    });
    expect(group).not.toBeNull();
    expect(group!.userData.curlOverlay).toBe(true);
    const shaft = group!.children[0] as import("three").Mesh;
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    shaft.matrix.decompose(position, quaternion, scale);
    expect([position.x, position.y, position.z]).toEqual([1, 3, 2]);
    const direction = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    expect(direction.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-9);
    expect(scale.y).toBeCloseTo(0.72 * 1.2, 9);
    const raycaster = new Raycaster(new Vector3(1, 10, 2), new Vector3(0, -1, 0));
    expect(raycaster.intersectObject(group!, true)).toEqual([]);
  });

  it("renders nothing for zero curl", () => {
    expect(
      buildCurlArrowGroup({
        sourceId: "f-1",
        pointWorld: { x: 0, y: 0, z: 0 },
        directionWorld: { x: 0, y: 0, z: 0 },
        length: 1.2,
        color: "#f8fafc",
        roughness: 0.6,
        metalness: 0
      })
    ).toBeNull();
  });

  it("returns null for non-finite input", () => {
    expect(
      buildCurlArrowGroup({
        sourceId: "f-1",
        pointWorld: { x: NaN, y: 0, z: 0 },
        directionWorld: { x: 0, y: 0, z: 1 },
        length: 1.2,
        color: "#f8fafc",
        roughness: 0.6,
        metalness: 0
      })
    ).toBeNull();
  });
});

describe("updateVectorCurlOverlays lifecycle (S22 PART 13/17/18/32)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("builds one curl arrow for a 3D rotation field and reuses it", () => {
    const object = makeField3D();
    const { frame, overlayRoot } = makeFrame([object], { [object.id]: recordFor(object) });
    updateVectorCurlOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.cache.has(curlOverlayCacheKey(object.id))).toBe(true);
    const group = frame.cache.get(curlOverlayCacheKey(object.id))!.group;
    updateVectorCurlOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.cache.get(curlOverlayCacheKey(object.id))!.group).toBe(group);
  });

  it("maps math curl (0,0,2) through the S20 world permutation", () => {
    // F=<-y,x,0> has math curl <0,0,2> → world <0,2,0> (y/z swap).
    const object = makeField3D();
    const { frame } = makeFrame([object], { [object.id]: recordFor(object, { x: 1, y: 1, z: 5 }) });
    updateVectorCurlOverlays(frame);
    const group = frame.cache.get(curlOverlayCacheKey(object.id))!.group;
    const shaft = group.children[0] as import("three").Mesh;
    const quaternion = new Quaternion();
    shaft.matrix.decompose(new Vector3(), quaternion, new Vector3());
    const direction = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    expect(direction.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-9);
  });

  it("pins the asymmetric curl direction in world space", () => {
    // F=<x*y,y*z,z*x> at (1,2,3): math curl <-2,-3,-1> → world <-2,-1,-3>.
    const object = makeField3D("x*y", "y*z", "z*x");
    const { frame } = makeFrame([object], { [object.id]: recordFor(object, { x: 1, y: 2, z: 3 }) });
    updateVectorCurlOverlays(frame);
    const group = frame.cache.get(curlOverlayCacheKey(object.id))!.group;
    const shaft = group.children[0] as import("three").Mesh;
    const quaternion = new Quaternion();
    shaft.matrix.decompose(new Vector3(), quaternion, new Vector3());
    const direction = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    const expected = new Vector3(-2, -1, -3).normalize();
    expect(direction.distanceTo(expected)).toBeLessThan(1e-9);
  });

  it("renders nothing for zero curl while keeping the record", () => {
    const object = makeField3D("x", "y", "z");
    const { frame, overlayRoot, clearVectorCalculus } = makeFrame([object], {
      [object.id]: recordFor(object)
    });
    updateVectorCurlOverlays(frame);
    expect(overlayRoot.children).toHaveLength(0);
    expect(frame.cache.has(curlOverlayCacheKey(object.id))).toBe(false);
    expect(clearVectorCalculus).not.toHaveBeenCalled();
  });

  it("preserves 2D records (Inspector-only) and honors hidden curl flags", () => {
    // S22-R1: 2D Jacobian/divergence/scalar curl live in the Inspector;
    // the curl tick must never clear those records — it only skips the
    // (nonexistent) 3D arrow.
    const field2D: VectorFieldObject = {
      ...makeField3D(),
      dimension: "2d",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }
    };
    const { frame, overlayRoot, clearVectorCalculus } = makeFrame([field2D], {
      [field2D.id]: recordFor(field2D)
    });
    updateVectorCurlOverlays(frame);
    expect(overlayRoot.children).toHaveLength(0);
    expect(clearVectorCalculus).not.toHaveBeenCalled();

    const object = makeField3D();
    const hidden = makeFrame([object], { [object.id]: recordFor(object, { x: 1, y: 2, z: 3 }, false) });
    updateVectorCurlOverlays(hidden.frame);
    expect(hidden.overlayRoot.children).toHaveLength(0);
  });

  it("hides the arrow when the source is hidden but keeps the record", () => {
    const object = makeField3D();
    const { frame, overlayRoot, clearVectorCalculus } = makeFrame([object], {
      [object.id]: recordFor(object)
    });
    updateVectorCurlOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    const node = frame.objectNodes.get(object.id)!;
    node.visible = false;
    updateVectorCurlOverlays(frame);
    expect(frame.cache.get(curlOverlayCacheKey(object.id))!.group.visible).toBe(false);
    expect(clearVectorCalculus).not.toHaveBeenCalled();
  });

  it("clears stale records and drops vanished ones", () => {
    const object = makeField3D();
    const node = new Group();
    const { frame, overlayRoot, clearVectorCalculus } = makeFrame(
      [object],
      { [object.id]: recordFor(object) },
      { objectNodes: new Map<string, Object3D>([[object.id, node]]) }
    );
    updateVectorCurlOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);

    const edited = { ...object, pExpr: "y" };
    updateVectorCurlOverlays({ ...frame, objects: [edited] });
    expect(overlayRoot.children).toHaveLength(0);
    expect(clearVectorCalculus).toHaveBeenCalledWith(object.id);

    updateVectorCurlOverlays({ ...frame, records: {} });
    expect(frame.cache.size).toBe(0);
  });

  it("shares the overlay root cache namespace without disturbing surface overlays", () => {
    const object = makeField3D();
    const { frame, overlayRoot } = makeFrame([object], { [object.id]: recordFor(object) });
    frame.cache.set("s-1", { key: "surface-key", group: new Group() });
    overlayRoot.add(frame.cache.get("s-1")!.group);
    updateVectorCurlOverlays(frame);
    expect(frame.cache.has("s-1")).toBe(true);
    expect(frame.cache.has(curlOverlayCacheKey(object.id))).toBe(true);
    expect(overlayRoot.children).toHaveLength(2);
  });
});
