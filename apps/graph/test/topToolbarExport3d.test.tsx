import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import TopToolbar from "@/components/editor/TopToolbar";

const mockExport3dPngFromCanvas = vi.fn();
const mockTriggerSceneExportDownload = vi.fn();

vi.mock("@/lib/export/sceneExport", () => ({
  exportSceneJson: vi.fn(),
  export2dPngFromCanvas: vi.fn(),
  export2dSvg: vi.fn(),
  export3dPngFromCanvas: (...args: unknown[]) => mockExport3dPngFromCanvas(...args),
  triggerSceneExportDownload: (...args: unknown[]) => mockTriggerSceneExportDownload(...args)
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

vi.mock("@/components/ui/portal", () => ({
  Portal: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/lib/store/historyStore", () => ({
  useHistoryStore: (selector: (state: { clear: () => void }) => unknown) =>
    selector({ clear: vi.fn() })
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
        axis2dPairQuadTop: "xz",
        viewport2d: { centerX: 0, centerY: 0, scale: 80 },
        viewport2dQuadTop: { centerX: 0, centerY: 0, scale: 80 },
        viewport2dFrame: { width: 640, height: 480 },
        viewport2dQuadTopFrame: { width: 640, height: 480 },
        projectSession: {
          currentProjectId: null,
          currentProjectName: null,
          autosaveStatus: "idle",
          autosaveError: null
        }
      },
      setThemeMode: vi.fn(),
      setAccentPreset: vi.fn(),
      setCurrentProjectSession: vi.fn(),
      setProjectAutosaveStatus: vi.fn(),
      resetScene: vi.fn(),
      openSceneDialog: vi.fn(),
      replaceSceneDocument: vi.fn()
    })
}));

describe("TopToolbar 3D export action", () => {
  it("calls canonical 3D export path from file menu", async () => {
    mockExport3dPngFromCanvas.mockResolvedValue({
      ok: true,
      file: {
        kind: "png3d",
        blob: new Blob(["x"], { type: "image/png" }),
        filename: "scene-3d.png",
        contentType: "image/png"
      }
    });
    mockTriggerSceneExportDownload.mockReturnValue({ ok: true });

    render(<TopToolbar canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /scene/i }));
    fireEvent.click(screen.getByRole("button", { name: "Export 3D PNG" }));

    await waitFor(() => {
      expect(mockExport3dPngFromCanvas).toHaveBeenCalledTimes(1);
      expect(mockTriggerSceneExportDownload).toHaveBeenCalledTimes(1);
    });
  });
});
