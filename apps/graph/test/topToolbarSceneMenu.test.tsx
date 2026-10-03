import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildShareSceneUrl } from "@/lib/share/shareSceneLink";
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
  useEditorStore: (selector: (state: { showPerfHud: boolean; responsiveComposition: string }) => unknown) =>
    selector({ showPerfHud: false, responsiveComposition: "wide" })
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
    expect(within(menu).getByText("Transfer")).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(8);
    expect(within(menu).queryByText("Show tips again")).not.toBeInTheDocument();
    expect(within(menu).queryByText("Export 3D PNG")).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Share & export..." })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /New scene/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Save as..." })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Import..." })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Copy share link" })).toBeInTheDocument();
  });

  it("refreshes 3D export availability when Share opens after the canvas mounts", () => {
    render(<TopToolbar canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />);
    const canvas = document.createElement("canvas");
    canvas.dataset.graph3dCanvas = "true";
    Object.defineProperties(canvas, {
      clientWidth: { value: 400 }, clientHeight: { value: 300 },
      getClientRects: { value: () => [{ width: 400, height: 300 }] }
    });
    document.body.appendChild(canvas);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Share" }));
      expect(screen.getByRole("button", { name: "3D PNG" })).toBeEnabled();
    } finally {
      canvas.remove();
    }
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


describe("share action feedback", () => {
  const url = "https://vinculum.example/editor?scene=validated-payload";
  it("shows pending and successful clipboard feedback outside the share dialog", async () => {
    let complete!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.mocked(buildShareSceneUrl).mockReturnValue({ ok: true, url });
    render(<TopToolbar canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy share link" }));
    expect(screen.getByRole("status")).toHaveTextContent("Copying link");
    expect(writeText).toHaveBeenCalledWith(url);
    complete();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Share link copied."));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss action feedback" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("provides the actual share link, selected for manual copying, when clipboard access fails", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.mocked(buildShareSceneUrl).mockReturnValue({ ok: true, url });
    render(<TopToolbar canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy share link" }));
    const input = await screen.findByRole("textbox", { name: "Copy share link manually" });
    expect(input).toHaveValue(url);
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).selectionEnd).toBe(url.length);
    expect(screen.getByRole("status")).toHaveTextContent("Copy the selected link below");
    expect(screen.getByRole("button", { name: "2D PNG" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.queryByRole("textbox", { name: "Copy share link manually" })).toBeNull();
  });
});
