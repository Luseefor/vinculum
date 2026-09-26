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
    // S28: 3D transforms available through the complete flow, never
    // ahead of geometry primitives (PART 75).
    quickAddOrder: ["Point", "Vector", "Infinite Line", "Segment", "Ray", "Plane", "Curve", "Surface", "Parametric Surface", "Implicit Surface", "Sphere", "Cylinder", "Parametric Sphere", "Parametric Torus", "Implicit Sphere", "3D Vector Field", "2D Vector Field", "3D Linear Transformation", "2D Linear Transformation"],
    emptyHint: "Add a geometric object to begin."
  },
  math: {
    label: "Math Lab",
    // S20: vector fields high priority in Math Lab. S26: primitives stay
    // available through the complete Add Object flow, listed after curves.
    // S28: first Linear Algebra capability surfaces here (PART 42/74).
    quickAddOrder: ["2D Vector Field", "3D Vector Field", "2D Linear Transformation", "3D Linear Transformation", "Surface", "Parametric Surface", "Implicit Surface", "Curve", "Plane", "Vector", "Infinite Line", "Segment", "Ray", "Sphere", "Cylinder", "Point", "Parametric Sphere", "Parametric Torus", "Implicit Sphere"],
    emptyHint: "Add an equation or graph to begin."
  }
};
