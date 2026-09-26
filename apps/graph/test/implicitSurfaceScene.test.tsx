import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DirectionalLight, Group, Mesh, Object3D, type WebGLRenderer } from "three";
import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { buildImplicitSurface } from "@/lib/graph3d/buildGraphImplicitSurface";
import { syncThreeSceneObjects } from "@/lib/graph3d/graphThreeSyncSceneObjects";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/graphObject3dSignatures";
import { isGraphObjectRenderable3D, sceneHasVisibleSurface } from "@/lib/graph3d/graphObject3dGuards";
import { toGraphObjectRenderDescriptor } from "@/lib/graph3d/renderDescriptors";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { createSceneDocument, CURRENT_SCENE_SCHEMA_VERSION, cloneGraphObject } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";
import { export2dSvg } from "@/lib/export/sceneExport";
import { createValidatedSceneExample, getSceneExampleById } from "@/lib/templates/examplesRegistry";
import { computeScenePressureFromObjects } from "@/lib/performance/performanceMetrics";
import { useHistoryStore } from "@/lib/store/historyStore";
import type { SceneSnapshot } from "@/lib/types/scene";
import type { GraphObject, ImplicitSurfaceObject } from "@vinculum/scene/types";
import { isGraphObjectWithoutExpressions } from "@/store/graphStoreObjectFactory";
import { updateImplicitSurfaceField } from "@/store/graphStoreImplicitSurfaceField";
import { buildImplicitSurface as buildImplicitSurfaceSpy } from "@/lib/graph3d/buildGraphImplicitSurface";
import { sampleImplicitScalarField as sampleImplicitScalarFieldSpy } from "@/lib/math/sampleImplicitField";
import { parseGraphObjectKind } from "@/lib/graph/graphObjectKind";
import { getObjectRowDisplayMeta, isExpressionRowEmpty } from "@/components/objects/objectRowUtils";
import GraphTypeSelector from "@/components/expressions/GraphTypeSelector";
import { moreAddDescriptors, quickAddDescriptors } from "@/lib/objects/objectDescriptors";

// Call-through spies: count builder/sampler invocations without changing behavior.
vi.mock("@/lib/graph3d/buildGraphImplicitSurface", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/graph3d/buildGraphImplicitSurface")>();
  return { ...mod, buildImplicitSurface: vi.fn(mod.buildImplicitSurface) };
});
vi.mock("@/lib/math/sampleImplicitField", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/math/sampleImplicitField")>();
  return { ...mod, sampleImplicitScalarField: vi.fn(mod.sampleImplicitScalarField) };
});

function makeImplicit(overrides: Partial<ImplicitSurfaceObject> = {}): ImplicitSurfaceObject {
  return {
    ...createImplicitSurfaceGraph({
      equation: "x^2 + y^2 + z^2 = 1",
      domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
      resolution: 16
    }),
    ...overrides
  };
}

function withEnvelope(objects: unknown): string {
  return JSON.stringify({
    schemaVersion: 1,
    version: "1.0",
    metadata: {
      name: "t",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    },
    objects,
    measurements: []
  });
}

