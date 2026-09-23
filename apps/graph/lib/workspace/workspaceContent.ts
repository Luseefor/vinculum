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
    quickAddOrder: ["Plane", "Point", "Curve", "Surface", "Sphere", "Cylinder"],
    emptyHint: "Add a geometric object to begin."
  },
  math: {
    label: "Math Lab",
    quickAddOrder: ["Surface", "Curve", "Plane", "Sphere", "Cylinder", "Point"],
    emptyHint: "Add an equation or graph to begin."
  }
};
