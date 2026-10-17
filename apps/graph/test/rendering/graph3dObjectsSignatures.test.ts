import { describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import { getGraphObjectRenderSignature, getGraphObjectStructureSignature } from "@/lib/graph3d/buildGraphObjects";

describe("graph3d signatures", () => {
  it("distinguishes render and structure signatures for surface color changes", () => {
    const surface: GraphObject = {
      id: "s1",
      kind: "surface",
      color: "#ff0000",
      visible: true,
      equation: "sin(x) * cos(y)",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      resolution: 80,
      appearance: { wireframe: false }
    };

    const recolored: GraphObject = { ...surface, color: "#00ff00" };

    expect(getGraphObjectRenderSignature(surface)).not.toBe(getGraphObjectRenderSignature(recolored));
    expect(getGraphObjectStructureSignature(surface)).toBe(getGraphObjectStructureSignature(recolored));
  });

  it("produces stable signatures for curve and plane objects", () => {
    const curve: GraphObject = {
      id: "c1",
      kind: "parametricCurve",
      color: "#0ea5e9",
      visible: true,
      xExpr: "cos(t)",
      yExpr: "sin(t)",
      zExpr: "t / 3",
      tMin: -6.28,
      tMax: 6.28,
      samples: 220
    };
    const plane: GraphObject = {
      id: "p1",
      kind: "plane",
      color: "#f59e0b",
      visible: true,
      equation: "x + y + z - 1 = 0",
      size: 12,
      appearance: { wireframe: false }
    };

    expect(getGraphObjectRenderSignature(curve)).toBe(getGraphObjectRenderSignature({ ...curve }));
    expect(getGraphObjectStructureSignature(curve)).toBe(getGraphObjectStructureSignature({ ...curve }));
    expect(getGraphObjectRenderSignature(plane)).toBe(getGraphObjectRenderSignature({ ...plane }));
    expect(getGraphObjectStructureSignature(plane)).toBe(getGraphObjectStructureSignature({ ...plane }));
  });
});
