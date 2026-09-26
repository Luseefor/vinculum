import { describe, expect, it } from "vitest";
import { Group, Line, Mesh } from "three";
import type { LinearTransformObject2D, LinearTransformObject3D } from "@vinculum/scene/types";
import { buildLinearTransform3D } from "@/lib/graph3d/buildGraphLinearTransform";
import { disposeObject3D } from "@/lib/graph3d/buildGraphObjectDisposal";
import { isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/graphObject3dSignatures";

function transform2D(entries: Partial<Record<string, string>> = {}): LinearTransformObject2D {
  return {
    id: "lt-2d",
    kind: "linearTransform",
    dimension: "2d",
    color: "#3b82f6",
    visible: true,
    m11: "1",
    m12: "0",
    m21: "0",
    m22: "1",
    ...entries
  };
}

function transform3D(entries: Partial<Record<string, string>> = {}): LinearTransformObject3D {
  return {
    id: "lt-3d",
    kind: "linearTransform",
    dimension: "3d",
    color: "#3b82f6",
    visible: true,
    m11: "1", m12: "0", m13: "0",
    m21: "0", m22: "1", m23: "0",
    m31: "0", m32: "0", m33: "1",
    ...entries
  };
}

function childIds(group: Group): string[] {
  const ids: string[] = [];
  group.traverse((child) => {
    const id = (child.userData as { vinculumId?: unknown }).vinculumId;
    if (typeof id === "string") {
      ids.push(id);
    }
  });
  return ids;
}

describe("linearTransform 3D builder (S28 PART 15/16/63)", () => {
  it("renders reference cube, transformed basis arrows, and wireframe with one id", () => {
    const node = buildLinearTransform3D(transform3D({ m11: "2", m22: "3", m33: "4" }));
    expect(node).not.toBeNull();
    const group = node as Group;
    // Reference edges + 3 reference arrows (shaft+head) + 3 transformed
    // arrows (shaft+head+proxy) + transformed edges = 1+6+9+1 children.
    expect(group.children.length).toBe(1 + 6 + 9 + 1);
    expect(childIds(group).every((id) => id === "lt-3d")).toBe(true);
    // Transformed arrows carry pick proxies; reference meshes do not.
    const proxies = childIds(group).length;
    expect(proxies).toBeGreaterThan(0);
  });

  it("maps the asymmetric matrix through math/world correctly (PART 15)", () => {
    // A = [1..9] row-major: Ae1=<1,4,7> -> world <1,7,4> (PART 15 pin).
    // Proxy midpoints sit halfway origin→tip: (0.5, 3.5, 2) in world.
    const node = buildLinearTransform3D(
      transform3D({ m11: "1", m12: "2", m13: "3", m21: "4", m22: "5", m23: "6", m31: "7", m32: "8", m33: "9" })
    );
    const group = node as Group;
    const proxies: Mesh[] = [];
    group.traverse((child) => {
      if ((child as Mesh).isMesh && (child.userData as { pickProxy?: unknown }).pickProxy === true) {
        proxies.push(child as Mesh);
      }
    });
    expect(proxies).toHaveLength(3);
    const nearAe1 = proxies.some(
      (proxy) =>
        Math.abs(proxy.position.x - 0.5) < 1e-9 &&
        Math.abs(proxy.position.y - 3.5) < 1e-9 &&
        Math.abs(proxy.position.z - 2) < 1e-9
    );
    expect(nearAe1).toBe(true);
    const shafts = group.children.filter(
      (child) => child instanceof Mesh && !(child.userData as { pickProxy?: unknown }).pickProxy
    );
    expect(shafts.length).toBeGreaterThanOrEqual(6);
  });

  it("embeds 2D transforms at z=0 and survives rank collapse", () => {
    const flat = buildLinearTransform3D(transform2D({ m11: "2", m22: "3" }));
    expect(flat).not.toBeNull();
    // Embedded 2D map fixes z (image of the unit cube spans math
    // z∈{0,1}, i.e. world y∈{0,1}); reference cube excluded via its
    // distinct reference color.
    const flatGroup = flat as Group;
    flatGroup.traverse((child) => {
      if ((child as { isLineSegments?: boolean }).isLineSegments === true) {
        const material = (child as Line).material as { color?: { getHexString?: () => string } };
        if (material.color?.getHexString?.() !== "3b82f6") {
          return;
        }
        const positions = (child as Line).geometry.getAttribute("position") as { array: Float32Array };
        expect(positions.array.length).toBeGreaterThan(0);
        for (let index = 1; index < positions.array.length; index += 3) {
          expect([0, 1]).toContain(positions.array[index]);
        }
      }
    });
    // Singular: columns collapse to a line; zero basis maps to origin.
    const singular = buildLinearTransform3D(transform2D({ m11: "1", m12: "2", m21: "2", m22: "4" }));
    expect(singular).not.toBeNull();
    // Zero matrix: everything collapses to the origin marker set.
    const zero = buildLinearTransform3D(transform2D({ m11: "0", m12: "0", m21: "0", m22: "0" }));
    expect(zero).not.toBeNull();
    const group = zero as Group;
    group.traverse((child) => {
      if (child instanceof Mesh) {
        expect(Number.isFinite(child.position.x)).toBe(true);
      }
      if (child instanceof Line) {
        const positions = child.geometry.getAttribute("position") as { array: Float32Array };
        for (const value of positions.array) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    });
    expect(() => disposeObject3D(zero!)).not.toThrow();
  });

  it("returns null for unresolved entries without NaN", () => {
    expect(buildLinearTransform3D(transform2D({ m11: "x" }))).toBeNull();
    expect(buildLinearTransform3D(transform2D({ m11: "" }))).toBeNull();
  });

  it("selects through transformed proxies only", () => {
    const node = buildLinearTransform3D(transform3D()) as Group;
    const proxies: Mesh[] = [];
    node.traverse((child) => {
      if ((child as Mesh).isMesh && (child.userData as { pickProxy?: unknown }).pickProxy === true) {
        proxies.push(child as Mesh);
      }
    });
    // One bounded proxy per transformed basis arrow (PART 17/44).
    expect(proxies).toHaveLength(3);
  });
});

describe("linearTransform signatures and guards (S28)", () => {
  it("includes entries and dimension in structure; color is appearance", () => {
    const structure = getGraphObjectStructureSignature(transform2D());
    expect(structure).toContain("m11");
    expect(structure).toContain("2d");
    const colored = { ...transform2D(), color: "#ff0000" };
    expect(getGraphObjectStructureSignature(colored)).toBe(structure);
    expect(getGraphObjectRenderSignature(colored)).not.toBe(getGraphObjectRenderSignature(transform2D()));
    const edited = transform2D({ m11: "2" });
    expect(getGraphObjectStructureSignature(edited)).not.toBe(structure);
    const switched = transform3D();
    expect(getGraphObjectStructureSignature({ ...switched, id: "lt-2d" })).not.toBe(structure);
  });

  it("gates empty transforms as non-renderable", () => {
    expect(isGraphObjectRenderable3D(transform2D())).toBe(true);
    expect(isGraphObjectRenderable3D(transform2D({ m11: "", m12: "", m21: "", m22: "" }))).toBe(false);
  });
});
