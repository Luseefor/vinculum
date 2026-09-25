import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { buildParametricSurface } from "@/lib/graph3d/buildGraphParametricSurface";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/graphObject3dSignatures";
import { isGraphObjectRenderable3D, sceneHasVisibleSurface } from "@/lib/graph3d/graphObject3dGuards";
import { toGraphObjectRenderDescriptor } from "@/lib/graph3d/renderDescriptors";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { createSceneDocument, CURRENT_SCENE_SCHEMA_VERSION } from "@/lib/scene/sceneSchema";
import { cloneGraphObject } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";
import { export2dSvg } from "@/lib/export/sceneExport";
import { createValidatedSceneExample, getSceneExampleById } from "@/lib/templates/examplesRegistry";
import { computeScenePressureFromObjects } from "@/lib/performance/performanceMetrics";
import { useHistoryStore } from "@/lib/store/historyStore";
import type { SceneSnapshot } from "@/lib/types/scene";
import { isGraphObjectWithoutExpressions } from "@/store/graphStoreObjectFactory";
import { updateParametricSurfaceField } from "@/store/graphStoreParametricSurfaceField";
import { parseGraphObjectKind } from "@/lib/graph/graphObjectKind";
import { getObjectRowDisplayMeta, isExpressionRowEmpty } from "@/components/objects/objectRowUtils";
import GraphTypeSelector from "@/components/expressions/GraphTypeSelector";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";
import type { ParametricSurfaceObject } from "@vinculum/scene/types";
import { Group, Mesh } from "three";

function makeSurface(overrides: Partial<ParametricSurfaceObject> = {}): ParametricSurfaceObject {
  return {
    ...createParametricSurfaceGraph({
      xExpr: "sin(u) * cos(v)",
      yExpr: "sin(u) * sin(v)",
      zExpr: "cos(u)",
      domain: { uMin: 0, uMax: 3.1415926536, vMin: 0, vMax: 6.2831853072 },
      resolution: 24
    }),
    ...overrides
  };
}

describe("parseParametricSurfaceObject", () => {
  it("parses a valid parametric surface document", () => {
    const result = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [
          {
            id: "ps-1",
            kind: "parametricSurface",
            color: "#3b82f6",
            visible: true,
            xExpr: "u",
            yExpr: "v",
            zExpr: "u * v",
            domain: { uMin: -3, uMax: 2, vMin: -2, vMax: 4 },
            resolution: 48,
            appearance: { wireframe: false }
          }
        ],
        measurements: []
      })
    );
    expect(result.valid).toBe(true);
    const object = result.normalizedScene?.objects[0];
    expect(object?.kind).toBe("parametricSurface");
    if (object?.kind === "parametricSurface") {
      expect(object.domain).toEqual({ uMin: -3, uMax: 2, vMin: -2, vMax: 4 });
      expect(object.resolution).toBe(48);
    }
  });

  it("rejects missing domain, bad resolution, and unsafe expressions", () => {
    const base = {
      id: "ps-1",
      kind: "parametricSurface",
      color: "#3b82f6",
      visible: true,
      xExpr: "u",
      yExpr: "v",
      zExpr: "0",
      domain: { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
      resolution: 24,
      appearance: { wireframe: false }
    };
    const missingDomain = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [{ ...base, domain: undefined }],
        measurements: []
      })
    );
    expect(missingDomain.valid).toBe(false);

    const badResolution = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [{ ...base, resolution: 512 }],
        measurements: []
      })
    );
    expect(badResolution.valid).toBe(false);

    const unsafe = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [{ ...base, xExpr: "sin(factorial(u))" }],
        measurements: []
      })
    );
    expect(unsafe.valid).toBe(false);

    const unknownKind = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [{ ...base, kind: "parametricVolume" }],
        measurements: []
      })
    );
    expect(unknownKind.valid).toBe(false);
  });

  it("allows empty coordinate expressions (editable-but-unrendered, like curves)", () => {
    const result = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [
          {
            id: "ps-empty",
            kind: "parametricSurface",
            color: "#3b82f6",
            visible: true,
            xExpr: "",
            yExpr: "",
            zExpr: "",
            domain: { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
            resolution: 24,
            appearance: { wireframe: false }
          }
        ],
        measurements: []
      })
    );
    expect(result.valid).toBe(true);
  });

  it("still loads legacy v1 scenes without the new kind (no version bump)", () => {
    const result = deserializeScene(
      JSON.stringify({
        schemaVersion: 1,
        version: "1.0",
        metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
        objects: [createSurfaceGraph({ equation: "z - x^2" })],
        measurements: []
      })
    );
    expect(result.valid).toBe(true);
    expect(result.normalizedScene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(CURRENT_SCENE_SCHEMA_VERSION).toBe(1);
  });
});

