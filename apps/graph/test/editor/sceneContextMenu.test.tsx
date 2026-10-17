import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ContextMenu from "@/components/editor/ContextMenu";

it("shows a compact relevant menu and sends real commands", () => {
  const run = vi.fn(); const close = vi.fn();
  render(<ContextMenu open x={9999} y={9999} hasSelection={false} canUndo={false} canRedo={false} onClose={close} onRunCommand={run} />);
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Add equation", "Reset view", "Fit scene"]);
  const menu = screen.getByRole("menu");
  expect(parseFloat(menu.style.left)).toBeLessThan(window.innerWidth);
  fireEvent.click(screen.getByRole("menuitem", { name: "Add equation" }));
  expect(run).toHaveBeenCalledWith("add-expression");
  expect(close).toHaveBeenCalled();
});
it("supports arrows, Home/End, Escape and selected-object actions", () => {
  const close = vi.fn(); const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
  try {
    render(<ContextMenu open x={10} y={10} hasSelection canUndo canRedo={false} onClose={close} onRunCommand={() => {}} />);
    const menu = screen.getByRole("menu");
    expect(screen.getByRole("menuitem", { name: "Add equation" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(screen.getByRole("menuitem", { name: "Remove selected" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Add equation" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(close).toHaveBeenCalled(); expect(trigger).toHaveFocus();
  } finally { trigger.remove(); }
});
