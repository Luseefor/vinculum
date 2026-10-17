import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EditorGuide from "@/components/onboarding/EditorGuide";
import CanvasEmptyState from "@/components/viewport/CanvasEmptyState";
import { useGraphStore } from "@/store/graphStore";

describe("editor discovery", () => {
  it("offers real task handoffs and documentation", () => {
    const callbacks = { onOpenChange: vi.fn(), onShowObjects: vi.fn(), onShowInspector: vi.fn(), onOpenSolver: vi.fn(), onOpenExamples: vi.fn() };
    render(<EditorGuide open {...callbacks} />);
    for (const [label, callback] of [["Show Objects", callbacks.onShowObjects], ["Show Inspector", callbacks.onShowInspector], ["Start solving", callbacks.onOpenSolver], ["Browse examples", callbacks.onOpenExamples]] as const) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(callback).toHaveBeenCalledOnce();
    }
    expect(screen.getByRole("link", { name: /Full documentation/ })).toHaveAttribute("href", "/documentations");
    fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
    expect(callbacks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("creates the surface promised by the geometry empty hint", () => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setWorkspace("geometry");
    render(<CanvasEmptyState workspaceId="geometry" />);
    expect(screen.getByRole("button", { name: "Create Point" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Infinite Line" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Surface" }));
    expect(useGraphStore.getState().scene.objects[0]?.kind).toBe("surface");
    expect(screen.queryByRole("button", { name: "Create Surface" })).not.toBeInTheDocument();
  });

  it("explains math starters and opens help without changing the scene", () => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setWorkspace("math");
    const onOpenGuide = vi.fn();
    render(<CanvasEmptyState workspaceId="math" onOpenGuide={onOpenGuide} />);
    expect(screen.getByRole("button", { name: "Create 2D Vector Field" })).toHaveTextContent("Arrows + flow");
    fireEvent.click(screen.getByRole("button", { name: "Where are the tools?" }));
    expect(onOpenGuide).toHaveBeenCalledOnce();
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });
  it("hides and reopens the launcher with focus and no scene changes", () => {
    const store = useGraphStore.getState();
    store.resetScene();
    store.setWorkspace("math");
    store.setCanvas2dTool("pan");
    store.setCanvas3dTool("pan");
    const onStart = vi.fn();
    render(<CanvasEmptyState workspaceId="math" onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide start panel" }));
    const reopen = screen.getByRole("button", { name: "Show start panel" });
    expect(reopen).toHaveFocus();
    expect(screen.queryByTestId("canvas-empty-state")).toBeNull();
    expect(onStart).toHaveBeenCalledOnce();
    fireEvent.click(reopen);
    const close = screen.getByRole("button", { name: "Hide start panel" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Show start panel" })).toHaveFocus();
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  });

  it("starts minimized in Quad without losing dismissal state in other layouts", () => {
    const store = useGraphStore.getState();
    store.resetScene();
    store.setWorkspace("math");
    store.setCanvas2dTool("pan");
    store.setCanvas3dTool("pan");
    const onStart = vi.fn();
    const view = render(<CanvasEmptyState workspaceId="math" startMinimized onStart={onStart} />);
    expect(screen.queryByTestId("canvas-empty-state")).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show start panel" }));
    expect(screen.getByRole("button", { name: "Hide start panel" })).toHaveFocus();
    view.rerender(<CanvasEmptyState workspaceId="math" onStart={onStart} />);
    expect(screen.getByTestId("canvas-empty-state")).toBeVisible();
    view.rerender(<CanvasEmptyState workspaceId="math" startMinimized onStart={onStart} />);
    expect(screen.queryByTestId("canvas-empty-state")).toBeNull();
    expect(store.scene.objects).toHaveLength(0);
  });

  it("keeps examples and the first-run guide inside the same launcher", () => {
    const store = useGraphStore.getState();
    store.resetScene();
    store.setWorkspace("math");
    store.setCanvas2dTool("pan");
    store.setCanvas3dTool("pan");
    const onOpenExamples = vi.fn();
    render(<CanvasEmptyState workspaceId="math" onOpenExamples={onOpenExamples} gettingStarted={<aside>Quick tips</aside>} />);
    const panel = screen.getByRole("region", { name: "Start panel" });
    expect(panel).toContainElement(screen.getByText("Quick tips"));
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));
    expect(onOpenExamples).toHaveBeenCalledOnce();
    expect(store.scene.objects).toHaveLength(0);
  });
});

describe("empty canvas input", () => {
  it.each(["draw", "probe", "addPin", "measureDistance", "measureAngle"] as const)("yields to the %s tool in each dimension", tool => {
    const store = useGraphStore.getState();
    store.resetScene();
    store.setWorkspace("math");
    store.setCanvas2dTool(tool);
    store.setCanvas3dTool(tool);
    const view = render(<CanvasEmptyState workspaceId="math" dimension="2d" />);
    expect(screen.queryByTestId("canvas-empty-state")).toBeNull();
    view.rerender(<CanvasEmptyState workspaceId="math" dimension="3d" />);
    expect(screen.queryByTestId("canvas-empty-state")).toBeNull();
  });

  it.each(["2d", "3d"] as const)("uses the %s pane's tool, preserving the other dimension's preference", dimension => {
    const store = useGraphStore.getState();
    store.resetScene();
    store.setWorkspace("math");
    store.setCanvas2dTool(dimension === "2d" ? "pan" : "draw");
    store.setCanvas3dTool(dimension === "3d" ? "pan" : "draw");
    render(<CanvasEmptyState workspaceId="math" dimension={dimension} />);
    expect(screen.getByTestId("canvas-empty-state")).toBeVisible();
  });

  it("yields to Geometry Studio's tool even when Math Lab's last dimension was 2D", () => {
    const store = useGraphStore.getState();
    store.resetScene();
    store.setWorkspace("geometry");
    store.setGraphMode("2d");
    store.setCanvas2dTool("pan");
    store.setCanvas3dTool("draw");
    render(<CanvasEmptyState workspaceId="geometry" />);
    expect(screen.queryByTestId("canvas-empty-state")).toBeNull();
  });
});
