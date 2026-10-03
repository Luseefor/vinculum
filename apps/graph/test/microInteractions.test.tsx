import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";

function FocusFixture({ single = false }: { single?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocusTrap({ open: true, containerRef: ref });
  return <div ref={ref} role="dialog" aria-label="Focus fixture"><div hidden><button>Hidden</button></div>
    <button disabled>Disabled</button><button tabIndex={-1}>Skipped</button><button>First</button>{!single && <button>Last</button>}</div>;
}

function PopoverFixture() {
  const [open, setOpen] = useState(false);
  return <><Popover open={open} onOpenChange={setOpen}><PopoverTrigger>{(props) => <button {...props}>Options</button>}</PopoverTrigger>
    <PopoverContent ariaLabel="Test options"><button>Choice</button></PopoverContent></Popover><button>Outside</button></>;
}

describe("small control feedback", () => {
  it("does not submit a form unless requested and exposes active state", () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={submit}><Button isActive>Active tool</Button><Button type="submit">Save</Button></form>);
    fireEvent.click(screen.getByRole("button", { name: "Active tool" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Active tool" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submit).toHaveBeenCalledOnce();
  });
  it("keeps a disabled switch inert and toggles an enabled one", () => {
    const changed = vi.fn();
    const { rerender } = render(<Switch checked={false} disabled ariaLabel="Gradient" onCheckedChange={changed} />);
    fireEvent.click(screen.getByRole("switch", { name: "Gradient" }));
    expect(changed).not.toHaveBeenCalled();
    rerender(<Switch checked={false} ariaLabel="Gradient" onCheckedChange={changed} />);
    fireEvent.click(screen.getByRole("switch", { name: "Gradient" }));
    expect(changed).toHaveBeenCalledWith(true);
  });
  it("keeps a single-control dialog focused on Tab and Shift+Tab", () => {
    render(<FocusFixture single />);
    const first = screen.getByRole("button", { name: "First" });
    expect(first).toHaveFocus();
    for (const shiftKey of [false, true]) {
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(first).toHaveFocus();
    }
  });
  it("skips hidden, disabled, and negative-tab-index dialog controls", () => {
    render(<FocusFixture />);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });
  it("enters a labeled popover and restores focus on Escape", async () => {
    render(<PopoverFixture />);
    const trigger = screen.getByRole("button", { name: "Options" });
    fireEvent.click(trigger);
    const choice = await screen.findByRole("button", { name: "Choice" });
    await waitFor(() => expect(choice).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Test options" })).toBeVisible();
    fireEvent.keyDown(choice, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    await screen.findByRole("button", { name: "Choice" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }), { pointerType: "touch" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});


function MenuDialogFixture() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  return <><DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><DropdownMenuTrigger>{(props) => <button {...props}>Scene</button>}</DropdownMenuTrigger>
    <DropdownMenuContent><DropdownMenuItem disabled>Unavailable</DropdownMenuItem><DropdownMenuItem>First action</DropdownMenuItem><DropdownMenuItem onSelect={() => setDialogOpen(true)}>Open dialog</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogTitle>Action dialog</DialogTitle><button onClick={() => setDialogOpen(false)}>Close action dialog</button></DialogContent></Dialog></>;
}

it("navigates menu items and hands focus to a selected dialog without stealing it back", () => {
  render(<MenuDialogFixture />);
  const trigger = screen.getByRole("button", { name: "Scene" });
  fireEvent.click(trigger);
  expect(screen.getByRole("menuitem", { name: "First action" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "First action" }), { key: "ArrowUp" });
  expect(screen.getByRole("menuitem", { name: "Open dialog" })).toHaveFocus();
  fireEvent.click(screen.getByRole("menuitem", { name: "Open dialog" }));
  expect(screen.getByRole("button", { name: "Close action dialog" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Close action dialog" }));
  expect(trigger).toHaveFocus();
});
