export type ViewportMode = "2d" | "3d" | "split" | "quad";

/**
 * Geometry Studio viewport identity. Distinct from workspace, dimension
 * toggles, and layout: a single view fills one pane, and panes compose
 * single/split/quad layouts of the SAME shared scene.
 */
export type GeometryView = "perspective" | "xy" | "xz" | "yz";

/** Geometry Studio pane arrangement. Fixed compositions, no custom layouts. */
export type GeometryLayout = "single" | "split" | "quad";

export type BottomPanelTab = "parameters" | "console" | "diagnostics" | "measurements" | "performance";
