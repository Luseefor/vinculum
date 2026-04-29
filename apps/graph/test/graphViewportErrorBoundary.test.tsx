import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GraphViewportErrorBoundary from "@/components/graph/GraphViewportErrorBoundary";

function ThrowOnRender(): never {
  throw new Error("render failed");
}

describe("GraphViewportErrorBoundary", () => {
  it("renders fallback and does not expose raw stack traces", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <GraphViewportErrorBoundary>
        <ThrowOnRender />
      </GraphViewportErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText(/render failed/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("retry remounts boundary content", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Stable = () => <div>healthy child</div>;
    const { rerender } = render(
      <GraphViewportErrorBoundary>
        <ThrowOnRender />
      </GraphViewportErrorBoundary>
    );

    rerender(
      <GraphViewportErrorBoundary>
        <Stable />
      </GraphViewportErrorBoundary>
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("healthy child")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("fallback actions trigger reset and export handlers", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onResetView = vi.fn();
    const onExportSceneJson = vi.fn();
    render(
      <GraphViewportErrorBoundary onResetView={onResetView} onExportSceneJson={onExportSceneJson}>
        <ThrowOnRender />
      </GraphViewportErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    fireEvent.click(screen.getByRole("button", { name: "Export scene JSON" }));
    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(onExportSceneJson).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
