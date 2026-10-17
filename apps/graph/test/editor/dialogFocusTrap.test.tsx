import { useLayoutEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewSceneDialog from "@/components/layout/NewSceneDialog";

describe("Dialog focus trapping", () => {
  it("closes NewSceneDialog on Escape and exposes accessible name", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<NewSceneDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByRole("dialog", { name: /new scene/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("traps Tab within NewSceneDialog (wraps first/last)", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<NewSceneDialog open={true} onConfirm={onConfirm} onCancel={onCancel} />);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    const confirmBtn = screen.getByRole("button", { name: "Create new scene" });

    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(cancelBtn);

    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
  });
});


function ImmediateEscapeDialog({ onReady, onLauncherEscape }: { onReady: (inside: boolean) => void; onLauncherEscape: () => void }) {
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = document.querySelector('[role="dialog"]');
    onReady(Boolean(dialog?.contains(document.activeElement)));
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }, [open, onReady]);
  return <>
    <button onClick={event => { event.currentTarget.focus(); setOpen(true); }}
      onKeyDown={event => { if (event.key === "Escape") onLauncherEscape(); }}>Open examples</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Examples</DialogTitle>
        <DialogDescription>Choose an example.</DialogDescription>
        <input aria-label="Search examples" data-autofocus="true" />
      </DialogContent>
    </Dialog>
  </>;
}

it("an immediate Escape reaches the newly opened dialog and restores its launcher", () => {
  const onReady = vi.fn(), onLauncherEscape = vi.fn();
  render(<ImmediateEscapeDialog onReady={onReady} onLauncherEscape={onLauncherEscape} />);
  const launcher = screen.getByRole("button", { name: "Open examples" });
  fireEvent.click(launcher);
  expect(onReady).toHaveBeenCalledExactlyOnceWith(true);
  expect(onLauncherEscape).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
});
