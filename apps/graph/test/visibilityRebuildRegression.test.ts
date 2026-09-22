// S7 F6 visibility-rebuild regression suite (fixed behavior, verified S7-U3/U5).
//
// F6 contract: a visibility-only mutation reuses the existing Three.js
// Object3D / BufferGeometry / materials and only flips `.visible`.
// Visibility is excluded from both render and structure signatures
// (renderDescriptors.ts); the sync loop pre-syncs `.visible` on the cached
// node before the signature-equality early-out (graphThreeSyncSceneObjects.ts).

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BufferGeometry,
  DirectionalLight,
  Group,
  Line,
  LineSegments,
  Material,
  Mesh,
  Object3D,
  WebGLRenderer
} from "three";
import type {
  GraphObject,
  ParametricCurveObject,
  PlaneGraphObject,
  SurfaceGraphObject
} from "@vinculum/scene/types";
import { syncThreeSceneObjects } from "@/lib/graph3d/graphThreeSyncSceneObjects";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/buildGraphObjects";
import { buildSurface } from "@/lib/graph3d/buildGraphSurface";
import { buildParametric } from "@/lib/graph3d/buildGraphParametric";
import { buildPlane } from "@/lib/graph3d/buildGraphPlane";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { sampleCurve } from "@/lib/math/sampleCurve";
import { samplePlane } from "@/lib/math/samplePlane";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { useGraphStore } from "@/store/graphStore";

// Call-through spies: count builder/sampler invocations without changing behavior.
vi.mock("@/lib/graph3d/buildGraphSurface", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/graph3d/buildGraphSurface")>();
  return { ...mod, buildSurface: vi.fn(mod.buildSurface) };
});
vi.mock("@/lib/graph3d/buildGraphParametric", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/graph3d/buildGraphParametric")>();
  return { ...mod, buildParametric: vi.fn(mod.buildParametric) };
});
vi.mock("@/lib/graph3d/buildGraphPlane", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/graph3d/buildGraphPlane")>();
  return { ...mod, buildPlane: vi.fn(mod.buildPlane) };
});
vi.mock("@/lib/math/sampleSurface", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/math/sampleSurface")>();
  return { ...mod, sampleSurface: vi.fn(mod.sampleSurface) };
});
vi.mock("@/lib/math/sampleCurve", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/math/sampleCurve")>();
  return { ...mod, sampleCurve: vi.fn(mod.sampleCurve) };
});
vi.mock("@/lib/math/samplePlane", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/math/samplePlane")>();
  return { ...mod, samplePlane: vi.fn(mod.samplePlane) };
});

function makeSurface(overrides: Partial<SurfaceGraphObject> = {}): SurfaceGraphObject {
  return {
    id: "surface-1",
    kind: "surface",
    color: "#3b82f6",
    visible: true,
    equation: "sin(x) * cos(y)",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    resolution: 24,
    appearance: { wireframe: false },
    orientation: "z",
    ...overrides
  };
}

function makeCurve(overrides: Partial<ParametricCurveObject> = {}): ParametricCurveObject {
  return {
    id: "curve-1",
    kind: "parametricCurve",
    color: "#0ea5e9",
    visible: true,
    xExpr: "cos(t)",
    yExpr: "sin(t)",
    zExpr: "t",
    tMin: -3.1415926536,
    tMax: 3.1415926536,
    samples: 32,
    ...overrides
  };
}

function makePlane(overrides: Partial<PlaneGraphObject> = {}): PlaneGraphObject {
  return {
    id: "plane-1",
    kind: "plane",
    color: "#f59e0b",
    visible: true,
    equation: "x + y + z - 1 = 0",
    size: 6,
    appearance: { wireframe: false },
    ...overrides
  };
}

interface SyncHarness {
  root: Group;
  nodes: Map<string, Object3D>;
  signatures: Map<string, string>;
  structures: Map<string, string>;
  keyLight: DirectionalLight;
  renderer: WebGLRenderer;
  sync: (objects: GraphObject[]) => void;
}

function createHarness(): SyncHarness {
  const harness: SyncHarness = {
    root: new Group(),
    nodes: new Map(),
    signatures: new Map(),
    structures: new Map(),
    keyLight: new DirectionalLight(),
    renderer: { shadowMap: {} } as unknown as WebGLRenderer,
    sync: (objects: GraphObject[]) => {
      syncThreeSceneObjects(
        "dark",
        objects,
        harness.root,
        harness.nodes,
        harness.signatures,
        harness.structures,
        harness.keyLight,
        harness.renderer
      );
    }
  };
  return harness;
}

