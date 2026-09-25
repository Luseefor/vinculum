import type { WorkspaceId } from "@/types/graphUi";

/**
 * Workspace presentation configuration. Organization only: it changes which
 * existing capabilities are emphasized, never which objects exist or what
 * they mean. The canonical scene is shared across workspaces.
 */
export interface WorkspaceContent {
  /** Full product name shown in contextual surfaces. */
  label: string;
  /** Quick Add priority order (labels must match existing creation actions). */
  quickAddOrder: string[];
  /** One-line empty-scene hint. */
  emptyHint: string;
}

export const WORKSPACE_CONTENT: Record<WorkspaceId, WorkspaceContent> = {
  geometry: {
    label: "Geometry Studio",
    // S20: 3D fields available without displacing Point/Plane/Surface;
    // 2D fields listed last (same canonical list, no filtering).
    // S26: true geometry first — Point, Vector, Infinite Line, Segment,
    // Ray, Plane — then curves and surfaces.
    quickAddOrder: ["Point", "Vector", "Infinite Line", "Segment", "Ray", "Plane", "Curve", "Surface", "Parametric Surface", "Implicit Surface", "Sphere", "Cylinder", "Parametric Sphere", "Parametric Torus", "Implicit Sphere", "3D Vector Field", "2D Vector Field"],
    emptyHint: "Add a geometric object to begin."
  },
  math: {
    label: "Math Lab",
    // S20: vector fields high priority in Math Lab. S26: primitives stay
    // available through the complete Add Object flow, listed after curves.
    quickAddOrder: ["2D Vector Field", "3D Vector Field", "Surface", "Parametric Surface", "Implicit Surface", "Curve", "Plane", "Vector", "Infinite Line", "Segment", "Ray", "Sphere", "Cylinder", "Point", "Parametric Sphere", "Parametric Torus", "Implicit Sphere"],
    emptyHint: "Add an equation or graph to begin."
  }
};
