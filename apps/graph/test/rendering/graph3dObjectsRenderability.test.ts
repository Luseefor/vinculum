import { describe, expect, it } from "vitest";
import { Group, BufferGeometry, Mesh, MeshBasicMaterial, type Object3D } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import {
  isGraphObjectRenderable3D,
  sceneHasVisibleSurface,
  syncNonRenderableObjectNode
} from "@/lib/graph3d/buildGraphObjects";

describe("graph3d renderability guards", () => {
  it("marks empty equations and empty parametric expressions as non-renderable", () => {
    const emptySurface: GraphObject = {
      id: "s-empty",
      kind: "surface",
      color: "#ff0000",
      visible: true,
      equation: "   ",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      resolution: 80,
      appearance: { wireframe: false }
    };
    const emptyPlane: GraphObject = {
      id: "p-empty",
      kind: "plane",
      color: "#f59e0b",
      visible: true,
      equation: "   ",
      size: 12,
      appearance: { wireframe: false }
    };
    const emptyCurve: GraphObject = {
      id: "c-empty",
      kind: "parametricCurve",
      color: "#0ea5e9",
      visible: true,
      xExpr: " ",
      yExpr: " ",
      zExpr: " ",
      tMin: -1,
      tMax: 1,
      samples: 16
    };

    expect(isGraphObjectRenderable3D(emptySurface)).toBe(false);
    expect(isGraphObjectRenderable3D(emptyPlane)).toBe(false);
    expect(isGraphObjectRenderable3D(emptyCurve)).toBe(false);
  });

  it("only treats visible, renderable surfaces as shadow-triggering surfaces", () => {
    const objects: GraphObject[] = [
      {
        id: "s-hidden",
        kind: "surface",
        color: "#ff0000",
        visible: false,
        equation: "x + y",
        domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
        resolution: 80,
        appearance: { wireframe: false }
      },
      {
        id: "s-empty",
        kind: "surface",
        color: "#22c55e",
        visible: true,
        equation: "  ",
        domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
        resolution: 80,
        appearance: { wireframe: false }
      }
    ];

    expect(sceneHasVisibleSurface(objects)).toBe(false);
    expect(
      sceneHasVisibleSurface([
        ...objects,
        {
          id: "s-real",
          kind: "surface",
          color: "#38bdf8",
          visible: true,
          equation: "sin(x) * cos(y)",
          domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
          resolution: 64,
          appearance: { wireframe: false }
        }
      ])
    ).toBe(true);
  });

  it("strips orphaned node when object becomes non-renderable", () => {
    const object: GraphObject = {
      id: "s-strip",
      kind: "surface",
      color: "#22c55e",
      visible: true,
      equation: "   ",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      resolution: 64,
      appearance: { wireframe: false }
    };
    const root = new Group();
    const staleNode = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: "#22c55e" }));
    root.add(staleNode);
    const nodes = new Map<string, Object3D>([[object.id, staleNode]]);
    const signatures = new Map<string, string>([[object.id, "dark:old"]]);
    const structures = new Map<string, string>([[object.id, "dark:old"]]);

    const handled = syncNonRenderableObjectNode(
      object,
      "dark",
      root,
      nodes,
      signatures,
      structures
    );

    expect(handled).toBe(true);
    expect(root.children).toHaveLength(0);
    expect(nodes.has(object.id)).toBe(false);
    expect(signatures.get(object.id)).toBe("dark:non-renderable");
    expect(structures.get(object.id)).toBe("dark:non-renderable");
  });
});
