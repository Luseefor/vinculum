import { beforeEach, describe, expect, it } from "vitest";
import { DirectionalLight, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Object3D, type WebGLRenderer } from "three";
import type { GraphObject, VectorFieldObject2D, VectorFieldObject3D } from "@vinculum/scene/types";
import { createDefaultVectorFieldGraph } from "@vinculum/scene/defaults";
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
import type { GeometryComputeRequest, GeometryComputeResponse } from "@/lib/compute/geometryComputeProtocol";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getVectorFieldInstanceCount } from "@/lib/graph3d/buildGraphVectorField";

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

function makeField3D(overrides: Omit<Partial<VectorFieldObject3D>, "dimension" | "kind"> = {}): GraphObject {
  return {
    ...createDefaultVectorFieldGraph({ id: "vf-1", index: 2, dimension: "3d" }),
    ...overrides
  };
}

function makeField2D(overrides: Omit<Partial<VectorFieldObject2D>, "dimension" | "kind"> = {}): GraphObject {
  return {
    ...createDefaultVectorFieldGraph({ id: "vf-2d", index: 3, dimension: "2d" }),
    ...overrides
  };
}

function fieldResultFor(request: GeometryComputeRequest, magnitude = 2): GeometryComputeResponse {  return {
    requestId: request.requestId,
    objectId: request.objectId,
    generation: request.generation,
    kind: request.kind,
    structure: request.structure,
    result: {
      status: "ok",
      positions: new Float32Array([1, 2, 3]),
      vectors: new Float32Array([2, 0, 0]),
      magnitudes: new Float32Array([magnitude]),
      validCount: 1,
      totalSamples: 1,
      maxMagnitude: Math.max(magnitude, 2)
    }
  };
}

