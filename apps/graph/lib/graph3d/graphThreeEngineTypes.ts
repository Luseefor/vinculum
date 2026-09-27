import type { GeometryView } from "@/lib/types/ui";

export interface GraphThreeEngine {
  dispose: () => void;
  /**
   * Geometry Studio multi-view. Null panes select the legacy
   * single-perspective behavior. Never triggers geometry rebuilds.
   */
  setGeometryPanes: (panes: GeometryView[] | null) => void;
  getActiveGeometryView: () => GeometryView;
  setActiveGeometryView: (view: GeometryView) => void;
  resetActiveGeometryPane: () => void;
  /**
   * S33 camera-only framing (never math/scene/analysis): fit the selected
   * object into the active pane (perspective keeps direction; ortho fits
   * without rotating). False when nothing frameable is selected.
   */
  frameSelectedObject: () => boolean;
  /** S33 camera-only fit of visible content in the active pane. */
  fitSceneToView: () => boolean;
  /**
   * Suspend/resume the frame loop (workspace switching). Suspension keeps
   * the scene, cameras, and sync state intact; resume reattaches listeners
   * and restarts the loop. Disposal remains separate.
   */
  setSuspended: (suspended: boolean) => void;
}