function isRenderableChild(child: Object3D): child is Mesh | Line | LineSegments {
  return child instanceof Mesh || child instanceof Line || child instanceof LineSegments;
}

function collectGeometries(node: Object3D): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  node.traverse((child) => {
    if (isRenderableChild(child)) {
      out.push(child.geometry as BufferGeometry);
    }
  });
  return out;
}

function collectMaterials(node: Object3D): Material[] {
  const out: Material[] = [];
  node.traverse((child) => {
    if (isRenderableChild(child)) {
      const material = child.material as Material | Material[];
      if (Array.isArray(material)) {
        out.push(...material);
      } else if (material) {
        out.push(material);
      }
    }
  });
  return out;
}

function firstColorHex(node: Object3D): string | null {
  let found: string | null = null;
  node.traverse((child) => {
    if (found !== null || !isRenderableChild(child)) {
      return;
    }
    const materials = collectMaterials(child);
    for (const material of materials) {
      const color = (material as unknown as { color?: { getHexString?: () => string } }).color;
      const hex = color?.getHexString?.();
      if (typeof hex === "string") {
        found = hex;
        return;
      }
    }
  });
  return found;
}

describe("S7-U2-A surface visibility regression (F6)", () => {
  it("presents hidden state correctly: membership stable, flag flips both ways", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    expect(harness.root.children.length).toBe(1);

    harness.sync([makeSurface({ visible: false })]);
    const hidden = harness.nodes.get("surface-1");
    expect(hidden).toBeDefined();
    expect(hidden?.visible).toBe(false);
    expect(harness.root.children.length).toBe(1);

    harness.sync([makeSurface({ visible: true })]);
    const shown = harness.nodes.get("surface-1");
    expect(shown).toBeDefined();
    expect(shown?.visible).toBe(true);
    expect(harness.root.children.length).toBe(1);
  });

  it("DESIRED: reuses Object3D, geometry, and materials across hide and show", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1");
    expect(node).toBeDefined();
    const geometries = collectGeometries(node as Object3D);
    const materials = collectMaterials(node as Object3D);
    expect(geometries.length).toBeGreaterThan(0);
    expect(materials.length).toBeGreaterThan(0);

    harness.sync([makeSurface({ visible: false })]);
    const hidden = harness.nodes.get("surface-1");
    expect(hidden).toBe(node);
    expect(hidden?.visible).toBe(false);
    expect(collectGeometries(hidden as Object3D)).toEqual(geometries);
    expect(collectMaterials(hidden as Object3D)).toEqual(materials);

    harness.sync([makeSurface({ visible: true })]);
    const shown = harness.nodes.get("surface-1");
    expect(shown).toBe(node);
    expect(shown?.visible).toBe(true);
    expect(collectGeometries(shown as Object3D)).toEqual(geometries);
    expect(collectMaterials(shown as Object3D)).toEqual(materials);
  });

  it("DESIRED: does not dispose geometry or materials on visibility-only toggle", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1") as Object3D;
    const geometrySpies = collectGeometries(node).map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = collectMaterials(node).map((material) => vi.spyOn(material, "dispose"));

    harness.sync([makeSurface({ visible: false })]);
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("S7-U2-B parametric curve visibility regression (F6)", () => {
  it("presents hidden state correctly: membership stable, flag flips both ways", () => {
    const harness = createHarness();
    harness.sync([makeCurve()]);
    expect(harness.nodes.get("curve-1")).toBeDefined();
    expect(harness.root.children.length).toBe(1);

    harness.sync([makeCurve({ visible: false })]);
    const hidden = harness.nodes.get("curve-1");
    expect(hidden).toBeDefined();
    expect(hidden?.visible).toBe(false);
    expect(harness.root.children.length).toBe(1);

    harness.sync([makeCurve({ visible: true })]);
    const shown = harness.nodes.get("curve-1");
    expect(shown).toBeDefined();
    expect(shown?.visible).toBe(true);
    expect(harness.root.children.length).toBe(1);
  });

  it("DESIRED: reuses line node, geometry, and material across hide and show", () => {
    const harness = createHarness();
    harness.sync([makeCurve()]);
    const node = harness.nodes.get("curve-1");
    expect(node).toBeDefined();
    const geometries = collectGeometries(node as Object3D);
    const materials = collectMaterials(node as Object3D);
    expect(geometries.length).toBeGreaterThan(0);
    expect(materials.length).toBeGreaterThan(0);

    harness.sync([makeCurve({ visible: false })]);
    const hidden = harness.nodes.get("curve-1");
    expect(hidden).toBe(node);
    expect(hidden?.visible).toBe(false);
    expect(collectGeometries(hidden as Object3D)).toEqual(geometries);
    expect(collectMaterials(hidden as Object3D)).toEqual(materials);

    harness.sync([makeCurve({ visible: true })]);
    const shown = harness.nodes.get("curve-1");
    expect(shown).toBe(node);
    expect(shown?.visible).toBe(true);
    expect(collectGeometries(shown as Object3D)).toEqual(geometries);
    expect(collectMaterials(shown as Object3D)).toEqual(materials);
  });

  it("DESIRED: does not dispose curve geometry or material on visibility-only toggle", () => {
    const harness = createHarness();
    harness.sync([makeCurve()]);
    const node = harness.nodes.get("curve-1") as Object3D;
    const geometrySpies = collectGeometries(node).map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = collectMaterials(node).map((material) => vi.spyOn(material, "dispose"));

    harness.sync([makeCurve({ visible: false })]);
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("S7-U2-C plane visibility regression (F6)", () => {
  it("presents hidden state correctly: membership stable, flag flips both ways", () => {
    const harness = createHarness();
    harness.sync([makePlane()]);
    expect(harness.nodes.get("plane-1")).toBeDefined();
    expect(harness.root.children.length).toBe(1);

    harness.sync([makePlane({ visible: false })]);
    const hidden = harness.nodes.get("plane-1");
    expect(hidden).toBeDefined();
    expect(hidden?.visible).toBe(false);
    expect(harness.root.children.length).toBe(1);

    harness.sync([makePlane({ visible: true })]);
    const shown = harness.nodes.get("plane-1");
    expect(shown).toBeDefined();
    expect(shown?.visible).toBe(true);
    expect(harness.root.children.length).toBe(1);
  });

  it("DESIRED: reuses plane group, geometry, and materials across hide and show", () => {
    const harness = createHarness();
    harness.sync([makePlane()]);
    const node = harness.nodes.get("plane-1");
    expect(node).toBeDefined();
    const geometries = collectGeometries(node as Object3D);
    const materials = collectMaterials(node as Object3D);
    expect(geometries.length).toBeGreaterThan(0);
    expect(materials.length).toBeGreaterThan(0);

    harness.sync([makePlane({ visible: false })]);
    const hidden = harness.nodes.get("plane-1");
    expect(hidden).toBe(node);
    expect(hidden?.visible).toBe(false);
    expect(collectGeometries(hidden as Object3D)).toEqual(geometries);
    expect(collectMaterials(hidden as Object3D)).toEqual(materials);

    harness.sync([makePlane({ visible: true })]);
    const shown = harness.nodes.get("plane-1");
    expect(shown).toBe(node);
    expect(shown?.visible).toBe(true);
    expect(collectGeometries(shown as Object3D)).toEqual(geometries);
    expect(collectMaterials(shown as Object3D)).toEqual(materials);
  });

  it("DESIRED: does not dispose plane geometry or materials on visibility-only toggle", () => {
    const harness = createHarness();
    harness.sync([makePlane()]);
    const node = harness.nodes.get("plane-1") as Object3D;
    const geometrySpies = collectGeometries(node).map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = collectMaterials(node).map((material) => vi.spyOn(material, "dispose"));

    harness.sync([makePlane({ visible: false })]);
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("S7-U2-E builder/sampler call counts on visibility-only toggle", () => {
  it("DESIRED: surface toggle adds zero buildSurface and zero sampleSurface calls", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const buildsBefore = vi.mocked(buildSurface).mock.calls.length;
    const samplesBefore = vi.mocked(sampleSurface).mock.calls.length;

    harness.sync([makeSurface({ visible: false })]);
    expect(vi.mocked(buildSurface).mock.calls.length - buildsBefore).toBe(0);
    expect(vi.mocked(sampleSurface).mock.calls.length - samplesBefore).toBe(0);
  });

  it("DESIRED: parametric toggle adds zero buildParametric and zero sampleCurve calls", () => {
    const harness = createHarness();
    harness.sync([makeCurve()]);
    const buildsBefore = vi.mocked(buildParametric).mock.calls.length;
    const samplesBefore = vi.mocked(sampleCurve).mock.calls.length;

    harness.sync([makeCurve({ visible: false })]);
    expect(vi.mocked(buildParametric).mock.calls.length - buildsBefore).toBe(0);
    expect(vi.mocked(sampleCurve).mock.calls.length - samplesBefore).toBe(0);
  });

  it("DESIRED: plane toggle adds zero buildPlane and zero samplePlane calls", () => {
    const harness = createHarness();
    harness.sync([makePlane()]);
    const buildsBefore = vi.mocked(buildPlane).mock.calls.length;
    const samplesBefore = vi.mocked(samplePlane).mock.calls.length;

    harness.sync([makePlane({ visible: false })]);
    expect(vi.mocked(buildPlane).mock.calls.length - buildsBefore).toBe(0);
    expect(vi.mocked(samplePlane).mock.calls.length - samplesBefore).toBe(0);
  });
});

describe("S7-U2-F geometry changes must still rebuild", () => {
  it("surface equation change replaces the node", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const oldNode = harness.nodes.get("surface-1");
    const oldGeometries = collectGeometries(oldNode as Object3D);

    harness.sync([makeSurface({ equation: "x^2 + y^2" })]);
    const nextNode = harness.nodes.get("surface-1");
    expect(nextNode).toBeDefined();
    expect(nextNode).not.toBe(oldNode);
    expect(oldNode?.parent).toBeNull();
    const nextGeometries = collectGeometries(nextNode as Object3D);
    expect(nextGeometries.length).toBeGreaterThan(0);
    for (const geometry of nextGeometries) {
      expect(oldGeometries).not.toContain(geometry);
    }
    expect(harness.root.children.length).toBe(1);
  });

  it("parametric expression change replaces the node", () => {
    const harness = createHarness();
    harness.sync([makeCurve()]);
    const oldNode = harness.nodes.get("curve-1");

    harness.sync([makeCurve({ xExpr: "t", yExpr: "t * t", zExpr: "0" })]);
    const nextNode = harness.nodes.get("curve-1");
    expect(nextNode).toBeDefined();
    expect(nextNode).not.toBe(oldNode);
    expect(oldNode?.parent).toBeNull();
    expect(harness.root.children.length).toBe(1);
  });

  it("plane size change replaces the node", () => {
    const harness = createHarness();
    harness.sync([makePlane()]);
    const oldNode = harness.nodes.get("plane-1");

    harness.sync([makePlane({ size: 10 })]);
    const nextNode = harness.nodes.get("plane-1");
    expect(nextNode).toBeDefined();
    expect(nextNode).not.toBe(oldNode);
    expect(oldNode?.parent).toBeNull();
    expect(harness.root.children.length).toBe(1);
  });
});

describe("S7-U2-G visibility plus geometry in one update", () => {
  it("rebuilds exactly once with the new geometry and the new visible state", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const buildsBefore = vi.mocked(buildSurface).mock.calls.length;

    harness.sync([makeSurface({ visible: false, equation: "x^2 + y^2" })]);
    expect(vi.mocked(buildSurface).mock.calls.length - buildsBefore).toBe(1);
    const nextNode = harness.nodes.get("surface-1");
    expect(nextNode).toBeDefined();
    expect(nextNode?.visible).toBe(false);
    expect(harness.root.children.length).toBe(1);
  });
});

describe("S7-U2-H visibility plus color", () => {
  it("DESIRED: reuses node and geometry while updating color and visibility in place", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1");
    const geometries = collectGeometries(node as Object3D);
    const materials = collectMaterials(node as Object3D);

    harness.sync([makeSurface({ visible: false, color: "#ff0000" })]);
    const nextNode = harness.nodes.get("surface-1");
    expect(nextNode).toBe(node);
    expect(nextNode?.visible).toBe(false);
    expect(collectGeometries(nextNode as Object3D)).toEqual(geometries);
    expect(collectMaterials(nextNode as Object3D)).toEqual(materials);
    expect(firstColorHex(nextNode as Object3D)).toBe("ff0000");
  });
});

describe("S7-U2-I no-op visibility set", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("store keeps the scene reference when visibility is set to its current value", () => {
    const id = useGraphStore.getState().addEmptyObject();
    const stored = useGraphStore.getState().scene.objects.find((object) => object.id === id);
    expect(stored?.visible).toBe(true);
    const sceneBefore = useGraphStore.getState().scene;

    useGraphStore.getState().setObjectVisibility(id, true);
    expect(useGraphStore.getState().scene).toBe(sceneBefore);
  });

  it("sync keeps node identity when the same hidden scene syncs twice", () => {
    const harness = createHarness();
    harness.sync([makeSurface({ visible: false })]);
    const node = harness.nodes.get("surface-1");
    expect(node?.visible).toBe(false);

    harness.sync([makeSurface({ visible: false })]);
    expect(harness.nodes.get("surface-1")).toBe(node);
    expect(harness.root.children.length).toBe(1);
  });
});

describe("S7-U2-J hidden object geometry edit still rebuilds while staying hidden", () => {
  it("rebuilds hidden geometry immediately and keeps visible=false (no lazy deferral in S7)", () => {
    const harness = createHarness();
    harness.sync([makeSurface({ visible: false })]);
    const hiddenNode = harness.nodes.get("surface-1");
    expect(hiddenNode?.visible).toBe(false);

    harness.sync([makeSurface({ visible: false, equation: "x^2 + y^2" })]);
    const rebuilt = harness.nodes.get("surface-1");
    expect(rebuilt).toBeDefined();
    expect(rebuilt).not.toBe(hiddenNode);
    expect(rebuilt?.visible).toBe(false);
    expect(harness.root.children.length).toBe(1);
  });
});

describe("S7-U2-K 2D visibility non-regression", () => {
  const axisPair = getAxisPairSpec("xy");

  it("excludes a hidden curve and includes it again once shown", () => {
    const curve = makeCurve({ xExpr: "t", yExpr: "t", zExpr: "0", tMin: 0, tMax: 1, samples: 8 });
    expect(buildRenderableGraphsFromScene([curve], axisPair).length).toBeGreaterThanOrEqual(1);
    expect(buildRenderableGraphsFromScene([{ ...curve, visible: false }], axisPair)).toEqual([]);
    expect(buildRenderableGraphsFromScene([{ ...curve, visible: true }], axisPair).length).toBeGreaterThanOrEqual(
      1
    );
  });
});

describe("S7-U3 repeated hide/show sequence (stale-visibility guard)", () => {
  it("keeps the same surface node with correct flags across hide, re-sync, and show", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1");
    expect(node?.visible).toBe(true);
    const geometries = collectGeometries(node as Object3D);
    const buildsBefore = vi.mocked(buildSurface).mock.calls.length;

    harness.sync([makeSurface({ visible: false })]);
    expect(harness.nodes.get("surface-1")).toBe(node);
    expect(harness.nodes.get("surface-1")?.visible).toBe(false);

    harness.sync([makeSurface({ visible: false })]);
    expect(harness.nodes.get("surface-1")).toBe(node);
    expect(harness.nodes.get("surface-1")?.visible).toBe(false);

    harness.sync([makeSurface({ visible: true })]);
    const shown = harness.nodes.get("surface-1");
    expect(shown).toBe(node);
    expect(shown?.visible).toBe(true);
    expect(collectGeometries(shown as Object3D)).toEqual(geometries);
    expect(vi.mocked(buildSurface).mock.calls.length - buildsBefore).toBe(0);
    expect(harness.root.children.length).toBe(1);
  });
});

describe("S7-U5 extended visibility sequence (early-out guard)", () => {
  it("holds one surface node stable across hide/resync/show/hide/show with zero work", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1");
    const geometries = collectGeometries(node as Object3D);
    const materials = collectMaterials(node as Object3D);
    const geometrySpies = geometries.map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = materials.map((material) => vi.spyOn(material, "dispose"));
    const buildsBefore = vi.mocked(buildSurface).mock.calls.length;
    const samplesBefore = vi.mocked(sampleSurface).mock.calls.length;

    const expectStable = (visible: boolean) => {
      const current = harness.nodes.get("surface-1");
      expect(current).toBe(node);
      expect(current?.visible).toBe(visible);
      expect(collectGeometries(current as Object3D)).toEqual(geometries);
      expect(collectMaterials(current as Object3D)).toEqual(materials);
      expect(harness.root.children.length).toBe(1);
    };

    harness.sync([makeSurface({ visible: false })]);
    expectStable(false);
    harness.sync([makeSurface({ visible: false })]);
    expectStable(false);
    harness.sync([makeSurface({ visible: true })]);
    expectStable(true);
    harness.sync([makeSurface({ visible: false })]);
    expectStable(false);
    harness.sync([makeSurface({ visible: true })]);
    expectStable(true);

    expect(vi.mocked(buildSurface).mock.calls.length - buildsBefore).toBe(0);
    expect(vi.mocked(sampleSurface).mock.calls.length - samplesBefore).toBe(0);
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("S7-U5 non-renderable transition with visibility interplay", () => {
  it("removes the node without stale state when a hidden surface becomes non-renderable", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1") as Object3D;
    const geometrySpies = collectGeometries(node).map((geometry) => vi.spyOn(geometry, "dispose"));

    harness.sync([makeSurface({ visible: false })]);
    expect(harness.nodes.get("surface-1")).toBe(node);

    harness.sync([makeSurface({ visible: false, equation: "   " })]);
    expect(harness.nodes.has("surface-1")).toBe(false);
    expect(harness.root.children.length).toBe(0);
    // Surface Mesh + edge LineSegments share one BufferGeometry, so traversal
    // disposes the shared instance once per child; assert disposal happened.
    for (const spy of geometrySpies) {
      expect(spy).toHaveBeenCalled();
    }

    harness.sync([makeSurface({ visible: true })]);
    const rebuilt = harness.nodes.get("surface-1");
    expect(rebuilt).toBeDefined();
    expect(rebuilt).not.toBe(node);
    expect(rebuilt?.visible).toBe(true);
    expect(harness.root.children.length).toBe(1);
  });
});

describe("S7-U5 hidden-node deletion sweep", () => {
  it("removes, disposes, and clears caches when a hidden surface is deleted", () => {
    const harness = createHarness();
    harness.sync([makeSurface()]);
    const node = harness.nodes.get("surface-1") as Object3D;
    const geometrySpies = collectGeometries(node).map((geometry) => vi.spyOn(geometry, "dispose"));
    const materialSpies = collectMaterials(node).map((material) => vi.spyOn(material, "dispose"));

    harness.sync([makeSurface({ visible: false })]);
    expect(harness.nodes.get("surface-1")).toBe(node);

    harness.sync([]);
    expect(harness.nodes.has("surface-1")).toBe(false);
    expect(harness.signatures.has("surface-1")).toBe(false);
    expect(harness.structures.has("surface-1")).toBe(false);
    expect(harness.root.children.length).toBe(0);
    // Shared surface geometry is disposed once per sharing child; materials
    // once each. Assert disposal happened without pinning traversal multiplicity.
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).toHaveBeenCalled();
    }
  });
});

describe("S7-U3 signature characterization (fixed behavior)", () => {
  it("visible flip leaves the render signature unchanged", () => {
    expect(getGraphObjectRenderSignature(makeSurface())).toBe(
      getGraphObjectRenderSignature(makeSurface({ visible: false }))
    );
    expect(getGraphObjectRenderSignature(makeCurve())).toBe(
      getGraphObjectRenderSignature(makeCurve({ visible: false }))
    );
    expect(getGraphObjectRenderSignature(makePlane())).toBe(
      getGraphObjectRenderSignature(makePlane({ visible: false }))
    );
  });

  it("visible flip leaves the structure signature unchanged", () => {
    expect(getGraphObjectStructureSignature(makeSurface())).toBe(
      getGraphObjectStructureSignature(makeSurface({ visible: false }))
    );
    expect(getGraphObjectStructureSignature(makeCurve())).toBe(
      getGraphObjectStructureSignature(makeCurve({ visible: false }))
    );
    expect(getGraphObjectStructureSignature(makePlane())).toBe(
      getGraphObjectStructureSignature(makePlane({ visible: false }))
    );
  });

  it("color change affects render signature only", () => {
    expect(getGraphObjectRenderSignature(makeSurface())).not.toBe(
      getGraphObjectRenderSignature(makeSurface({ color: "#ff0000" }))
    );
    expect(getGraphObjectStructureSignature(makeSurface())).toBe(
      getGraphObjectStructureSignature(makeSurface({ color: "#ff0000" }))
    );
  });

  it("geometry change affects the structure signature", () => {
    expect(getGraphObjectStructureSignature(makeSurface())).not.toBe(
      getGraphObjectStructureSignature(makeSurface({ equation: "x^2 + y^2" }))
    );
    expect(getGraphObjectStructureSignature(makeCurve())).not.toBe(
      getGraphObjectStructureSignature(makeCurve({ samples: 64 }))
    );
    expect(getGraphObjectStructureSignature(makePlane())).not.toBe(
      getGraphObjectStructureSignature(makePlane({ size: 10 }))
    );
  });
});
