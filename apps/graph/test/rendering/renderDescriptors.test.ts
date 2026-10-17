import { describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import {
  getRenderDescriptorSignature,
  getStructureDescriptorSignature,
  toGraphObjectRenderDescriptor
} from "@/lib/graph3d/renderDescriptors";

describe("graph3d render descriptors", () => {
  it("maps a surface to a descriptor payload", () => {
    const object: GraphObject = {
      id: "surface-1",
      kind: "surface",
      color: "#3b82f6",
      visible: true,
      equation: "sin(x) * cos(y)",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      resolution: 80,
      appearance: { wireframe: false }
    };

    const descriptor = toGraphObjectRenderDescriptor(object);
    expect(descriptor.kind).toBe("surface");
    expect(descriptor.color).toBe("#3b82f6");
    expect(descriptor.payload).toHaveProperty("equation", object.equation);
  });

  it("excludes color from structure signature", () => {
    const object: GraphObject = {
      id: "plane-1",
      kind: "plane",
      color: "#f59e0b",
      visible: true,
      equation: "x + y + z - 1 = 0",
      size: 12,
      appearance: { wireframe: false }
    };
    const recolored: GraphObject = { ...object, color: "#22c55e" };

    const a = toGraphObjectRenderDescriptor(object);
    const b = toGraphObjectRenderDescriptor(recolored);

    expect(getRenderDescriptorSignature(a)).not.toBe(getRenderDescriptorSignature(b));
    expect(getStructureDescriptorSignature(a)).toBe(getStructureDescriptorSignature(b));
  });
});