function createHarness() {
  const harness = {
    root: new Group(),
    nodes: new Map<string, Object3D>(),
    signatures: new Map<string, string>(),
    structures: new Map<string, string>(),
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

describe("parseImplicitSurfaceObject", () => {
  it("parses a valid implicit surface document", () => {
    const result = deserializeScene(
      withEnvelope([
        {
          id: "is-1",
          kind: "implicitSurface",
          color: "#3b82f6",
          visible: true,
          equation: "x^2 + y^2 + z^2 = 1",
          domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
          resolution: 32,
          appearance: { wireframe: false }
        }
      ])
    );
    expect(result.valid).toBe(true);
    const object = result.normalizedScene?.objects[0];
    expect(object?.kind).toBe("implicitSurface");
    if (object?.kind === "implicitSurface") {
      expect(object.domain).toEqual({ xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 });
      expect(object.resolution).toBe(32);
    }
  });

  it("rejects missing domain axes, bad resolution, unsafe and malformed equations", () => {
    const base = {
      id: "is-1",
      kind: "implicitSurface",
      color: "#3b82f6",
      visible: true,
      equation: "x^2 + y^2 + z^2 = 1",
      domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
      resolution: 24,
      appearance: { wireframe: false }
    };
    const missingAxis = deserializeScene(withEnvelope([{ ...base, domain: { ...base.domain, zMin: undefined } }]));
    expect(missingAxis.valid).toBe(false);

    const badResolution = deserializeScene(withEnvelope([{ ...base, resolution: 512 }]));
    expect(badResolution.valid).toBe(false);

    const unsafe = deserializeScene(
      withEnvelope([{ ...base, equation: "sin(factorial(x)) + y + z = 0" }])
    );
    expect(unsafe.valid).toBe(false);

    const chained = deserializeScene(withEnvelope([{ ...base, equation: "x = y = z" }]));
    expect(chained.valid).toBe(false);

    const unknownKind = deserializeScene(withEnvelope([{ ...base, kind: "implicitVolume" }]));
    expect(unknownKind.valid).toBe(false);
  });

  it("allows empty equations (editable-but-unrendered, like curves)", () => {
    const result = deserializeScene(
      withEnvelope([
        {
          id: "is-empty",
          kind: "implicitSurface",
          color: "#3b82f6",
          visible: true,
          equation: "",
          domain: { xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1 },
          resolution: 24,
          appearance: { wireframe: false }
        }
      ])
    );
    expect(result.valid).toBe(true);
  });

  it("still loads legacy v1 scenes without the new kind (no version bump)", () => {
    const result = deserializeScene(
      withEnvelope([createSurfaceGraph({ equation: "z - x^2" })])
    );
    expect(result.valid).toBe(true);
    expect(result.normalizedScene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(CURRENT_SCENE_SCHEMA_VERSION).toBe(1);
  });
});

describe("implicit surface persistence", () => {
  it("round-trips the raw equality string exactly (no lhs-rhs rewrite)", () => {
    const scene = createSceneDocument({ objects: [makeImplicit()] });
    const parsed = deserializeScene(serializeScene(scene));
    expect(parsed.valid).toBe(true);
    const object = parsed.normalizedScene?.objects[0];
    expect(object).toEqual(scene.objects[0]);
    if (object?.kind === "implicitSurface") {
      expect(object.equation).toBe("x^2 + y^2 + z^2 = 1");
    }
  });

  it("round-trips through share-link encode/decode", () => {
    const scene = createSceneDocument({ objects: [makeImplicit()] });
    const built = buildShareSceneUrl({ scene, baseUrl: "https://example.com/" });
    expect(built.ok).toBe(true);
    const payload = new URL(built.url!).searchParams.get("scene") ?? "";
    const decoded = decodeSharedScenePayload(payload);
    expect(decoded.ok).toBe(true);
    const object = decoded.scene?.objects[0];
    expect(object?.kind).toBe("implicitSurface");
    if (object?.kind === "implicitSurface") {
      expect(object.equation).toBe("x^2 + y^2 + z^2 = 1");
      expect(object.domain.zMax).toBe(1.5);
      expect(object.resolution).toBe(16);
    }
  });

  it("deep-clones domain and appearance", () => {
    const original = makeImplicit();
    const cloned = cloneGraphObject(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    if (cloned.kind === "implicitSurface") {
      expect(cloned.domain).not.toBe(original.domain);
      expect(cloned.appearance).not.toBe(original.appearance);
    }
  });

  it("warns (never silently drops) implicit surfaces in 2D SVG export", async () => {
    const scene = createSceneDocument({ objects: [makeImplicit()] });
    const result = export2dSvg({
      sceneName: scene.metadata.name,
      objects: scene.objects,
      axisPair: "xy",
      viewport: { centerX: 0, centerY: 0, scale: 80 },
      viewportFrame: { width: 800, height: 600 }
    });
    expect(result.ok).toBe(true);
    expect(result.file?.warnings?.some((warning) => warning.includes("not yet represented"))).toBe(true);
    const svg = await result.file!.blob.text();
    expect(svg).toContain("<svg");
  });
});

describe("implicit surface examples", () => {
  it.each(["implicit-sphere", "implicit-ellipsoid", "implicit-torus", "implicit-gyroid"])(
    "validates example %s through the canonical round-trip",
    (id) => {
      const example = getSceneExampleById(id);
      expect(example).not.toBeNull();
      const validated = createValidatedSceneExample(example!);
      expect(validated.ok).toBe(true);
    }
  );
});

describe("implicit surface render descriptors (S7/S16)", () => {
  it("carries equation, 3D domain, resolution, and appearance in the payload", () => {
    const descriptor = toGraphObjectRenderDescriptor(makeImplicit());
    expect(descriptor.payload).toMatchObject({
      equation: "x^2 + y^2 + z^2 = 1",
      domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
      resolution: 16,
      appearance: { wireframe: false }
    });
  });

  it("ignores visibility-only changes in both signatures", () => {
    const visible = makeImplicit();
    const hidden: ImplicitSurfaceObject = { ...visible, visible: false };
    expect(getGraphObjectRenderSignature(hidden)).toBe(getGraphObjectRenderSignature(visible));
    expect(getGraphObjectStructureSignature(hidden)).toBe(getGraphObjectStructureSignature(visible));
  });

  it("treats color as presentation-only (structure signature stable)", () => {
    const a = makeImplicit();
    const b: ImplicitSurfaceObject = { ...a, color: "#f59e0b" };
    expect(getGraphObjectRenderSignature(a)).not.toBe(getGraphObjectRenderSignature(b));
    expect(getGraphObjectStructureSignature(a)).toBe(getGraphObjectStructureSignature(b));
  });

  it("rebuilds on equation, domain, and resolution changes", () => {
    const base = makeImplicit();
    expect(getGraphObjectStructureSignature({ ...base, equation: "x^2 + y^2 + z^2 = 4" })).not.toBe(
      getGraphObjectStructureSignature(base)
    );
    expect(
      getGraphObjectStructureSignature({ ...base, domain: { ...base.domain, xMax: 2 } })
    ).not.toBe(getGraphObjectStructureSignature(base));
    expect(getGraphObjectStructureSignature({ ...base, resolution: 24 })).not.toBe(
      getGraphObjectStructureSignature(base)
    );
  });
});

describe("buildImplicitSurface", () => {
  it("builds one mesh group for the sphere", () => {
    const object = makeImplicit();
    const group = buildImplicitSurface(object, "dark", getGraphThemeTokens("dark"));
    expect(group).toBeInstanceOf(Group);
    const meshes = group!.children.filter((child) => child instanceof Mesh);
    expect(meshes).toHaveLength(1);
    expect(group!.userData.vinculumId).toBe(object.id);
  });

  it("returns null for empty, error, no-surface, and constant-zero objects", () => {
    const tokens = getGraphThemeTokens("dark");
    expect(buildImplicitSurface(makeImplicit({ equation: "" }), "dark", tokens)).toBeNull();
    expect(
      buildImplicitSurface(makeImplicit({ equation: "sin(factorial(x)) + y + z = 0" }), "dark", tokens)
    ).toBeNull();
    expect(buildImplicitSurface(makeImplicit({ equation: "1" }), "dark", tokens)).toBeNull();
    expect(buildImplicitSurface(makeImplicit({ equation: "0" }), "dark", tokens)).toBeNull();
  });

  it("omits the edge overlay in wireframe mode", () => {
    const tokens = getGraphThemeTokens("dark");
    const solid = buildImplicitSurface(makeImplicit(), "dark", tokens);
    const wire = buildImplicitSurface(makeImplicit({ appearance: { wireframe: true } }), "dark", tokens);
    expect(solid!.children.length).toBe(2);
    expect(wire!.children.length).toBe(1);
  });

  it("renders the singular field safely with finite geometry", () => {
    const tokens = getGraphThemeTokens("dark");
    const group = buildImplicitSurface(
      makeImplicit({
        equation: "1 / x",
        domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }
      }),
      "dark",
      tokens
    );
    // 1/x has no zero set: valid empty state, editable, no crash.
    expect(group).toBeNull();
  });
});

describe("implicit surface sync regressions (S7/S16/PART 46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("visibility toggle adds zero builds and zero scalar samples", () => {
    const harness = createHarness();
    const object = makeImplicit();
    harness.sync([object]);
    const buildsBefore = vi.mocked(buildImplicitSurfaceSpy).mock.calls.length;
    const samplesBefore = vi.mocked(sampleImplicitScalarFieldSpy).mock.calls.length;

    harness.sync([{ ...object, visible: false }]);
    expect(vi.mocked(buildImplicitSurfaceSpy).mock.calls.length - buildsBefore).toBe(0);
    expect(vi.mocked(sampleImplicitScalarFieldSpy).mock.calls.length - samplesBefore).toBe(0);
    const node = harness.nodes.get(object.id);
    expect(node?.visible).toBe(false);
  });

  it("color change reuses the node without resampling", () => {
    const harness = createHarness();
    const object = makeImplicit();
    harness.sync([object]);
    const node = harness.nodes.get(object.id);
    const samplesBefore = vi.mocked(sampleImplicitScalarFieldSpy).mock.calls.length;

    harness.sync([{ ...object, color: "#f59e0b" }]);
    expect(harness.nodes.get(object.id)).toBe(node);
    expect(vi.mocked(sampleImplicitScalarFieldSpy).mock.calls.length - samplesBefore).toBe(0);
  });

  it("equation change replaces the node (resample expected)", () => {
    const harness = createHarness();
    const object = makeImplicit();
    harness.sync([object]);
    const oldNode = harness.nodes.get(object.id);
    const buildsBefore = vi.mocked(buildImplicitSurfaceSpy).mock.calls.length;

    harness.sync([{ ...object, equation: "x^2 + y^2 + z^2 = 4" }]);
    expect(vi.mocked(buildImplicitSurfaceSpy).mock.calls.length - buildsBefore).toBe(1);
    expect(harness.nodes.get(object.id)).not.toBe(oldNode);
  });

  it("shares one node across repeated syncs (S16 single-mesh model)", () => {
    const harness = createHarness();
    const object = makeImplicit();
    harness.sync([object]);
    const node = harness.nodes.get(object.id);
    harness.sync([object]);
    harness.sync([object]);
    expect(harness.nodes.get(object.id)).toBe(node);
    expect(harness.root.children).toHaveLength(1);
  });
});

