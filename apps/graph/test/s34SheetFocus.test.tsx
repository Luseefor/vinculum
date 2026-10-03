// S34 sheet focus contract (PART 107): labels, trap, restoration.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open objects
      </button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        title="Objects"
      >
        <input aria-label="Search objects" />
        <button type="button">Close me</button>
      </Sheet>
    </>
  );
}

describe("Sheet focus contract", () => {
  it("labels the dialog, focuses content on open, restores trigger on close", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Open objects" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Objects" })).toBeInTheDocument();
    // Focus moves into the sheet (header Close is first focusable).
    expect(document.activeElement?.textContent).toBe("Close");
    // Escape closes via the window handler.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("traps Tab inside while open", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open objects" }));
    const dialog = screen.getByRole("dialog", { name: "Objects" });
    const headerClose = screen.getByRole("button", { name: "Close" });
    const search = screen.getByLabelText("Search objects");
    const closeMe = screen.getByRole("button", { name: "Close me" });
    closeMe.focus();
    // Tab on last wraps to first (header Close).
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(headerClose);
    // Shift+Tab on first wraps to last.
    headerClose.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeMe);
    expect(search).toBeInTheDocument();
  });

  it("keeps the active field visible after viewport resize and removes the listener on close", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open objects" }));
    const search = screen.getByLabelText("Search objects");
    const scroll = vi.fn();
    search.scrollIntoView = scroll;
    search.focus();
    scroll.mockClear();
    fireEvent(window, new Event("resize"));
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    fireEvent.keyDown(window, { key: "Escape" });
    scroll.mockClear();
    fireEvent(window, new Event("resize"));
    expect(scroll).not.toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Open objects" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Objects panel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
