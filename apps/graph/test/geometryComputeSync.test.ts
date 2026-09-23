import { beforeEach, describe, expect, it } from "vitest";
import { DirectionalLight, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import type { GraphObject, ImplicitSurfaceObject, ParametricSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { syncThreeSceneObjects } from "@/lib/graph3d/graphThreeSyncSceneObjects";
import {
  applyGeometryComputeResult,
  type GeometryComputeSyncContext
} from "@/lib/compute/geometryComputeSync";
import {
  createGeometryComputeManager,
  type GeometryComputeManager,
  type GeometryWorkerTransport
} from "@/lib/compute/geometryComputeManager";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import type { GeometryComputeRequest } from "@/lib/compute/geometryComputeProtocol";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

interface FakeTransport extends GeometryWorkerTransport {
  posted: GeometryComputeRequest[];
  respond: (response: unknown) => void;
}

function createFakeTransport(): FakeTransport {
  let responseHandler: ((response: unknown) => void) | null = null;
  const fake: FakeTransport = {
    posted: [],
    postRequest: (request) => {
      fake.posted.push(request);
    },
    setOnResponse: (handler) => {
      responseHandler = handler;
    },
    setOnError: () => {},
    terminate: () => {},
    respond: (response: unknown) => {
      responseHandler?.(response);
    }
  };
  return fake;
}

function makeImplicit(overrides: Partial<ImplicitSurfaceObject> = {}): ImplicitSurfaceObject {
  return {
    id: "implicit-1",
    kind: "implicitSurface",
    color: "#3b82f6",
    visible: true,
    equation: "x^2 + y^2 + z^2 = 1",
    domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
    resolution: 16,
    appearance: { wireframe: false },
    ...overrides
  };
}

function makeParametric(overrides: Partial<ParametricSurfaceObject> = {}): ParametricSurfaceObject {
  return {
    id: "parametric-1",
    kind: "parametricSurface",
    color: "#3b82f6",
    visible: true,
    xExpr: "sin(u) * cos(v)",
    yExpr: "sin(u) * sin(v)",
    zExpr: "cos(u)",
    domain: { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI },
    resolution: 16,
    appearance: { wireframe: false },
    ...overrides
  };
}

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

function okResultFor(request: GeometryComputeRequest, radius = 1) {
  // Minimal valid mesh: single triangle on a shell of the given radius.
  const s = radius;
  return {
    requestId: request.requestId,
    objectId: request.objectId,
    generation: request.generation,
    kind: request.kind,
    structure: request.structure,
    result: {
      status: "ok" as const,
      positions: new Float32Array([s, 0, 0, 0, s, 0, 0, 0, s]),
      indices: new Uint16Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      rejectedTriangles: 0
    }
  };
}

function meshNodeFor(root: Group, id: string): Object3D | undefined {
  return root.children.find((child) => child.userData.vinculumId === id);
}

function meshColorHex(node: Object3D): string | null {
  let found: string | null = null;
  node.traverse((child) => {
    if (found === null && child instanceof Mesh) {
      const material = child.material as { color?: { getHexString?: () => string } };
      const hex = material.color?.getHexString?.();
      if (typeof hex === "string") {
        found = hex;
      }
    }
  });
  return found;
}

describe("workerized sync integration (PART 32 job matrix)", () => {
  let fake: FakeTransport;
  let manager: GeometryComputeManager;
  let root: Group;
  let nodes: Map<string, Object3D>;
  let signatures: Map<string, string>;
  let structures: Map<string, string>;
  let ctx: GeometryComputeSyncContext;

  const sync = (objects: GraphObject[]) => {
    useGraphStore.getState().replaceSceneDocument(createSceneDocument({ objects }));
    syncThreeSceneObjects(
      "dark",
      objects,
      root,
      nodes,
      signatures,
      structures,
      new DirectionalLight(),
      { shadowMap: {} } as unknown as WebGLRenderer,
      manager,
      () => "dark"
    );
  };

  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGeometryComputeStore.getState().clearAll();
    fake = createFakeTransport();
    root = new Group();
    nodes = new Map();
    signatures = new Map();
    structures = new Map();
    manager = createGeometryComputeManager({
      createTransport: () => fake,
      onResult: (response) => {
        applyGeometryComputeResult(response, ctx);
      }
    });
    ctx = {
      objectsRoot: root,
      objectNodes: nodes,
      objectSignatures: signatures,
      objectStructureSignatures: structures,
      getTheme: () => "dark",
      manager
    };
  });

  it("initial implicit build enqueues one job and keeps no node until the result", () => {
    sync([makeImplicit()]);
    expect(fake.posted).toHaveLength(1);
    expect(nodes.has("implicit-1")).toBe(false);
    expect(useGeometryComputeStore.getState().entries["implicit-1"]?.status).toBe("pending");
    fake.respond(okResultFor(fake.posted[0]!));
    expect(meshNodeFor(root, "implicit-1")).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("visibility-only change enqueues zero jobs and reuses the node", () => {
    sync([makeImplicit()]);
    fake.respond(okResultFor(fake.posted[0]!));
    const node = nodes.get("implicit-1");
    const postedBefore = fake.posted.length;
    sync([makeImplicit({ visible: false })]);
    expect(fake.posted).toHaveLength(postedBefore);
    expect(nodes.get("implicit-1")).toBe(node);
    expect(node?.visible).toBe(false);
  });

  it("color-only change enqueues zero jobs and recolors in place", () => {
    sync([makeImplicit()]);
    fake.respond(okResultFor(fake.posted[0]!));
    const node = nodes.get("implicit-1");
    const postedBefore = fake.posted.length;
    sync([makeImplicit({ color: "#f59e0b" })]);
    expect(fake.posted).toHaveLength(postedBefore);
    expect(nodes.get("implicit-1")).toBe(node);
    expect(meshColorHex(node!)).toBe("f59e0b");
  });

  it("equation/domain/resolution changes enqueue new generations and keep prior nodes until results", () => {
    sync([makeImplicit()]);
    expect(fake.posted).toHaveLength(1);
    expect(nodes.has("implicit-1")).toBe(false);
    // Structural edit while gen 1 is in flight: coalesced, not yet posted.
    sync([makeImplicit({ equation: "x^2 + y^2 + z^2 = 4" })]);
    expect(fake.posted).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(2);
    expect(nodes.has("implicit-1")).toBe(false);
    // Stale gen-1 response frees the worker; the newest (gen 2) posts next.
    fake.respond(okResultFor(fake.posted[0]!));
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    // Newest applies and creates the node.
    fake.respond(okResultFor(fake.posted[1]!));
    const node = nodes.get("implicit-1");
    expect(node).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
    // Domain edit on the settled node enqueues immediately (worker free).
    sync([{ ...makeImplicit({ equation: "x^2 + y^2 + z^2 = 4" }), domain: { ...makeImplicit().domain, xMax: 2 } }]);
    expect(fake.posted).toHaveLength(3);
    expect(nodes.get("implicit-1")).toBe(node);
    fake.respond(okResultFor(fake.posted[2]!));
    // Resolution edit likewise.
    sync([
      {
        ...makeImplicit({ equation: "x^2 + y^2 + z^2 = 4", domain: { ...makeImplicit().domain, xMax: 2 } }),
        resolution: 24
      }
    ]);
    expect(fake.posted).toHaveLength(4);
    expect(root.children.filter((child) => child.userData.vinculumId === "implicit-1")).toHaveLength(1);
  });

  it("identical repeated syncs (view/layout/camera) enqueue zero jobs", () => {
    const object = makeImplicit();
    sync([object]);
    fake.respond(okResultFor(fake.posted[0]!));
    const postedBefore = fake.posted.length;
    sync([object]);
    sync([{ ...object }]);
    sync([object]);
    expect(fake.posted).toHaveLength(postedBefore);
  });

  it("explicit surfaces stay on the synchronous path (zero jobs)", () => {
    sync([makeSurface()]);
    expect(fake.posted).toHaveLength(0);
    expect(meshNodeFor(root, "surface-1")).toBeDefined();
    const node = nodes.get("surface-1");
    sync([makeSurface({ equation: "cos(x) * sin(y)" })]);
    expect(fake.posted).toHaveLength(0);
    expect(nodes.get("surface-1")).not.toBe(node);
    expect(meshNodeFor(root, "surface-1")).toBeDefined();
  });

  it("invalid equation edit removes the node immediately with zero jobs", () => {
    sync([makeImplicit()]);
    fake.respond(okResultFor(fake.posted[0]!));
    expect(meshNodeFor(root, "implicit-1")).toBeDefined();
    sync([makeImplicit({ equation: "sin(factorial(x))" })]);
    expect(fake.posted).toHaveLength(1);
    expect(meshNodeFor(root, "implicit-1")).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("accepted result swaps the mesh and applies live color", () => {
    sync([makeImplicit()]);
    fake.respond(okResultFor(fake.posted[0]!));
    const firstNode = nodes.get("implicit-1");
    expect(meshColorHex(firstNode!)).toBe("3b82f6");
    // Recolor while the rebuild is pending; the accepted mesh uses it.
    sync([makeImplicit({ equation: "x^2 + y^2 + z^2 = 4", color: "#f59e0b" })]);
    fake.respond(okResultFor(fake.posted[1]!));
    const nextNode = nodes.get("implicit-1");
    expect(nextNode).not.toBe(firstNode);
    expect(meshColorHex(nextNode!)).toBe("f59e0b");
    expect(root.children.filter((child) => child.userData.vinculumId === "implicit-1")).toHaveLength(1);
  });

  it("rapid sphere→torus→gyroid→ellipsoid applies only the ellipsoid (PART 23)", () => {
    sync([makeImplicit()]);
    sync([makeImplicit({ equation: "(x^2 + y^2 + z^2 + 3.75)^2 - 16 * (x^2 + y^2) = 0" })]);
    sync([makeImplicit({ equation: "sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0" })]);
    sync([makeImplicit({ equation: "(x - 1)^2 / 4 + (y + 2)^2 + (z - 0.5)^2 / 9 = 1" })]);
    // First posted immediately; intermediates coalesced away, newest queued.
    expect(fake.posted.map((request) => request.generation)).toEqual([1]);
    expect(manager.getPendingCount()).toBe(2);
    // Out-of-order storm: every stale response discarded, newest survives.
    fake.respond(okResultFor(fake.posted[0]!));
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 4]);
    expect(nodes.has("implicit-1")).toBe(false);
    // Newest applies.
    fake.respond(okResultFor(fake.posted[1]!));
    expect(meshNodeFor(root, "implicit-1")).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("undo race: late gyroid result cannot overwrite the restored sphere (PART 22)", () => {
    const sphere = makeImplicit();
    sync([sphere]);
    fake.respond(okResultFor(fake.posted[0]!));
    const sphereNode = nodes.get("implicit-1");
    expect(sphereNode).toBeDefined();
    // Edit to gyroid (gen 2 in flight), then undo back to sphere (gen 3 queued).
    sync([makeImplicit({ equation: "sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0" })]);
    sync([sphere]);
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    // Late gyroid result discarded; the restored sphere node is untouched.
    fake.respond(okResultFor(fake.posted[1]!));
    expect(nodes.get("implicit-1")).toBe(sphereNode);
    expect(useGeometryComputeStore.getState().entries["implicit-1"]?.status).toBe("pending");
    // Queued sphere job posts and applies, replacing like with like.
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2, 3]);
    fake.respond(okResultFor(fake.posted[2]!));
    expect(meshNodeFor(root, "implicit-1")).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("deletion race: removed object drops ownership; late result resurrects nothing (PART 20)", () => {
    sync([makeImplicit()]);
    sync([]);
    expect(nodes.has("implicit-1")).toBe(false);
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
    fake.respond(okResultFor(fake.posted[0]!));
    expect(meshNodeFor(root, "implicit-1")).toBeUndefined();
    expect(root.children).toHaveLength(0);
  });

  it("multi-object jobs route correctly; deleting one spares the other (PART 24)", () => {
    const a = makeImplicit({ id: "implicit-a" });
    const b = makeImplicit({ id: "implicit-b", equation: "x^2 + y^2 + z^2 = 4" });
    sync([a, b]);
    // Single worker: A in flight, B queued.
    expect(fake.posted).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(2);
    fake.respond(okResultFor(fake.posted[0]!));
    expect(meshNodeFor(root, "implicit-a")).toBeDefined();
    // B's job posts after A completes; both resolve independently.
    expect(fake.posted).toHaveLength(2);
    fake.respond(okResultFor(fake.posted[1]!));
    expect(meshNodeFor(root, "implicit-b")).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-a"]).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["implicit-b"]).toBeUndefined();
    // Deleting B drops its ownership without touching A.
    sync([a]);
    expect(meshNodeFor(root, "implicit-b")).toBeUndefined();
    expect(meshNodeFor(root, "implicit-a")).toBeDefined();
    expect(manager.getGeneration("implicit-b")).toBeNull();
    expect(fake.posted).toHaveLength(2);
  });

  it("empty result removes the node without errors", () => {
    sync([makeImplicit()]);
    fake.respond({ ...okResultFor(fake.posted[0]!), result: { status: "empty" } });
    expect(meshNodeFor(root, "implicit-1")).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("error and budget results remove the node and set error status", () => {
    sync([makeImplicit()]);
    fake.respond({ ...okResultFor(fake.posted[0]!), result: { status: "error", error: "bad math" } });
    expect(meshNodeFor(root, "implicit-1")).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]?.status).toBe("error");

    sync([makeImplicit({ equation: "x^2 + y^2 + z^2 = 4" })]);
    fake.respond({ ...okResultFor(fake.posted[1]!), result: { status: "budget-exceeded" } });
    expect(useGeometryComputeStore.getState().entries["implicit-1"]?.status).toBe("error");
  });

  it("relevant parameter change enqueues exactly one job", () => {
    const store = useEditorStore.getState();
    const previous = store.parameters;
    try {
      useEditorStore.setState({
        parameters: previous.map((parameter) =>
          parameter.id === "r" ? { ...parameter, value: 3.5 } : parameter
        )
      });
      sync([makeImplicit({ equation: "x^2 + y^2 + z^2 = r^2" })]);
      expect(fake.posted).toHaveLength(1);
      expect(fake.posted[0]!.params).toMatchObject({ r: 3.5 });
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });

  it("parametric surfaces compute asynchronously with shared-node semantics", () => {
    sync([makeParametric()]);
    expect(fake.posted).toHaveLength(1);
    expect(fake.posted[0]!.kind).toBe("parametricSurface");
    expect(nodes.has("parametric-1")).toBe(false);
    fake.respond(okResultFor(fake.posted[0]!));
    expect(meshNodeFor(root, "parametric-1")).toBeDefined();
    // Visibility-only change stays job-free.
    sync([makeParametric({ visible: false })]);
    expect(fake.posted).toHaveLength(1);
    expect(nodes.get("parametric-1")?.visible).toBe(false);
  });

  it("empty parametric expressions take the non-renderable path with zero jobs", () => {
    sync([makeParametric({ xExpr: "", yExpr: "", zExpr: "" })]);
    expect(fake.posted).toHaveLength(0);
    expect(meshNodeFor(root, "parametric-1")).toBeUndefined();
  });

  it("deferred-sync race: response arriving before the next sync cannot apply a wrong mesh (I1)", () => {
    sync([makeImplicit()]);
    // Store update lands (same id, different math) with NO sync yet — the
    // pre-rAF window. The gen-1 response arrives inside that window.
    useGraphStore.getState().replaceSceneDocument(
      createSceneDocument({ objects: [makeImplicit({ equation: "x^2 + y^2 + z^2 = 4" })] })
    );
    fake.respond(okResultFor(fake.posted[0]!));
    // Live structure no longer matches: discarded, no node created.
    expect(meshNodeFor(root, "implicit-1")).toBeUndefined();
    expect(nodes.has("implicit-1")).toBe(false);
    // The next sync sees the new math and enqueues gen 2; it applies cleanly.
    sync([makeImplicit({ equation: "x^2 + y^2 + z^2 = 4" })]);
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    fake.respond(okResultFor(fake.posted[1]!, 2));
    expect(meshNodeFor(root, "implicit-1")).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("same-id kind switch ignores the stale worker result", () => {
    sync([makeImplicit()]);
    // Swap the implicit for a synchronous surface under the same id.
    sync([makeSurface({ id: "implicit-1" })]);
    const surfaceNode = nodes.get("implicit-1");
    expect(surfaceNode).toBeDefined();
    // The stale implicit gen-1 response is accepted by the manager
    // (generation still current) but the applier sees a live surface and
    // returns early: the sync-built node is untouched.
    fake.respond(okResultFor(fake.posted[0]!));
    expect(nodes.get("implicit-1")).toBe(surfaceNode);
    expect(meshNodeFor(root, "implicit-1")).toBeDefined();
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });

  it("full replacement (different ids) while in flight swaps cleanly", () => {
    sync([makeImplicit({ id: "old-1" })]);
    sync([makeImplicit({ id: "new-1" })]);
    // Old job in flight, new job queued; the old node was never built.
    expect(fake.posted.map((request) => request.objectId)).toEqual(["old-1"]);
    // Stale old response discarded (ownership dropped); the pump posts new.
    fake.respond(okResultFor(fake.posted[0]!));
    expect(fake.posted.map((request) => request.objectId)).toEqual(["old-1", "new-1"]);
    expect(meshNodeFor(root, "old-1")).toBeUndefined();
    fake.respond(okResultFor(fake.posted[1]!));
    expect(meshNodeFor(root, "new-1")).toBeDefined();
    expect(meshNodeFor(root, "old-1")).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["old-1"]).toBeUndefined();
    expect(useGeometryComputeStore.getState().entries["new-1"]).toBeUndefined();
  });

  it("no-job paths leave no status entry behind", () => {
    const object = makeImplicit();
    sync([object]);
    fake.respond(okResultFor(fake.posted[0]!));
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
    sync([{ ...object, visible: false }]);
    sync([{ ...object, color: "#f59e0b" }]);
    sync([{ ...object }]);
    expect(fake.posted).toHaveLength(1);
    expect(useGeometryComputeStore.getState().entries["implicit-1"]).toBeUndefined();
  });
});
