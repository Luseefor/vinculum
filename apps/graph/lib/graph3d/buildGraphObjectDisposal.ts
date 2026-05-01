import { Color, Line, LineSegments, Mesh, type Object3D } from "three";

export function disposeObject3D(root: Object3D): void {
  root.traverse((child) => {
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
