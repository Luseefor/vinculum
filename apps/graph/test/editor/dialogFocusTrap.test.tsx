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

