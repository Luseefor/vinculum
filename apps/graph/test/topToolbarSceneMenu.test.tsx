import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import TopToolbar from "@/components/editor/TopToolbar";

const mockOpenSceneDialog = vi.fn();

vi.mock("@/lib/export/sceneExport", () => ({
  exportSceneJson: vi.fn(() => ({ ok: true, file: { kind: "json", content: "{}", filename: "scene.json", contentType: "application/json" } })),
  export2dPngFromCanvas: vi.fn(),
  export2dSvg: vi.fn(),
  export3dPngFromCanvas: vi.fn(),
  triggerSceneExportDownload: vi.fn(() => ({ ok: true }))
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
    deleteProject: vi.fn(),
    getUnnamedRecoverySnapshot: vi.fn(() => null)
  }
}));

vi.mock("@/components/layout/NewSceneDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="new-scene-dialog">new scene</div> : null)
}));

vi.mock("@/components/projects/ProjectDialog", () => ({
  default: ({ open, mode }: { open: boolean; mode: string }) =>
    open ? <div data-testid="project-dialog" data-mode={mode}>project</div> : null
}));

vi.mock("@/components/templates/ExamplesDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="examples-dialog">examples</div> : null)
}));

vi.mock("@/components/theme/ThemeAccentPopover", () => ({
  default: () => <div />
}));

vi.mock("@/lib/store/historyStore", () => ({
  useHistoryStore: (selector: (state: { clear: () => void }) => unknown) => selector({ clear: vi.fn() })
}));

vi.mock("@/store/graphStore", () => ({
  useGraphStore: (selector: (state: unknown) => unknown) =>
    selector({
      scene: {
        metadata: { name: "Scene", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        objects: []
      },
      ui: {
        themeMode: "dark",
        accentPreset: "indigo",
        graphMode: "3d",
        active2dViewport: "primary",
        axis2dPair: "xy",
        axis2dPairQuadTop: "xy",
        viewport2d: { centerX: 0, centerY: 0, scale: 80 },
        viewport2dQuadTop: { centerX: 0, centerY: 0, scale: 80 },
        viewport2dFrame: { width: 640, height: 480 },
        viewport2dQuadTopFrame: { width: 640, height: 480 },
        projectSession: { currentProjectId: null, currentProjectName: null, autosaveStatus: "idle", autosaveError: null }
      },
      setThemeMode: vi.fn(),
      setAccentPreset: vi.fn(),
      setCurrentProjectSession: vi.fn(),
      setProjectAutosaveStatus: vi.fn(),
      resetScene: vi.fn(),
      openSceneDialog: mockOpenSceneDialog,
      replaceSceneDocument: vi.fn(),
      setGraphMode: vi.fn()
    })
}));

vi.mock("@/lib/store/editorStore", () => ({
  useEditorStore: (selector: (state: { showPerfHud: boolean }) => unknown) => selector({ showPerfHud: false })
}));

vi.mock("@/components/ui/portal", () => ({
  Portal: ({ children }: { children: ReactNode }) => <>{children}</>
}));

describe("TopToolbar scene menu", () => {
  it("opens and lists expected grouped actions", () => {
    render(<TopToolbar canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    const menu = screen.getByRole("menu");

    expect(within(menu).getByText("Projects")).toBeInTheDocument();
    expect(within(menu).getByText("Import / Export")).toBeInTheDocument();
    expect(within(menu).getByText("Share")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /New scene/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Save as..." })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Import..." })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Copy share link" })).toBeInTheDocument();
  });

  it("routes actions to existing handlers and closes on Escape", async () => {
    render(<TopToolbar canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Scene" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Open example..." }));
    expect(screen.getByTestId("examples-dialog")).toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Save as..." }));
    expect(screen.getByTestId("project-dialog")).toHaveAttribute("data-mode", "saveAs");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Import..." }));
    expect(mockOpenSceneDialog).toHaveBeenCalledWith("import");

    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menuitem", { name: "New scene" })).not.toBeInTheDocument();
    });
  });
});