describe("implicit surface guards and pressure", () => {
  it("is renderable with any non-empty equation", () => {
    expect(isGraphObjectRenderable3D(makeImplicit())).toBe(true);
    expect(isGraphObjectRenderable3D(makeImplicit({ equation: "  " }))).toBe(false);
  });

  it("counts toward visible-surface shadows", () => {
    expect(sceneHasVisibleSurface([makeImplicit()])).toBe(true);
    expect(sceneHasVisibleSurface([makeImplicit({ visible: false })])).toBe(false);
  });

  it("feeds the surface-resolution pressure metric", () => {
    const pressure = computeScenePressureFromObjects([makeImplicit({ resolution: 48 })]);
    expect(pressure.surfaceResolutionMax).toBe(48);
  });

  it("warns on implicit resolution alone via the volumetric cap", () => {
    // 48/48 = 1.0 pressure even though 48/128 would read quiet.
    const maxed = computeScenePressureFromObjects([makeImplicit({ resolution: 48 })]);
    expect(maxed.surfaceResolutionPressure).toBeCloseTo(1, 9);
    // Default 32 reads 32/48 below the 0.75 warning line.
    const normal = computeScenePressureFromObjects([makeImplicit({ resolution: 32 })]);
    expect(normal.surfaceResolutionPressure).toBeLessThan(0.75);
  });
});