describe("parametric surface persistence", () => {
  it("round-trips expressions, domains, resolution, and style through canonical serialization", () => {
    const scene = createSceneDocument({ objects: [makeSurface()] });
    const parsed = deserializeScene(serializeScene(scene));
    expect(parsed.valid).toBe(true);
    const object = parsed.normalizedScene?.objects[0];
    expect(object).toEqual(scene.objects[0]);
  });

  it("round-trips through share-link encode/decode", () => {
    const scene = createSceneDocument({ objects: [makeSurface()] });
    const built = buildShareSceneUrl({ scene, baseUrl: "https://example.com/" });
    expect(built.ok).toBe(true);
    const payload = new URL(built.url!).searchParams.get("scene") ?? "";
    const decoded = decodeSharedScenePayload(payload);
    expect(decoded.ok).toBe(true);
    const object = decoded.scene?.objects[0];
    expect(object?.kind).toBe("parametricSurface");
    if (object?.kind === "parametricSurface") {
      expect(object.xExpr).toBe("sin(u) * cos(v)");
      expect(object.domain.vMax).toBeCloseTo(6.2831853072, 9);
      expect(object.resolution).toBe(24);
    }
  });

  it("deep-clones domain and appearance", () => {
    const original = makeSurface();
    const cloned = cloneGraphObject(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    if (cloned.kind === "parametricSurface") {
      expect(cloned.domain).not.toBe(original.domain);
      expect(cloned.appearance).not.toBe(original.appearance);
    }
  });

  it("warns (never silently drops) parametric surfaces in 2D SVG export", async () => {
    const scene = createSceneDocument({ objects: [makeSurface()] });
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

describe("parametric surface examples", () => {
  it.each(["parametric-sphere", "parametric-torus", "parametric-saddle"])(
    "validates example %s through the canonical round-trip",
    (id) => {
      const example = getSceneExampleById(id);
      expect(example).not.toBeNull();
      const validated = createValidatedSceneExample(example!);
      expect(validated.ok).toBe(true);
    }
  );
});

describe("parametric surface render descriptors (S7)", () => {
  it("carries every topology-altering field in the payload", () => {
    const descriptor = toGraphObjectRenderDescriptor(makeSurface());
    expect(descriptor.payload).toMatchObject({
      xExpr: "sin(u) * cos(v)",
      yExpr: "sin(u) * sin(v)",
      zExpr: "cos(u)",
      domain: { uMin: 0, uMax: 3.1415926536, vMin: 0, vMax: 6.2831853072 },
      resolution: 24,
      appearance: { wireframe: false }
    });
  });

  it("ignores visibility-only changes in both signatures", () => {
    const visible = makeSurface();
    const hidden: ParametricSurfaceObject = { ...visible, visible: false };
    expect(getGraphObjectRenderSignature(hidden)).toBe(getGraphObjectRenderSignature(visible));
    expect(getGraphObjectStructureSignature(hidden)).toBe(getGraphObjectStructureSignature(visible));
  });

  it("treats color as presentation-only (structure signature stable)", () => {
    const a = makeSurface();
    const b: ParametricSurfaceObject = { ...a, color: "#f59e0b" };
    expect(getGraphObjectRenderSignature(a)).not.toBe(getGraphObjectRenderSignature(b));
    expect(getGraphObjectStructureSignature(a)).toBe(getGraphObjectStructureSignature(b));
  });

  it("rebuilds on expression, domain, and resolution changes", () => {
    const base = makeSurface();
    expect(getGraphObjectStructureSignature({ ...base, xExpr: "u" })).not.toBe(
      getGraphObjectStructureSignature(base)
    );
    expect(
      getGraphObjectStructureSignature({ ...base, domain: { ...base.domain, uMax: 1 } })
    ).not.toBe(getGraphObjectStructureSignature(base));
    expect(getGraphObjectStructureSignature({ ...base, resolution: 32 })).not.toBe(
      getGraphObjectStructureSignature(base)
    );
  });
});

describe("buildParametricSurface", () => {
  it("builds one mesh group for the sphere", () => {
    const object = makeSurface();
    const group = buildParametricSurface(object, "dark", getGraphThemeTokens("dark"));
    expect(group).toBeInstanceOf(Group);
    const meshes = group!.children.filter((child) => child instanceof Mesh);
    expect(meshes).toHaveLength(1);
    expect(group!.userData.vinculumId).toBe(object.id);
  });

  it("emits finite nonzero normals for every referenced sphere vertex", () => {
    const group = buildParametricSurface(makeSurface(), "dark", getGraphThemeTokens("dark"));
    const mesh = group!.children.find((child) => child instanceof Mesh) as Mesh;
    const normals = mesh.geometry.getAttribute("normal").array as Float32Array;
    const index = mesh.geometry.getIndex()!.array as Uint16Array;
    const referenced = new Set<number>();
    for (let i = 0; i < index.length; i += 1) {
      referenced.add(index[i] ?? -1);
    }
    expect(referenced.size).toBeGreaterThan(500);
    for (const vertex of referenced) {
      const nx = normals[vertex * 3] ?? Number.NaN;
      const ny = normals[vertex * 3 + 1] ?? Number.NaN;
      const nz = normals[vertex * 3 + 2] ?? Number.NaN;
      expect(Number.isFinite(nx + ny + nz)).toBe(true);
      expect(Math.hypot(nx, ny, nz)).toBeGreaterThan(1e-9);
    }
  });

  it("returns null for empty, error, all-invalid, and degenerate-constant objects", () => {
    const tokens = getGraphThemeTokens("dark");
    expect(buildParametricSurface(makeSurface({ xExpr: "", yExpr: "", zExpr: "" }), "dark", tokens)).toBeNull();
    expect(
      buildParametricSurface(makeSurface({ xExpr: "sin(factorial(u))" }), "dark", tokens)
    ).toBeNull();
    expect(buildParametricSurface(makeSurface({ xExpr: "1 / 0" }), "dark", tokens)).toBeNull();
    expect(buildParametricSurface(makeSurface({ xExpr: "1", yExpr: "2", zExpr: "3" }), "dark", tokens)).toBeNull();
    expect(
      buildParametricSurface(
        makeSurface({ domain: { uMin: 1, uMax: 1, vMin: 2, vMax: 2 } }),
        "dark",
        tokens
      )
    ).toBeNull();
  });

  it("omits the edge overlay in wireframe mode", () => {
    const tokens = getGraphThemeTokens("dark");
    const solid = buildParametricSurface(makeSurface(), "dark", tokens);
    const wire = buildParametricSurface(makeSurface({ appearance: { wireframe: true } }), "dark", tokens);
    expect(solid!.children.length).toBe(2);
    expect(wire!.children.length).toBe(1);
  });

  it("renders the non-finite-domain surface as separated pieces without NaN", () => {
    const tokens = getGraphThemeTokens("dark");
    const group = buildParametricSurface(
      makeSurface({
        xExpr: "1 / u",
        yExpr: "v",
        zExpr: "0",
        domain: { uMin: -2, uMax: 2, vMin: -1, vMax: 1 }
      }),
      "dark",
      tokens
    );
    expect(group).not.toBeNull();
    const mesh = group!.children.find((child) => child instanceof Mesh) as Mesh;
    const positions = mesh.geometry.getAttribute("position").array as Float32Array;
    for (const value of positions) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("parametric surface guards and pressure", () => {
  it("is renderable with any non-empty coordinate expression", () => {
    expect(isGraphObjectRenderable3D(makeSurface())).toBe(true);
    expect(isGraphObjectRenderable3D(makeSurface({ xExpr: "", yExpr: "", zExpr: "" }))).toBe(false);
  });

  it("counts toward visible-surface shadows", () => {
    expect(sceneHasVisibleSurface([makeSurface()])).toBe(true);
    expect(sceneHasVisibleSurface([makeSurface({ visible: false })])).toBe(false);
  });

  it("feeds the surface-resolution pressure metric", () => {
    const pressure = computeScenePressureFromObjects([makeSurface({ resolution: 128 })]);
    expect(pressure.surfaceResolutionMax).toBe(128);
    expect(pressure.surfaceResolutionPressure).toBeCloseTo(1, 9);
  });
});

describe("parametric surface store semantics", () => {
  it("creates the default plane patch", () => {
    const created = createParametricSurfaceGraph({ id: "ps-default" });
    expect(created.kind).toBe("parametricSurface");
    expect([created.xExpr, created.yExpr, created.zExpr]).toEqual(["u", "v", "0"]);
    expect(created.resolution).toBeGreaterThanOrEqual(2);
    expect(created.visible).toBe(true);
  });

  it("updates expressions, domain, and resolution through one field setter", () => {
    const object = makeSurface();
    expect(updateParametricSurfaceField(object, "xExpr", "u * 2")?.xExpr).toBe("u * 2");
    expect(updateParametricSurfaceField(object, "uMin", -1)?.domain.uMin).toBe(-1);
    expect(updateParametricSurfaceField(object, "resolution", 500)?.resolution).toBe(128);
    expect(updateParametricSurfaceField(object, "uMin", Number.NaN)).toBeNull();
    expect(updateParametricSurfaceField(object, "resolution", Number.NaN)).toBeNull();
  });

  it("preserves parametric surfaces across history snapshots", () => {
    const object = makeSurface();
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

  it("detects empty rows and labels parametric surfaces", () => {
    expect(isExpressionRowEmpty(makeSurface())).toBe(false);
    expect(isExpressionRowEmpty(makeSurface({ xExpr: "", yExpr: "", zExpr: "" }))).toBe(true);
    expect(isGraphObjectWithoutExpressions(makeSurface({ xExpr: "", yExpr: "", zExpr: "" }))).toBe(true);
    expect(getObjectRowDisplayMeta(makeSurface())).toEqual({
      label: "Parametric Surface",
      type: "Parametric Surface"
    });
  });

  it("parses the parametricSurface kind string", () => {
    expect(parseGraphObjectKind("parametricSurface")).toBe("parametricSurface");
    expect(parseGraphObjectKind("parametricVolume")).toBeNull();
  });

  it("offers Parametric Surface in the graph type selector", () => {
    render(<GraphTypeSelector value="surface" onChange={() => undefined} />);
    const select = screen.getByLabelText("Graph type") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(["surface", "parametricCurve", "parametricSurface", "implicitSurface", "plane", "point", "vector", "line", "ray", "segment", "vectorField:2d", "vectorField:3d"]);
  });

  it("lists Parametric Surface templates in both workspace quick-add orders", () => {
    for (const workspace of ["geometry", "math"] as const) {
      expect(WORKSPACE_CONTENT[workspace].quickAddOrder).toContain("Parametric Surface");
      expect(WORKSPACE_CONTENT[workspace].quickAddOrder).toContain("Parametric Sphere");
      expect(WORKSPACE_CONTENT[workspace].quickAddOrder).toContain("Parametric Torus");
    }
  });
});
