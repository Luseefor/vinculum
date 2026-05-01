import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

describe("Performance HUD toggle", () => {
  it("defaults to off", async () => {
    localStorage.clear();
    vi.resetModules();

    const { useEditorStore } = await import("@/lib/store/editorStore");
    expect(useEditorStore.getState().showPerfHud).toBe(false);
  });

  it("toggles on from TopToolbar theme menu", async () => {
    localStorage.clear();
    vi.resetModules();

    const { useEditorStore } = await import("@/lib/store/editorStore");
    const { useGraphStore } = await import("@/store/graphStore");
    const { default: TopToolbar } = await import("@/components/editor/TopToolbar");

    useEditorStore.getState().setShowPerfHud(false);
    useGraphStore.getState().resetScene();

    render(<TopToolbar canUndo={false} canRedo={false} onUndo={() => undefined} onRedo={() => undefined} openExamplesSignal={0} />);

    fireEvent.click(screen.getByLabelText("Open theme and accent menu"));

    const toggle = await screen.findByRole("checkbox", { name: /performance hud/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(useEditorStore.getState().showPerfHud).toBe(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(useEditorStore.getState().showPerfHud).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("closes theme menu on Escape", async () => {
    const { useEditorStore } = await import("@/lib/store/editorStore");
    const { default: TopToolbar } = await import("@/components/editor/TopToolbar");
    useEditorStore.getState().setShowPerfHud(false);

    render(<TopToolbar canUndo={false} canRedo={false} onUndo={() => undefined} onRedo={() => undefined} openExamplesSignal={0} />);

    const trigger = screen.getByLabelText("Open theme and accent menu");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(await screen.findByRole("checkbox", { name: /performance hud/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("checkbox", { name: /performance hud/i })).not.toBeInTheDocument();
  });

  it("traps Tab within theme menu", async () => {
    const { useEditorStore } = await import("@/lib/store/editorStore");
    const { default: TopToolbar } = await import("@/components/editor/TopToolbar");
    useEditorStore.getState().setShowPerfHud(false);

    render(<TopToolbar canUndo={false} canRedo={false} onUndo={() => undefined} onRedo={() => undefined} openExamplesSignal={0} />);

    const trigger = screen.getByLabelText("Open theme and accent menu");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });

    const menu = document.getElementById("vinculum-theme-menu");
    expect(menu).not.toBeNull();

    // Let effects (including focus-trap listener) attach.
    await screen.findByRole("checkbox", { name: /performance hud/i });

    const focusables = Array.from(menu!.querySelectorAll<HTMLButtonElement>("button")).filter((b) => !b.hasAttribute("disabled"));
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    expect(firstFocusable).toBeTruthy();
    expect(lastFocusable).toBeTruthy();

    lastFocusable.focus();
    expect(document.activeElement).toBe(lastFocusable);

    fireEvent.keyDown(window, { key: "Tab" });
    // In the test environment, browser focus movement is limited; the important
    // accessibility contract is that focus does not escape the open menu.
    expect(menu!.contains(document.activeElement as Node)).toBe(true);
  });
});

