import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Group,
  Mesh,
  Quaternion,
  Raycaster,
  Vector3,
  type Object3D
} from "three";
import type { GraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import {
  analysisOverlaySizes,
  buildAnalysisOverlayGroup,
  updateAnalysisOverlays,
  type AnalysisOverlayFrame
} from "@/lib/graph3d/buildAnalysisOverlays";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { tangentBasisFromNormal } from "@/lib/math/surfaceDifferential";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

function makeSurface(equation = "z = x^2 + 2*y^2"): SurfaceGraphObject {
  return {
    id: "s-1",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation,
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 80,
    appearance: { wireframe: false }
  };
}

function makeFrame(
  objects: GraphObject[],
  analyses: AnalysisOverlayFrame["analyses"],
  overrides: Partial<AnalysisOverlayFrame> = {}
): { frame: AnalysisOverlayFrame; overlayRoot: Group; clearAnalysis: ReturnType<typeof vi.fn> } {
  const overlayRoot = new Group();
  const clearAnalysis = vi.fn();
  const frame: AnalysisOverlayFrame = {
    analyses,
    objects,
    objectNodes: new Map<string, Object3D>(objects.map((o) => [o.id, new Group()])),
    overlayRoot,
    cache: new Map(),
    theme: "dark",
    params: {},
    tokens: getGraphThemeTokens("dark"),
    computeStatusOf: () => "idle",
    clearAnalysis,
    ...overrides
  };
  return { frame, overlayRoot, clearAnalysis };
}

function recordFor(object: GraphObject, point = { x: 1, y: 2, z: 9 }) {
  const structure = analysisSourceIdentity(object);
  if (structure === null) {
    throw new Error("recordFor requires a supported surface");
  }
  return {
    sourceId: object.id,
    point: { ...point },
    structure,
    showNormal: true,
    showTangent: true
  };
}

describe("analysis overlay sizing and builders (S21 Slice 5)", () => {
  it("sizes patches and arrows from the domain span with bounds", () => {
    expect(
      analysisOverlaySizes({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, false)
    ).toEqual({ patchSize: 1.5, normalLength: 1.2 });
    // Degenerate and huge domains stay sane.
    expect(analysisOverlaySizes({ xMin: 2, xMax: 2, yMin: 2, yMax: 2 }, false).patchSize).toBe(1.5);
    expect(
      analysisOverlaySizes({ xMin: -1000, xMax: 1000, yMin: -1000, yMax: 1000 }, false)
    ).toEqual({ patchSize: 6, normalLength: 4 });
  });

  it("builds a finite tangent patch containing the point, perpendicular to the normal", () => {
    const basis = tangentBasisFromNormal({ x: -2, y: 1, z: -8 });
    expect(basis).not.toBeNull();
    const group = buildAnalysisOverlayGroup({
      sourceId: "s-1",
      geometry: {
        pointWorld: { x: 1, y: 3, z: 2 },
        normalWorld: { x: -2, y: 1, z: -8 },
        basisT1World: basis!.t1,
        basisT2World: basis!.t2,
        patchSize: 1.5,
        normalLength: 1.2
      },
      planeColor: "#3b82f6",
      normalColor: "#f8fafc",
      showNormal: true,
      showTangent: true,
      roughness: 0.6,
      metalness: 0
    });
    expect(group).not.toBeNull();
    expect(group!.userData.analysisSourceId).toBe("s-1");
    // Plane mesh: 4 vertices / 2 triangles; every vertex on the plane.
    const planeMesh = group!.children[0]!.children[0] as Mesh;
    const positions = (planeMesh.geometry.getAttribute("position") as { array: ArrayLike<number> }).array;
    expect(positions.length).toBe(12);
    for (let i = 0; i < 4; i += 1) {
      const residual =
        -2 * (positions[i * 3]! - 1) + 1 * (positions[i * 3 + 1]! - 3) + -8 * (positions[i * 3 + 2]! - 2);
      // Float32 position buffers: tolerance respects rounding, not f64 math.
      expect(Math.abs(residual)).toBeLessThan(1e-6);
    }
    // Normal arrow aims along the unit normal with the fixed length.
    const shaft = group!.children[1]!.children[0] as Mesh;
    const composed = shaft.matrix;
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    composed.decompose(position, quaternion, scale);
    expect([position.x, position.y, position.z]).toEqual([1, 3, 2]);
    const direction = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    const expected = new Vector3(-2, 1, -8).normalize();
    expect(direction.distanceTo(expected)).toBeLessThan(1e-9);
    expect(scale.y).toBeCloseTo(0.72 * 1.2, 9);
    // Nothing participates in raycasting.
    const raycaster = new Raycaster(new Vector3(1, 10, 2), new Vector3(0, -1, 0));
    expect(raycaster.intersectObject(group!, true)).toEqual([]);
  });

  it("returns null for empty flags and non-finite input", () => {
    const base = {
      sourceId: "s-1",
      geometry: {
        pointWorld: { x: 1, y: 3, z: 2 },
        normalWorld: { x: 0, y: 1, z: 0 },
        basisT1World: { x: 1, y: 0, z: 0 },
        basisT2World: { x: 0, y: 0, z: 1 },
        patchSize: 1.5,
        normalLength: 1.2
      },
      planeColor: "#3b82f6",
      normalColor: "#f8fafc",
      roughness: 0.6,
      metalness: 0
    };
    expect(buildAnalysisOverlayGroup({ ...base, showNormal: false, showTangent: false })).toBeNull();
    expect(
      buildAnalysisOverlayGroup({
        ...base,
        showNormal: true,
        showTangent: false,
        geometry: { ...base.geometry, pointWorld: { x: NaN, y: 0, z: 0 } }
      })
    ).toBeNull();
  });
});

describe("updateAnalysisOverlays lifecycle (S21 Slice 5)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("builds one overlay per record and reuses it across frames", () => {
    const object = makeSurface();
    const { frame, overlayRoot } = makeFrame([object], { [object.id]: recordFor(object) });
    updateAnalysisOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.cache.has(object.id)).toBe(true);
    const group = frame.cache.get(object.id)!.group;

    updateAnalysisOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.cache.get(object.id)!.group).toBe(group);
  });

  it("maps math point/normal through the S20 world permutation", () => {
    // z = x + y has math gradient (-1,-1,1) everywhere: the overlay must
    // aim along world (-1,1,-1) from world-mapped points.
    const object = makeSurface("z = x + y");
    const { frame } = makeFrame([object], { [object.id]: recordFor(object, { x: 1, y: 2, z: 3 }) });
    updateAnalysisOverlays(frame);
    const group = frame.cache.get(object.id)!.group;
    // Normal arrow group is the second child (patch first).
    const arrow = group.children[1]!;
    const shaft = arrow.children[0] as Mesh;
    const position = new Vector3();
    const quaternion = new Quaternion();
    shaft.matrix.decompose(position, quaternion, new Vector3());
    expect([position.x, position.y, position.z]).toEqual([1, 3, 2]);
    const direction = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    const expected = new Vector3(-1, 1, -1).normalize();
    expect(direction.distanceTo(expected)).toBeLessThan(1e-9);
  });

  it("hides while pending, removes on stale/missing, keeps the source node intact", () => {
    const object = makeSurface();
    const node = new Group();
    const { frame, overlayRoot, clearAnalysis } = makeFrame(
      [object],
      { [object.id]: recordFor(object) },
      {
        objectNodes: new Map<string, Object3D>([[object.id, node]]),
        computeStatusOf: () => "pending"
      }
    );
    updateAnalysisOverlays(frame);
    // Pending: no overlay built, record kept for resume.
    expect(overlayRoot.children).toHaveLength(0);
    expect(clearAnalysis).not.toHaveBeenCalled();

    // Settled: overlay appears without touching the source node.
    const settled = { ...frame, computeStatusOf: () => "idle" as const };
    updateAnalysisOverlays(settled);
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.objectNodes.get(object.id)).toBe(node);

    // Structure change: overlay removed and record cleared.
    const edited = { ...object, equation: "z = x^2 + y^2" };
    updateAnalysisOverlays({ ...settled, objects: [edited] });
    expect(overlayRoot.children).toHaveLength(0);
    expect(clearAnalysis).toHaveBeenCalledWith(object.id);
  });

  it("hides overlays for hidden sources and drops them for deleted sources", () => {
    const object = makeSurface();
    const { frame, overlayRoot, clearAnalysis } = makeFrame([object], {
      [object.id]: recordFor(object)
    });
    updateAnalysisOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);

    const node = frame.objectNodes.get(object.id)!;
    node.visible = false;
    updateAnalysisOverlays(frame);
    expect(frame.cache.get(object.id)!.group.visible).toBe(false);
    expect(clearAnalysis).not.toHaveBeenCalled();

    node.visible = true;
    updateAnalysisOverlays({ ...frame, objects: [] });
    expect(overlayRoot.children).toHaveLength(0);
    expect(clearAnalysis).toHaveBeenCalledWith(object.id);
  });

  it("produces no overlay for zero-gradient, off-surface, or unavailable math", () => {
    const zero = makeSurface("z = x^2 + y^2");
    const zeroRecord = recordFor(zero, { x: 0, y: 0, z: 0 });
    // (0,0,0): gradient <-0,-0,1> is valid — use the cone apex instead.
    const cone = {
      id: "c-1",
      kind: "implicitSurface",
      color: "#3b82f6",
      visible: true,
      equation: "x^2+y^2-z^2=0",
      domain: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, zMin: -2, zMax: 2 },
      resolution: 16,
      appearance: { wireframe: false }
    } as const;
    const apex = recordFor(cone, { x: 0, y: 0, z: 0 });
    const far = recordFor(zero, { x: 100, y: 100, z: 0 });
    const { frame, overlayRoot, clearAnalysis } = makeFrame([zero, cone], {
      [apex.sourceId]: apex,
      [far.sourceId]: far,
      [zeroRecord.sourceId]: zeroRecord
    });
    updateAnalysisOverlays(frame);
    // Apex: zero gradient → no overlay, record kept for the diagnostic.
    // Far: off-surface → no overlay. Origin plane point: valid overlay.
    expect(overlayRoot.children).toHaveLength(1);
    expect(frame.cache.has(zero.id)).toBe(true);
    expect(frame.cache.has(cone.id)).toBe(false);
    expect(clearAnalysis).not.toHaveBeenCalled();
  });

  it("honors show flags without rebuilding the source", () => {
    const object = makeSurface();
    const { frame, overlayRoot } = makeFrame([object], {
      [object.id]: { ...recordFor(object), showNormal: false }
    });
    updateAnalysisOverlays(frame);
    const group = frame.cache.get(object.id)!.group;
    // Tangent patch only: one patch subgroup.
    expect(group.children).toHaveLength(1);
    expect(overlayRoot.children).toHaveLength(1);
  });

  it("drops overlays whose records vanished", () => {
    const object = makeSurface();
    const { frame, overlayRoot } = makeFrame([object], { [object.id]: recordFor(object) });
    updateAnalysisOverlays(frame);
    expect(overlayRoot.children).toHaveLength(1);
    updateAnalysisOverlays({ ...frame, analyses: {} });
    expect(overlayRoot.children).toHaveLength(0);
    expect(frame.cache.size).toBe(0);
  });

  it("rebuilds overlays when the theme changes materials", () => {
    const object = makeSurface();
    const { frame, overlayRoot } = makeFrame([object], { [object.id]: recordFor(object) });
    updateAnalysisOverlays(frame);
    const darkGroup = frame.cache.get(object.id)!.group;
    expect(overlayRoot.children).toHaveLength(1);
    updateAnalysisOverlays({ ...frame, theme: "light" });
    const lightGroup = frame.cache.get(object.id)!.group;
    expect(lightGroup).not.toBe(darkGroup);
    expect(overlayRoot.children).toHaveLength(1);
  });

  it("clears records when parameters change the math identity (tick backstop)", () => {
    const store = useEditorStore.getState();
    const previous = store.parameters;
    try {
      useEditorStore.setState({
        parameters: [...previous, { id: "a", value: 2, min: 0, max: 10 }]
      });
      const object = makeSurface("z = a*x^2 + y^2");
      const { frame, overlayRoot, clearAnalysis } = makeFrame(
        [object],
        {
          [object.id]: recordFor(object, { x: 2, y: 1, z: 9 })
        },
        { params: { a: 2 } }
      );
      updateAnalysisOverlays(frame);
      expect(overlayRoot.children).toHaveLength(1);
      expect(clearAnalysis).not.toHaveBeenCalled();
      // A parameter edit changes the recorded identity: the tick clears.
      useEditorStore.setState({
        parameters: [...previous, { id: "a", value: 3, min: 0, max: 10 }]
      });
      updateAnalysisOverlays(frame);
      expect(overlayRoot.children).toHaveLength(0);
      expect(clearAnalysis).toHaveBeenCalledWith(object.id);
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });
});
