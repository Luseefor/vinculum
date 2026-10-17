import { describe, expect, it } from "vitest";
import { Group, Line, LineBasicMaterial, LineSegments, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, SphereGeometry, Color } from "three";
import {
  applyObjectColorToNode,
  applySelectionEmphasisToNode,
  SELECTION_EMPHASIS_KINDS,
  syncGeometrySelectionEmphasis
} from "@/lib/graph3d/buildGraphObjectDisposal";

function makeLineNode(id: string, colorHex: string): Group {
  const group = new Group();
  group.userData.vinculumId = id;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1]), 3));
  const line = new Line(geometry, new LineBasicMaterial({ color: new Color(colorHex) }));
  line.userData.vinculumId = id;
  group.add(line);
  return group;
}

function makePointNode(id: string, colorHex: string): Group {
  const group = new Group();
  group.userData.vinculumId = id;
  const mesh = new Mesh(new SphereGeometry(0.1), new MeshBasicMaterial({ color: new Color(colorHex) }));
  mesh.userData.vinculumId = id;
  group.add(mesh);
  return group;
}

function nodeColor(node: Group): string {
  let found = "";
  node.traverse((child) => {
    if ((child instanceof Mesh || child instanceof Line) && !found) {
      const material = child.material as MeshBasicMaterial | LineBasicMaterial;
      found = `#${material.color.getHexString()}`;
    }
  });
  return found;
}

function luminance(hex: string): number {
  const color = new Color(hex);
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

describe("S31 selection emphasis (Part 1)", () => {
  it("brightens the selected node without touching others", () => {
    const selected = makeLineNode("a", "#336699");
    const other = makeLineNode("b", "#336699");
    const before = nodeColor(selected);
    applySelectionEmphasisToNode(selected, true);
    applySelectionEmphasisToNode(other, false);
    expect(nodeColor(other)).toBe(before);
    expect(luminance(nodeColor(selected))).toBeGreaterThan(luminance(before));
  });

  it("restores the exact base color on deselect", () => {
    const node = makePointNode("a", "#7f1d1d");
    const base = nodeColor(node);
    applySelectionEmphasisToNode(node, true);
    expect(nodeColor(node)).not.toBe(base);
    applySelectionEmphasisToNode(node, false);
    expect(nodeColor(node)).toBe(base);
  });

  it("refreshes the stash on Styles color edits while selected", () => {
    const node = makeLineNode("a", "#336699");
    applySelectionEmphasisToNode(node, true);
    expect(nodeColor(node)).not.toBe("#336699");
    // Styles color edit on the selected object: the canonical color path
    // sets the new base and refreshes the stash; the next emphasis pass
    // brightens from the new base instead of the stale one.
    applyObjectColorToNode(node, "#b91c1c");
    expect(nodeColor(node)).toBe("#b91c1c");
    applySelectionEmphasisToNode(node, true);
    expect(nodeColor(node)).not.toBe("#b91c1c");
    expect(luminance(nodeColor(node))).toBeGreaterThan(luminance("#b91c1c"));
    applySelectionEmphasisToNode(node, false);
    expect(nodeColor(node)).toBe("#b91c1c");
  });

  it("covers LineSegments and multi-material arrays", () => {
    const group = new Group();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 1, 1]), 3));
    const segments = new LineSegments(geometry, new LineBasicMaterial({ color: new Color("#123456") }));
    const multi = new Mesh(new SphereGeometry(0.1), [
      new MeshBasicMaterial({ color: new Color("#123456") }),
      new MeshBasicMaterial({ color: new Color("#123456") })
    ]);
    group.add(segments, multi);
    applySelectionEmphasisToNode(group, true);
    let brightened = 0;
    group.traverse((child) => {
      if (child instanceof LineSegments || child instanceof Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (luminance(`#${material.color.getHexString()}`) > luminance("#123456")) {
            brightened += 1;
          }
        }
      }
    });
    expect(brightened).toBe(3);
    applySelectionEmphasisToNode(group, false);
    group.traverse((child) => {
      if (child instanceof LineSegments || child instanceof Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          expect(`#${material.color.getHexString()}`).toBe("#123456");
        }
      }
    });
  });

  it("syncs emphasis only for geometry kinds", () => {
    expect(SELECTION_EMPHASIS_KINDS.has("point")).toBe(true);
    expect(SELECTION_EMPHASIS_KINDS.has("line")).toBe(true);
    expect(SELECTION_EMPHASIS_KINDS.has("plane")).toBe(true);
    expect(SELECTION_EMPHASIS_KINDS.has("surface")).toBe(false);
    expect(SELECTION_EMPHASIS_KINDS.has("vectorField")).toBe(false);

    const lineNode = makeLineNode("line-1", "#336699");
    const surfaceNode = makeLineNode("surface-1", "#336699");
    const nodes = new Map([
      ["line-1", lineNode],
      ["surface-1", surfaceNode]
    ]);
    const kinds = new Map([
      ["line-1", "line"],
      ["surface-1", "surface"]
    ] as Array<[string, "line" | "surface"]>);
    const base = nodeColor(lineNode);
    syncGeometrySelectionEmphasis(nodes, kinds, "line-1");
    expect(nodeColor(lineNode)).not.toBe(base);
    expect(nodeColor(surfaceNode)).toBe(base);
    syncGeometrySelectionEmphasis(nodes, kinds, null);
    expect(nodeColor(lineNode)).toBe(base);
  });
});
