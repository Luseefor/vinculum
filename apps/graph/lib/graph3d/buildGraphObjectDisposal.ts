import { Color, InstancedMesh, Line, LineSegments, Mesh, type Material, type Object3D } from "three";
import type { GraphObjectKind } from "@vinculum/scene/types";

export function disposeObject3D(root: Object3D): void {
  root.traverse((child) => {
    // S20: InstancedMesh.dispose() releases instanceMatrix/instanceColor
    // GL buffers; geometry/material disposal below is shared with Mesh.
    if (child instanceof InstancedMesh) {
      child.dispose();
    }
    if (child instanceof Mesh || child instanceof Line || child instanceof LineSegments) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}

export function applyObjectColorToNode(node: Object3D, colorHex: string): void {
  const color = new Color(colorHex);
  node.traverse((child) => {
    if (!(child instanceof Mesh || child instanceof Line || child instanceof LineSegments)) {
      return;
    }
    const material = child.material;
    const apply = (entry: unknown) => {
      if (entry && typeof entry === "object" && "color" in entry) {
        const maybeColor = (entry as { color?: unknown }).color;
        if (maybeColor instanceof Color) {
          maybeColor.copy(color);
          // S31: this is the canonical base-color path, so refresh the
          // selection stash too — otherwise a Styles color edit on a
          // previously-selected object would revert to the stale base.
          const record = entry as { userData?: Record<string, unknown> };
          if (record.userData) {
            record.userData[BASE_COLOR_KEY] = `#${color.getHexString()}`;
          }
        }
      }
    };
    if (Array.isArray(material)) {
      for (const entry of material) {
        apply(entry);
      }
    } else {
      apply(material);
    }
  });
}

// S31 selection emphasis (Geometry Studio, Part 1): the selected geometric
// object reads brighter in every pane without new nodes, bounding boxes, or
// glow. Brightening is material-only and fully reversible: the first pass
// stashes each material's base color in userData, deselect restores it
// exactly. No scene mutation, no signature impact, no worker jobs.
const SELECTION_BRIGHTEN_AMOUNT = 0.45;
const BASE_COLOR_KEY = "vinculumBaseColorHex";

function eachColor(material: unknown, visit: (color: Color) => void): void {
  const apply = (entry: unknown) => {
    if (entry && typeof entry === "object" && "color" in entry) {
      const maybeColor = (entry as { color?: unknown }).color;
      if (maybeColor instanceof Color) {
        visit(maybeColor);
      }
    }
  };
  if (Array.isArray(material)) {
    for (const entry of material) {
      apply(entry);
    }
  } else {
    apply(material);
  }
}

export function applySelectionEmphasisToNode(node: Object3D, selected: boolean): void {
  const white = new Color("#ffffff");
  node.traverse((child) => {
    if (!(child instanceof Mesh || child instanceof Line || child instanceof LineSegments)) {
      return;
    }
    const material = child.material as Material | Material[];
    const entries = Array.isArray(material) ? material : [material];
    for (const entry of entries) {
      const record = entry as Material & { userData: Record<string, unknown> };
      const userData = record.userData ?? {};
      record.userData = userData;
      if (typeof userData[BASE_COLOR_KEY] !== "string") {
        let base: string | null = null;
        eachColor(entry, (color) => {
          if (base === null) {
            base = `#${color.getHexString()}`;
          }
        });
        userData[BASE_COLOR_KEY] = base ?? "#ffffff";
      }
      const baseHex = userData[BASE_COLOR_KEY] as string;
      eachColor(entry, (color) => {
        color.set(baseHex);
        if (selected) {
          color.lerp(white, SELECTION_BRIGHTEN_AMOUNT);
        }
      });
    }
  });
}

/** Geometry kinds carrying canvas selection emphasis (S31 is Geometry-first). */
export const SELECTION_EMPHASIS_KINDS: ReadonlySet<GraphObjectKind> = new Set([
  "point",
  "vector",
  "line",
  "ray",
  "segment",
  "plane"
]);

export function syncGeometrySelectionEmphasis(
  objectNodes: ReadonlyMap<string, Object3D>,
  kindsById: ReadonlyMap<string, GraphObjectKind>,
  selectedId: string | null
): void {
  for (const [id, node] of objectNodes) {
    const kind = kindsById.get(id);
    if (!kind || !SELECTION_EMPHASIS_KINDS.has(kind)) {
      continue;
    }
    applySelectionEmphasisToNode(node, id === selectedId);
  }
}
