import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import TopToolbar from "@/components/editor/TopToolbar";

vi.mock("@/lib/export/sceneExport", () => ({
  exportSceneJson: vi.fn(),
  export2dPngFromCanvas: vi.fn(),
  export2dSvg: vi.fn(),
  export3dPngFromCanvas: vi.fn(),
  triggerSceneExportDownload: vi.fn()
}));

vi.mock("@/lib/share/shareSceneLink", () => ({
  buildShareSceneUrl: vi.fn(() => ({ ok: false, error: "not used" }))
}));

vi.mock("@/lib/projects/localProjectRepository", () => ({
  LocalProjectRepositoryError: class extends Error {},
  localProjectRepository: {
    listProjects: () => [],
    saveProject: vi.fn(),
    clearUnnamedRecoverySnapshot: vi.fn(),
    getProject: vi.fn(),
    loadProjectScene: vi.fn(),
    deleteProject: vi.fn()
  }
}));

vi.mock("@/components/projects/ProjectDialog", () => ({
  default: () => null
}));

vi.mock("@/components/layout/NewSceneDialog", () => ({
  default: () => null
}));

vi.mock("@/components/templates/ExamplesDialog", () => ({
  default: () => null
}));

vi.mock("@/components/ui/portal", () => ({
  Portal: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/lib/store/historyStore", () => ({
  useHistoryStore: (selector: (state: { clear: () => void }) => unknown) =>
    selector({ clear: vi.fn() })
}));

vi.mock("@/lib/store/editorStore", () => ({
  useEditorStore: (selector: (state: { showPerfHud: boolean }) => unknown) => selector({ showPerfHud: false })
}));

const graphStoreState = {
  scene: {
    metadata: { name: "Scene", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    objects: []
  },
  ui: {
    themeMode: "dark" as const,
    accentPreset: "indigo",
    graphMode: "2d" as const,
    active2dViewport: "primary" as const,
    axis2dPair: "xy" as const,
    axis2dPairQuadTop: "xz" as const,
    baseline3dPlane: "xy" as const,
    viewport2d: { centerX: 0, centerY: 0, scale: 80 },
    viewport2dQuadTop: { centerX: 0, centerY: 0, scale: 80 },
    viewport2dFrame: { width: 640, height: 480 },
    viewport2dQuadTopFrame: { width: 640, height: 480 },
    projectSession: {
      currentProjectId: null,
      currentProjectName: null,
      autosaveStatus: "idle" as const,
      autosaveError: null
    }
  },
  setThemeMode: vi.fn(),
  setAccentPreset: vi.fn(),
  setCurrentProjectSession: vi.fn(),
  setProjectAutosaveStatus: vi.fn(),
  resetScene: vi.fn(),
  openSceneDialog: vi.fn(),
  replaceSceneDocument: vi.fn(),
  setGraphMode: vi.fn()
};

vi.mock("@/store/graphStore", () => ({
  useGraphStore: (selector: (state: typeof graphStoreState) => unknown) => selector(graphStoreState)
}));

function renderBar(props: Partial<React.ComponentProps<typeof TopToolbar>> = {}) {
  return render(
    <TopToolbar
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      activeViewType="both"
      activeLayout="split"
      onViewTypeChange={vi.fn()}
      onLayoutChange={vi.fn()}
      plane2d="xy"
      onPlane2dChange={vi.fn()}
      base3d="xy"
      onBase3dChange={vi.fn()}
      {...props}
    />
  );
}

describe("view control semantics", () => {
  it("does not offer Single in the view type group", () => {
    renderBar({ activeViewType: "both" });
    const viewGroup = screen.getByRole("group", { name: "View type" });
    expect(within(viewGroup).queryByRole("button", { name: /single/i })).toBeNull();
    expect(within(viewGroup).getByRole("button", { name: "2D only" })).toBeVisible();
    expect(within(viewGroup).getByRole("button", { name: "3D only" })).toBeVisible();
    expect(within(viewGroup).getByRole("button", { name: "2D and 3D together" })).toBeVisible();
  });

  it("2D Plane select lists only axis pairs XY, XZ, YZ", () => {
    renderBar({ activeViewType: "both" });
    const sel = screen.getByTestId("toolbar-2d-plane-select") as HTMLSelectElement;
    const labels = Array.from(sel.options).map((o) => ({ value: o.value, text: o.textContent }));
    expect(labels).toEqual([
      { value: "xy", text: "XY" },
      { value: "xz", text: "XZ" },
      { value: "yz", text: "YZ" }
    ]);
  });

  it("3D Base select lists only Base XY, Base XZ, Base YZ", () => {
    renderBar({ activeViewType: "both" });
    const sel = screen.getByTestId("toolbar-3d-base-select") as HTMLSelectElement;
    const labels = Array.from(sel.options).map((o) => ({ value: o.value, text: o.textContent }));
    expect(labels).toEqual([
      { value: "xy", text: "Base XY" },
      { value: "xz", text: "Base XZ" },
      { value: "yz", text: "Base YZ" }
    ]);
  });

  it("hides 3D Base and layout in 2D-only mode", () => {
    renderBar({ activeViewType: "2d" });
    expect(screen.getByTestId("toolbar-2d-plane-select")).toBeVisible();
    expect(screen.queryByTestId("toolbar-3d-base-select")).toBeNull();
    expect(screen.queryByRole("group", { name: "Multi-panel layout" })).toBeNull();
  });

  it("hides 2D Plane and layout in 3D-only mode", () => {
    renderBar({ activeViewType: "3d" });
    expect(screen.queryByTestId("toolbar-2d-plane-select")).toBeNull();
    expect(screen.getByTestId("toolbar-3d-base-select")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Multi-panel layout" })).toBeNull();
  });

  it("shows both plane controls and layout in 2D+3D mode", () => {
    renderBar({ activeViewType: "both" });
    expect(screen.getByTestId("toolbar-2d-plane-select")).toBeVisible();
    expect(screen.getByTestId("toolbar-3d-base-select")).toBeVisible();
    expect(screen.getByRole("group", { name: "Multi-panel layout" })).toBeVisible();
  });

  it("Tool select lists Pan through Sketch without a Select option", () => {
    renderBar({ activeViewType: "both" });
    const sel = screen.getByRole("combobox", { name: /^tool$/i }) as HTMLSelectElement;
    const texts = Array.from(sel.options).map((o) => o.textContent);
    expect(texts).toEqual(["Pan", "Probe", "Pin", "Distance", "Angle", "Sketch"]);
  });
});
