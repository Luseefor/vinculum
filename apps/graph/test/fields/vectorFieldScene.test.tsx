import { describe, expect, it } from "vitest";
import {
  createDefaultVectorFieldGraph,
  defaultVectorField2DDensity,
  defaultVectorField3DDensity,
  defaultVectorFieldScale,
  MAX_VECTOR_FIELD_2D_DENSITY,
  MAX_VECTOR_FIELD_3D_DENSITY,
  MIN_VECTOR_FIELD_DENSITY,
  normalizeVectorFieldDensity,
  normalizeVectorFieldScale
} from "@vinculum/scene/defaults";
import type { VectorFieldObject, VectorFieldObject2D, VectorFieldObject3D } from "@vinculum/scene/types";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { buildGraphObject } from "@/lib/graph3d/buildGraphObjects";
import { isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/graphObject3dSignatures";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { cloneGraphObject, createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";
import {
  getObjectRowDisplayMeta,
  isExpressionRowEmpty
} from "@/components/objects/objectRowUtils";

function makeField2D(overrides: Omit<Partial<VectorFieldObject2D>, "dimension" | "kind"> = {}): VectorFieldObject {
  return {
    ...createDefaultVectorFieldGraph({ id: "vf-1", index: 0, dimension: "2d" }),
    ...overrides
  };
}

function makeField3D(overrides: Omit<Partial<VectorFieldObject3D>, "dimension" | "kind"> = {}): VectorFieldObject {
  return {
    ...createDefaultVectorFieldGraph({ id: "vf-3d", index: 1, dimension: "3d" }),
    ...overrides
  };
}

function importObjects(objects: unknown[]) {
  return deserializeScene(
    JSON.stringify({
      schemaVersion: 1,
      version: "1.0",
      metadata: { name: "t", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" },
      objects,
      measurements: []
    })
  );
}

function rawField2D(overrides: Record<string, unknown> = {}) {
  return {
    id: "vf-1",
    kind: "vectorField",
    dimension: "2d",
    color: "#3b82f6",
    visible: true,
    pExpr: "x",
    qExpr: "y",
    rExpr: "",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    density: 16,
    scale: 1,
    normalize: false,
    ...overrides
  };
}

describe("vectorField scene model (S20 Slice 1)", () => {
  it("creates dimension-fixed defaults with bounded sampling config", () => {
    const field2D = createDefaultVectorFieldGraph({ id: "a", index: 0, dimension: "2d" });
    expect(field2D).toMatchObject({
      kind: "vectorField",
      dimension: "2d",
      pExpr: "x",
      qExpr: "y",
      rExpr: "",
      density: defaultVectorField2DDensity,
      scale: defaultVectorFieldScale,
      normalize: false,
      visible: true
    });
    expect(field2D.domain).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 });

    const field3D = createDefaultVectorFieldGraph({ id: "b", index: 1, dimension: "3d" });
    expect(field3D).toMatchObject({
      dimension: "3d",
      pExpr: "x",
      qExpr: "y",
      rExpr: "z",
      density: defaultVectorField3DDensity
    });
    expect(field3D.domain).toEqual({ xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3 });
  });

  it("normalizes density per dimension and scale into bounds", () => {
    expect(normalizeVectorFieldDensity(1, "2d")).toBe(MIN_VECTOR_FIELD_DENSITY);
    expect(normalizeVectorFieldDensity(64, "2d")).toBe(MAX_VECTOR_FIELD_2D_DENSITY);
    expect(normalizeVectorFieldDensity(64, "3d")).toBe(MAX_VECTOR_FIELD_3D_DENSITY);
    expect(MAX_VECTOR_FIELD_3D_DENSITY ** 3).toBeLessThanOrEqual(1728);
    expect(MAX_VECTOR_FIELD_2D_DENSITY ** 2).toBeLessThanOrEqual(1024);
    expect(normalizeVectorFieldScale(0)).toBeGreaterThan(0);
    expect(normalizeVectorFieldScale(99)).toBeLessThanOrEqual(3);
  });

  it("parses valid 2D and 3D field documents", () => {
    const result = importObjects([
      rawField2D(),
      {
        ...rawField2D(),
        id: "vf-3d",
        dimension: "3d",
        pExpr: "sin(y)",
        qExpr: "sin(z)",
        rExpr: "sin(x)",
        domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 },
        density: 8,
        scale: 1.5,
        normalize: true
      }
    ]);
    expect(result.valid).toBe(true);
    expect(result.normalizedScene?.objects).toHaveLength(2);
    const [field2D, field3D] = result.normalizedScene?.objects ?? [];
    expect(field2D).toMatchObject({ kind: "vectorField", dimension: "2d", density: 16 });
    expect(field3D).toMatchObject({
      kind: "vectorField",
      dimension: "3d",
      pExpr: "sin(y)",
      scale: 1.5,
      normalize: true
    });
  });

  it("rejects malformed fields without partial mutation", () => {
    const cases: Array<{ name: string; override: Record<string, unknown> }> = [
      { name: "bad dimension", override: { dimension: "4d" } },
      { name: "missing dimension", override: { dimension: undefined } },
      { name: "zero density", override: { density: 0 } },
      { name: "density 1", override: { density: 1 } },
      { name: "2D density 33", override: { density: 33 } },
      {
        name: "3D density 13",
        override: { dimension: "3d", rExpr: "z", domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }, density: 13 }
      },
      { name: "zero scale", override: { scale: 0 } },
      { name: "scale above max", override: { scale: 5 } },
      { name: "non-boolean normalize", override: { normalize: "yes" } },
      { name: "R on 2D", override: { rExpr: "z" } },
      { name: "empty P", override: { pExpr: "" } },
      { name: "nested unsafe P", override: { pExpr: "sin(factorial(x))" } },
      { name: "missing domain", override: { domain: undefined } },
      { name: "non-finite domain", override: { domain: { xMin: -5, xMax: 5, yMin: -5, yMax: NaN } } }
    ];
    for (const testCase of cases) {
      const result = importObjects([{ ...rawField2D(), ...testCase.override }]);
      expect(result.valid).toBe(false);
    }
    // 3D with empty R rejects.
    const emptyR = importObjects([
      {
        ...rawField2D(),
        id: "vf-x",
        dimension: "3d",
        domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 }
      }
    ]);
    expect(emptyR.valid).toBe(false);
  });

  it("clone deep-copies the domain", () => {
    const original = makeField3D();
    const cloned = cloneGraphObject(original);
    expect(cloned.kind).toBe("vectorField");
    if (cloned.kind === "vectorField" && original.kind === "vectorField") {
      expect(cloned.domain).toEqual(original.domain);
      expect(cloned.domain).not.toBe(original.domain);
      if (cloned.domain && original.domain && "zMin" in cloned.domain && "zMin" in original.domain) {
        cloned.domain.zMin = 999;
        expect(original.domain.zMin).toBe(-3);
      }
    }
  });

  it("render signature tracks scale/normalize while structure ignores them", () => {
    const base = makeField3D();
    const scaled = { ...base, scale: 2 };
    const normalized = { ...base, normalize: true };
    const recolored = { ...base, color: "#f59e0b" };
    const resampled = { ...base, pExpr: "-y" };

    expect(getGraphObjectRenderSignature(scaled)).not.toBe(getGraphObjectRenderSignature(base));
    expect(getGraphObjectStructureSignature(scaled)).toBe(getGraphObjectStructureSignature(base));
    expect(getGraphObjectRenderSignature(normalized)).not.toBe(getGraphObjectRenderSignature(base));
    expect(getGraphObjectStructureSignature(normalized)).toBe(getGraphObjectStructureSignature(base));
    // Pre-existing color semantics preserved.
    expect(getGraphObjectRenderSignature(recolored)).not.toBe(getGraphObjectRenderSignature(base));
    expect(getGraphObjectStructureSignature(recolored)).toBe(getGraphObjectStructureSignature(base));
    // Math identity changes both.
    expect(getGraphObjectRenderSignature(resampled)).not.toBe(getGraphObjectRenderSignature(base));
    expect(getGraphObjectStructureSignature(resampled)).not.toBe(getGraphObjectStructureSignature(base));
  });

  it("serialize/deserialize and share links preserve field identity", () => {
    const scene = createSceneDocument({ objects: [makeField2D(), makeField3D()] });
    const roundTripped = deserializeScene(serializeScene(scene));
    expect(roundTripped.valid).toBe(true);
    expect(roundTripped.normalizedScene?.objects).toHaveLength(2);
    expect(roundTripped.normalizedScene?.objects[1]).toMatchObject({
      kind: "vectorField",
      dimension: "3d",
      rExpr: "z",
      density: defaultVectorField3DDensity
    });

    const built = buildShareSceneUrl({ scene, baseUrl: "https://example.com/" });
    expect(built.ok).toBe(true);
    if (built.ok && typeof built.url === "string") {
      const url = new URL(built.url);
      const decoded = decodeSharedScenePayload(url.searchParams.get("scene") ?? "");
      expect(decoded.ok).toBe(true);
      if (decoded.ok && decoded.scene) {
        expect(decoded.scene.objects).toHaveLength(2);
        expect(decoded.scene.objects[1]).toMatchObject({
          kind: "vectorField",
          dimension: "3d",
          pExpr: "x",
          rExpr: "z",
          density: defaultVectorField3DDensity,
          scale: defaultVectorFieldScale,
          normalize: false
        });
      }
    }
  });

  it("2D builder samples fields while 3D fields stay Three-only", () => {
    const graphs = buildRenderableGraphsFromScene(
      [makeField2D(), makeField3D()],
      getAxisPairSpec("xy"),
      {}
    );
    expect(graphs).toHaveLength(1);
    expect(graphs[0]?.id).toBe("vf-1");
    expect(graphs[0]?.vectorField?.count).toBe(256);
  });

  it("3D guards admit 3D fields with components, never 2D fields", () => {
    expect(isGraphObjectRenderable3D(makeField3D())).toBe(true);
    expect(isGraphObjectRenderable3D(makeField2D())).toBe(false);
    expect(
      isGraphObjectRenderable3D(makeField3D({ pExpr: "", qExpr: "", rExpr: "" }))
    ).toBe(false);
    expect(buildGraphObject(makeField2D(), "dark")).toBeNull();
  });

  it("row helpers describe fields compactly", () => {
    expect(isExpressionRowEmpty(makeField2D())).toBe(false);
    expect(
      isExpressionRowEmpty(makeField2D({ pExpr: "", qExpr: "", rExpr: "" }))
    ).toBe(true);
    expect(getObjectRowDisplayMeta(makeField2D())).toEqual({
      label: "Vector Field",
      type: "F(x,y)=<x, y>"
    });
    expect(getObjectRowDisplayMeta(makeField3D()).type).toBe("F(x,y,z)=<x, y, z>");
    const long = getObjectRowDisplayMeta(
      makeField3D({ pExpr: "sin(y) + cos(z)", qExpr: "sin(z) + cos(x)", rExpr: "sin(x) + cos(y)" })
    );
    expect(long.type).toBe("F(x,y,z)=<sin(y) + cos(z), sin(z) + cos(x), sin(x) + cos(y)>");
    expect(
      getObjectRowDisplayMeta(makeField2D({ pExpr: "", qExpr: "", rExpr: "" })).type
    ).toBe("Choose type in menu");
  });
});
