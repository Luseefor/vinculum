import { describe, expect, it } from "vitest";
import { Group, Line, Mesh } from "three";
import type { LineObject, RayObject, SegmentObject, VectorObject } from "@vinculum/scene/types";
import {
  buildLinePrimitive,
  buildRayPrimitive,
  buildSegmentPrimitive,
  buildVectorPrimitive,
  refreshLineDisplayNode
} from "@/lib/graph3d/buildGraphGeometryPrimitives";
import { disposeObject3D } from "@/lib/graph3d/buildGraphObjectDisposal";
import { isGraphObjectRenderable3D } from "@/lib/graph3d/graphObject3dGuards";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/graphObject3dSignatures";
import {
  activeOrthoSpansForDisplay,
  computePrimitiveDisplayHalfExtent,
  refreshLineDisplayEndpoints,
  updateGeometryPrimitiveDisplay
} from "@/lib/graph3d/graphThreePrimitiveDisplay";

function vector(overrides: Partial<VectorObject> = {}): VectorObject {
  return {
    id: "vec-1",
    kind: "vector",
    color: "#3b82f6",
    visible: true,
    oxExpr: "1",
    oyExpr: "2",
    ozExpr: "3",
    vxExpr: "4",
    vyExpr: "5",
    vzExpr: "6",
    ...overrides
  };
}

function segment(overrides: Partial<SegmentObject> = {}): SegmentObject {
  return {
    id: "seg-1",
    kind: "segment",
    color: "#3b82f6",
    visible: true,
    axExpr: "1",
    ayExpr: "2",
    azExpr: "3",
    bxExpr: "4",
    byExpr: "5",
    bzExpr: "6",
    ...overrides
  };
}

function line(overrides: Partial<LineObject> = {}): LineObject {
  return {
    id: "line-1",
    kind: "line",
    color: "#3b82f6",
    visible: true,
    pxExpr: "-1",
    pyExpr: "2",
    pzExpr: "0",
    dxExpr: "3",
    dyExpr: "1",
    dzExpr: "2",
    ...overrides
  };
}

function ray(overrides: Partial<RayObject> = {}): RayObject {
  return {
    id: "ray-1",
    kind: "ray",
    color: "#3b82f6",
    visible: true,
    oxExpr: "2",
    oyExpr: "-1",
    ozExpr: "1",
    dxExpr: "-1",
    dyExpr: "2",
    dzExpr: "3",
    ...overrides
  };
}

function childIds(group: Group): (string | undefined)[] {
  const ids: (string | undefined)[] = [group.userData.vinculumId as string | undefined];
  group.traverse((child) => {
    if (child !== group) {
      ids.push((child.userData as { vinculumId?: string }).vinculumId);
    }
  });
  return ids;
}

