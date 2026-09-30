import type { WorkspaceId } from "@/types/graphUi";

/**
 * Workspace presentation configuration. Organization only: it changes which
 * existing capabilities are emphasized, never which objects exist or what
 * they mean. The canonical scene is shared across workspaces.
 */
export interface WorkspaceContent {
  /** Full product name shown in contextual surfaces. */
  label: string;
  /** One-line empty-scene hint. */
  emptyHint: string;
}

export const WORKSPACE_CONTENT: Record<WorkspaceId, WorkspaceContent> = {
  geometry: {
    label: "Geometry Studio",
    emptyHint: "Add a point, line, or surface to begin."
  },
  math: {
    label: "Math Lab",
    emptyHint: "Add an expression or field to begin."
  }
};