describe("implicit surface store semantics", () => {
  it("creates the default sphere field", () => {
    const created = createImplicitSurfaceGraph({ id: "is-default" });
    expect(created.kind).toBe("implicitSurface");
    expect(created.equation).toBe("x^2 + y^2 + z^2 - 9");
    expect(created.resolution).toBeGreaterThanOrEqual(2);
    expect(created.visible).toBe(true);
  });

  it("updates equation, domain, and resolution through one field setter", () => {
    const object = makeImplicit();
    expect(updateImplicitSurfaceField(object, "equation", "x^2 + y^2 + z^2 = 4")?.equation).toBe(
      "x^2 + y^2 + z^2 = 4"
    );
    expect(updateImplicitSurfaceField(object, "zMin", -2)?.domain.zMin).toBe(-2);
    expect(updateImplicitSurfaceField(object, "resolution", 500)?.resolution).toBe(48);
    expect(updateImplicitSurfaceField(object, "zMin", Number.NaN)).toBeNull();
    expect(updateImplicitSurfaceField(object, "resolution", Number.NaN)).toBeNull();
  });

  it("preserves implicit surfaces across history snapshots", () => {
    const object = makeImplicit();
    const snapshot: SceneSnapshot = {
      objects: [object],
      measurements: [],
      selection: { selectedObjectId: object.id }
    };
    const store = useHistoryStore.getState();
    store.clear();
    store.pushSnapshot(snapshot);
    const undone = store.undo({ objects: [], measurements: [], selection: { selectedObjectId: null } });
    expect(undone?.objects[0]).toEqual(object);
    store.clear();
  });

  it("detects empty rows and labels implicit surfaces", () => {
    expect(isExpressionRowEmpty(makeImplicit())).toBe(false);
    expect(isExpressionRowEmpty(makeImplicit({ equation: "" }))).toBe(true);
    expect(isGraphObjectWithoutExpressions(makeImplicit({ equation: "" }))).toBe(true);
    expect(getObjectRowDisplayMeta(makeImplicit())).toEqual({
      label: "Implicit Surface",
      type: "Implicit Surface"
    });
  });

  it("parses the implicitSurface kind string", () => {
    expect(parseGraphObjectKind("implicitSurface")).toBe("implicitSurface");
    expect(parseGraphObjectKind("implicitVolume")).toBeNull();
  });

  it("offers Implicit Surface in the graph type selector", () => {
    render(<GraphTypeSelector value="surface" onChange={() => undefined} />);
    const select = screen.getByLabelText("Graph type") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["surface", "parametricCurve", "parametricSurface", "implicitSurface", "plane", "point", "vector", "line", "ray", "segment", "linearTransform:2d", "linearTransform:3d", "vectorField:2d", "vectorField:3d"]);
  });

  it("keeps Implicit Surface reachable in both workspaces (quick in Math, More in Geometry)", () => {
    expect(quickAddDescriptors("math").map((entry) => entry.key)).toContain("implicitSurface");
    const geometryReachable = [
      ...quickAddDescriptors("geometry").map((entry) => entry.key),
      ...moreAddDescriptors("geometry").map((entry) => entry.key)
    ];
    expect(geometryReachable).toContain("implicitSurface");
  });
});