describe("primitive builders (S26 PART 11-19)", () => {
  it("builds a true-magnitude vector arrow: origin (1,3,2), direction <4,6,5>", () => {
    const node = buildVectorPrimitive(vector());
    expect(node).not.toBeNull();
    const group = node as Group;
    // shaft + head + invisible proxy.
    expect(group.children).toHaveLength(3);
    expect(childIds(group).every((id) => id === "vec-1")).toBe(true);
    // World mapping pins the asymmetric case: math (1,2,3) -> world
    // (1,3,2); math <4,5,6> -> world <4,6,5>. Length sqrt(77) is
    // preserved exactly (no S20-style normalization).
    const shaft = group.children[0] as Mesh;
    expect(shaft.position.x).toBeCloseTo(2.863, 2);
    expect(shaft.position.y).toBeCloseTo(5.795, 2);
    const head = group.children[1] as Mesh;
    // Tip lands at origin + full vector (5,9,7); the head centers
    // headLength/2 = 0.3 back along the unit direction.
    expect(head.position.x).toBeCloseTo(4.863, 2);
    expect(head.position.y).toBeCloseTo(8.795, 2);
    expect(head.position.z).toBeCloseTo(6.829, 2);
    const proxy = group.children[2] as Mesh;
    expect((proxy.userData as { pickProxy?: boolean }).pickProxy).toBe(true);
  });

  it("renders zero vectors as valid point markers without arrow math", () => {
    const node = buildVectorPrimitive(vector({ vxExpr: "0", vyExpr: "0", vzExpr: "0" }));
    const group = node as Group;
    expect(group.children).toHaveLength(1);
    const marker = group.children[0] as Mesh;
    expect((marker.userData as { pointMarker?: boolean }).pointMarker).toBe(true);
    expect(marker.position.x).toBeCloseTo(1, 12);
    expect(marker.position.y).toBeCloseTo(3, 12);
    expect(marker.position.z).toBeCloseTo(2, 12);
  });

  it("renders segments endpoint-to-endpoint with world-mapped asymmetric ends", () => {
    const node = buildSegmentPrimitive(segment());
    const group = node as Group;
    expect(group.children).toHaveLength(2);
    const lineChild = group.children[0] as Line;
    const positions = (lineChild.geometry.getAttribute("position") as { array: Float32Array }).array;
    // A=(1,2,3)->world(1,3,2); B=(4,5,6)->world(4,6,5).
    expect([positions[0], positions[1], positions[2]]).toEqual([1, 3, 2]);
    expect([positions[3], positions[4], positions[5]]).toEqual([4, 6, 5]);
  });

  it("renders coincident segments as point markers", () => {
    const node = buildSegmentPrimitive(segment({ bxExpr: "1", byExpr: "2", bzExpr: "3" }));
    const group = node as Group;
    expect(group.children).toHaveLength(1);
    expect(((group.children[0] as Mesh).userData as { pointMarker?: boolean }).pointMarker).toBe(true);
  });

  it("builds clipped lines with no arrowhead and rays with one", () => {
    const lineNode = buildLinePrimitive(line()) as Group;
    expect(lineNode.children.some((child) => (child as Mesh).isMesh && !(child.userData as { pickProxy?: boolean }).pickProxy)).toBe(
      false
    );
    const rayNode = buildRayPrimitive(ray()) as Group;
    // line + head + proxy.
    expect(rayNode.children).toHaveLength(3);
  });

  it("returns null (never NaN) for zero-direction lines and rays", () => {
    expect(buildLinePrimitive(line({ dxExpr: "0", dyExpr: "0", dzExpr: "0" }))).toBeNull();
    expect(buildRayPrimitive(ray({ dxExpr: "0", dyExpr: "0", dzExpr: "0" }))).toBeNull();
    expect(buildLinePrimitive(line({ pxExpr: "x" }))).toBeNull();
  });

  it("keeps per-object O(1) resources with parent-mapped pick identity", () => {
    for (const node of [buildVectorPrimitive(vector()), buildSegmentPrimitive(segment()), buildLinePrimitive(line()), buildRayPrimitive(ray())]) {
      const group = node as Group;
      expect(group.children.length).toBeLessThanOrEqual(3);
      expect(childIds(group).every((id) => typeof id === "string" && id.length > 0)).toBe(true);
      // No child carries an independent selectable id.
      const ids = new Set(childIds(group));
      expect(ids.size).toBe(1);
    }
  });

  it("disposes every primitive resource without throwing", () => {
    for (const node of [buildVectorPrimitive(vector()), buildSegmentPrimitive(segment()), buildLinePrimitive(line()), buildRayPrimitive(ray())]) {
      expect(() => disposeObject3D(node!)).not.toThrow();
    }
  });
});

