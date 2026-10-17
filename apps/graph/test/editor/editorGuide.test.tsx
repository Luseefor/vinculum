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
});
