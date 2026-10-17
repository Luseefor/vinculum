import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CanvasToolbar from "@/components/editor/CanvasToolbar";
import ContextMenu from "@/components/editor/ContextMenu";
import CommandPalette from "@/components/editor/CommandPalette";
import { useGraphStore } from "@/store/graphStore";

it("enables framing in both math views and Geometry Studio", () => {
  useGraphStore.getState().setWorkspace("math");
  const fit = vi.fn();
  const view = render(<CanvasToolbar viewControls={{ activeViewType: "2d" }} onFitScene={fit} />);
  const button = screen.getByRole("button", { name: "Zoom to fit all objects" });
  expect(button).toBeEnabled();
  expect(button).toHaveAttribute("title", "Zoom to fit all objects (F)");
  fireEvent.click(button);
  expect(fit).toHaveBeenCalledTimes(1);
  view.rerender(<CanvasToolbar viewControls={{ activeViewType: "3d" }} onFitScene={fit} />);
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(fit).toHaveBeenCalledTimes(2);
  view.unmount();
  useGraphStore.getState().setWorkspace("geometry");
  render(<CanvasToolbar viewControls={{ activeViewType: "2d" }} onFitScene={fit} />);
  expect(screen.getByRole("button", { name: "Zoom to fit all objects" })).toBeEnabled();
});

it("keeps unavailable framing out of the scene context menu", () => {
  render(<ContextMenu open x={10} y={10} canFrame={false} hasSelection canUndo={false} canRedo={false} onClose={vi.fn()} onRunCommand={vi.fn()} />);
  expect(screen.queryByRole("menuitem", { name: "Fit scene" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Frame selected" })).toBeNull();
  expect(screen.getByRole("menuitem", { name: "Reset view" })).toBeEnabled();
});

it("keeps unavailable framing out of palette search and keyboard execution", () => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  const run = vi.fn();
  render(<CommandPalette open canFrame={false} onClose={vi.fn()} onRunCommand={run} />);
  const search = screen.getByRole("textbox", { name: "Command search" });
  fireEvent.change(search, { target: { value: "Fit Scene" } });
  expect(screen.queryByRole("option", { name: "Fit Scene" })).toBeNull();
  fireEvent.keyDown(search, { key: "Enter" });
  expect(run).not.toHaveBeenCalled();
});