describe("primitive signatures and guards (S26 PART 21/44)", () => {
  it("includes all coordinate expressions in the structure signature", () => {
    const structure = getGraphObjectStructureSignature(line());
    expect(structure).toContain("pxExpr");
    expect(structure).toContain("dzExpr");
    const colored: LineObject = { ...line(), color: "#ff0000" };
    // Color is appearance: structure stable, render changes.
    expect(getGraphObjectStructureSignature(colored)).toBe(structure);
    expect(getGraphObjectRenderSignature(colored)).not.toBe(getGraphObjectRenderSignature(line()));
    // Visibility is excluded from both.
    const hidden: LineObject = { ...line(), visible: false };
    expect(getGraphObjectStructureSignature(hidden)).toBe(structure);
    expect(getGraphObjectRenderSignature(hidden)).toBe(getGraphObjectRenderSignature(line()));
    // Coordinate edits change structure.
    expect(getGraphObjectStructureSignature(line({ dxExpr: "9" }))).not.toBe(structure);
  });

  it("marks empty primitives non-renderable without crashing", () => {
    expect(isGraphObjectRenderable3D(line())).toBe(true);
    expect(isGraphObjectRenderable3D(line({ pxExpr: "", pyExpr: "", pzExpr: "", dxExpr: "", dyExpr: "", dzExpr: "" }))).toBe(
      false
    );
  });
});

describe("camera-driven display extents (S26 PART 14/41)", () => {
  it("derives a clamped union extent from perspective and ortho state", () => {
    expect(computePrimitiveDisplayHalfExtent(10, [])).toBe(60);
    expect(computePrimitiveDisplayHalfExtent(100, [])).toBe(300);
    expect(computePrimitiveDisplayHalfExtent(100, [12])).toBe(300);
    expect(computePrimitiveDisplayHalfExtent(10, [1000])).toBe(2500);
    expect(computePrimitiveDisplayHalfExtent(100000, [])).toBe(20_000);
    expect(
      activeOrthoSpansForDisplay({ panes: ["xy", "xz"], activeView: "xy", ortho: { getState: (pane: string) => ({ span: pane === "xy" ? 12 : 24 }) } } as never)
    ).toEqual([12, 24]);
  });

  it("clips lines to the live extent and revives rays entering the view", () => {
    const endpoints = refreshLineDisplayEndpoints(
      { point: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } },
      120
    );
    // Math (x) maps to world x unchanged.
    expect(endpoints?.entryWorld).toEqual({ x: -120, y: 0, z: 0 });
    expect(endpoints?.exitWorld).toEqual({ x: 120, y: 0, z: 0 });
    // Direction <7,8,9> maps to world <7,9,8> (y/z swap, no signs).
    const group = buildRayPrimitive(
      ray({ oxExpr: "0", oyExpr: "0", ozExpr: "0", dxExpr: "7", dyExpr: "8", dzExpr: "9" })
    ) as Group;
    const head = group.children.find(
      (child) => (child as Mesh).isMesh && !(child.userData as { pickProxy?: boolean }).pickProxy
    ) as Mesh;
    // Head sits near the forward exit along world <7,9,8>: x and z
    // positive with z > x (9 > 7), y smaller.
    expect(head.position.x).toBeGreaterThan(0);
    expect(head.position.z).toBeGreaterThan(head.position.x);
  });

  it("drops children outside the volume and reallocates on re-entry", () => {
    const group = buildLinePrimitive(line()) as Group;
    expect(group.children.length).toBeGreaterThan(0);
    refreshLineDisplayNode(group, 0.000001);
    // Tiny box around the origin: the default line point (-1,2,0)
    // misses it, so visible children drop but the stamped node stays.
    expect(group.children).toHaveLength(0);
    expect(group.userData.vinculumId).toBe("line-1");
    refreshLineDisplayNode(group, 120);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it("skips steady-state refreshes inside the 2% drift gate", () => {
    const nodes = new Map<string, Group>();
    const group = buildLinePrimitive(line()) as Group;
    nodes.set("line-1", group);
    const before = (group.children[0] as Line).geometry.getAttribute("position");
    updateGeometryPrimitiveDisplay(nodes, 120.5);
    expect((group.children[0] as Line).geometry.getAttribute("position")).toBe(before);
    updateGeometryPrimitiveDisplay(nodes, 240);
    expect(group.userData.displayHalfExtent).toBe(240);
  });
});