describe("vector field sync integration (S20 Slice 4b)", () => {
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

  const firstShaftLength = (): number => {
    const node = nodes.get("vf-1") as Group;
    const shaft = node.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    shaft.getMatrixAt(0, matrix);
    const scale = new Vector3();
    matrix.decompose(new Vector3(), new Quaternion(), scale);
    return scale.y / 0.7;
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

  it("initial 3D build enqueues one sampling job with no render-only leakage", () => {
    sync([makeField3D()]);
    expect(fake.posted).toHaveLength(1);
    const request = fake.posted[0]!;
    expect(request.kind).toBe("vectorField");
    expect(request.generation).toBe(1);
    if (request.kind === "vectorField") {
      expect(request.payload).toMatchObject({
        dimension: "3d",
        pExpr: "x",
        qExpr: "y",
        rExpr: "z",
        density: 8
      });
      expect(request.payload.domain).toMatchObject({ xMin: -3, zMax: 3 });
      // Render-only sizing never enters the worker payload.
      expect(request.payload).not.toHaveProperty("scale");
      expect(request.payload).not.toHaveProperty("normalize");
      expect(request.payload).not.toHaveProperty("color");
    }
    expect(nodes.has("vf-1")).toBe(false);
    expect(root.children).toHaveLength(0);
  });

  it("component, domain, density, and parameter edits enqueue exactly one job each", () => {
    sync([makeField3D()]);
    expect(fake.posted).toHaveLength(1);
    // Structural edit while gen 1 is in flight: coalesced, not yet posted.
    sync([makeField3D({ pExpr: "-y" })]);
    expect(fake.posted).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(2);
    // Stale gen-1 response frees the worker; the newest (gen 2) posts next.
    fake.respond(fieldResultFor(fake.posted[0]!));
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    fake.respond(fieldResultFor(fake.posted[1]!));

    sync([makeField3D({ pExpr: "-y", domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 } })]);
    expect(fake.posted).toHaveLength(3);
    fake.respond(fieldResultFor(fake.posted[2]!));

    sync([
      makeField3D({
        pExpr: "-y",
        domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 },
        density: 6
      })
    ]);
    expect(fake.posted).toHaveLength(4);
    fake.respond(fieldResultFor(fake.posted[3]!));

    const store = useEditorStore.getState();
    const previous = store.parameters;
    try {
      useEditorStore.setState({
        parameters: previous.map((parameter) =>
          parameter.id === "r" ? { ...parameter, value: 3.5 } : parameter
        )
      });
      sync([
        makeField3D({
          pExpr: "-y",
          domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 },
          density: 6
        })
      ]);
      expect(fake.posted).toHaveLength(5);
      expect(fake.posted[4]!.params).toMatchObject({ r: 3.5 });
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });

  it("color, scale, normalize, visibility, and identical syncs enqueue zero jobs", () => {
    sync([makeField3D()]);
    // Magnitude 1 of reference 2: half-cell glyphs, leaving headroom so the
    // scale toggle below observably doubles lengths (a capped full-cell
    // glyph could not grow further).
    fake.respond(fieldResultFor(fake.posted[0]!, 1));
    const node = nodes.get("vf-1");
    expect(node).toBeDefined();
    expect(getVectorFieldInstanceCount(node as Group)).toBe(1);
    const lengthBefore = firstShaftLength();

    sync([makeField3D({ visible: false })]);
    sync([makeField3D({ visible: false, color: "#f59e0b" })]);
    sync([makeField3D({ visible: true, color: "#f59e0b", scale: 2 })]);
    sync([makeField3D({ visible: true, color: "#f59e0b", scale: 2, normalize: true })]);
    sync([makeField3D({ visible: true, color: "#f59e0b", scale: 2, normalize: true })]);
    expect(fake.posted).toHaveLength(1);

    // Same node throughout; scale doubled the glyph; color applied live.
    expect(nodes.get("vf-1")).toBe(node);
    expect(firstShaftLength()).toBeCloseTo(lengthBefore * 2, 6);
    expect((node as Group).visible).toBe(true);
    expect(useGeometryComputeStore.getState().entries["vf-1"]).toBeUndefined();
  });

  it("invalid component edit removes the node immediately with zero new jobs", () => {
    sync([makeField3D()]);
    fake.respond(fieldResultFor(fake.posted[0]!));
    expect(nodes.has("vf-1")).toBe(true);
    sync([makeField3D({ pExpr: "zzz" })]);
    expect(fake.posted).toHaveLength(1);
    expect(nodes.has("vf-1")).toBe(false);
    expect(root.children).toHaveLength(0);
    expect(manager.getGeneration("vf-1")).toBeNull();
  });

  it("accepted result builds the instanced node with live color", () => {
    sync([makeField3D()]);
    sync([makeField3D({ color: "#f59e0b" })]);
    fake.respond(fieldResultFor(fake.posted[0]!));
    const node = nodes.get("vf-1") as Group;
    expect(node).toBeDefined();
    expect(node.children).toHaveLength(2);
    expect(getVectorFieldInstanceCount(node)).toBe(1);
    expect(root.children).toHaveLength(1);
    const shaft = node.children[0] as InstancedMesh;
    const material = shaft.material as MeshStandardMaterial;
    expect(material.color.getHexString()).toBe("f59e0b");
    expect(useGeometryComputeStore.getState().entries["vf-1"]).toBeUndefined();
  });

  it("stale structure response cannot apply a wrong field", () => {
    sync([makeField3D()]);
    sync([makeField3D({ pExpr: "-y", qExpr: "x", rExpr: "0" })]);
    // Newest coalesced behind the in-flight gen 1.
    expect(fake.posted.map((request) => request.generation)).toEqual([1]);
    // Late gen-1 (radial) response: generation mismatch discards it, and
    // the pump posts the queued gen 2.
    fake.respond(fieldResultFor(fake.posted[0]!));
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    expect(nodes.has("vf-1")).toBe(false);
    // Gen-2 applies.
    fake.respond(fieldResultFor(fake.posted[1]!));
    expect(nodes.has("vf-1")).toBe(true);
  });

  it("deletion race: removed field drops ownership; late result resurrects nothing", () => {
    sync([makeField3D()]);
    sync([]);
    expect(nodes.has("vf-1")).toBe(false);
    expect(useGeometryComputeStore.getState().entries["vf-1"]).toBeUndefined();
    fake.respond(fieldResultFor(fake.posted[0]!));
    expect(root.children).toHaveLength(0);
  });

  it("2D fields never touch the worker and never build 3D nodes", () => {
    sync([makeField2D()]);
    expect(fake.posted).toHaveLength(0);
    expect(nodes.has("vf-2d")).toBe(false);
    expect(root.children).toHaveLength(0);
    sync([makeField2D({ pExpr: "-y", density: 20, scale: 2, normalize: true })]);
    expect(fake.posted).toHaveLength(0);
    expect(root.children).toHaveLength(0);
  });

  it("all-empty 3D field takes the non-renderable path with zero jobs", () => {
    sync([makeField3D({ pExpr: "", qExpr: "", rExpr: "" })]);
    expect(fake.posted).toHaveLength(0);
    expect(nodes.has("vf-1")).toBe(false);
  });

  it("rapid radial->rotation->nonlinear applies only the nonlinear result", () => {
    sync([makeField3D()]);
    sync([makeField3D({ pExpr: "-y", qExpr: "x", rExpr: "0" })]);
    sync([makeField3D({ pExpr: "sin(y)", qExpr: "sin(z)", rExpr: "sin(x)" })]);
    // First posted immediately; intermediates coalesced away, newest queued.
    expect(fake.posted.map((request) => request.generation)).toEqual([1]);
    expect(manager.getPendingCount()).toBe(2);
    // Late radial response discarded; the pump posts the queued nonlinear.
    fake.respond(fieldResultFor(fake.posted[0]!));
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 3]);
    expect(nodes.has("vf-1")).toBe(false);
    // Newest applies exactly once.
    fake.respond(fieldResultFor(fake.posted[1]!));
    const node = nodes.get("vf-1") as Group;
    expect(node).toBeDefined();
    expect(getVectorFieldInstanceCount(node)).toBe(1);
    expect(useGeometryComputeStore.getState().entries["vf-1"]).toBeUndefined();
  });

  it("deferred pre-sync window: a response arriving before the next sync cannot apply a wrong mesh (S20-R12)", () => {
    sync([makeField3D()]);
    // Store update lands (same id, different math) with NO sync yet — the
    // pre-rAF window. The gen-1 response arrives inside that window.
    useGraphStore.getState().replaceSceneDocument(
      createSceneDocument({ objects: [makeField3D({ pExpr: "-y", qExpr: "x", rExpr: "0" })] })
    );
    // Manager accepts (generation still current) but the applier recomputes
    // the live rotation structure, mismatches the echoed radial structure,
    // and discards: no node created.
    fake.respond(fieldResultFor(fake.posted[0]!));
    expect(nodes.has("vf-1")).toBe(false);
    // The next sync sees the new math and enqueues gen 2; it applies cleanly.
    sync([makeField3D({ pExpr: "-y", qExpr: "x", rExpr: "0" })]);
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    fake.respond(fieldResultFor(fake.posted[1]!));
    expect(nodes.has("vf-1")).toBe(true);
    expect(useGeometryComputeStore.getState().entries["vf-1"]).toBeUndefined();
  });

  it("same-id surface-to-field switch ignores the stale surface result (S20-R12)", () => {
    const surface = { ...createImplicitSurfaceGraph({ equation: "x^2 + y^2 + z^2 = 1" }), id: "vf-1" };
    sync([surface]);
    sync([makeField3D()]);
    // Surface gen 1 in flight, field gen 2 queued behind it.
    expect(fake.posted.map((request) => request.generation)).toEqual([1]);
    // Late surface response: generation mismatch discards it at the
    // manager, and the pump posts the queued field job.
    fake.respond({
      requestId: fake.posted[0]!.requestId,
      objectId: fake.posted[0]!.objectId,
      generation: fake.posted[0]!.generation,
      kind: fake.posted[0]!.kind,
      structure: fake.posted[0]!.structure,
      result: {
        status: "ok",
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint16Array([0, 1, 2]),
        vertexCount: 3,
        triangleCount: 1,
        rejectedTriangles: 0
      }
    });
    expect(fake.posted.map((request) => request.generation)).toEqual([1, 2]);
    expect(fake.posted[1]!.kind).toBe("vectorField");
    expect(nodes.has("vf-1")).toBe(false);
    // Field result builds the instanced node (never a surface mesh).
    fake.respond(fieldResultFor(fake.posted[1]!));
    const node = nodes.get("vf-1") as Group;
    expect(node).toBeDefined();
    expect(node.children).toHaveLength(2);
    expect(getVectorFieldInstanceCount(node)).toBe(1);
  });
});
