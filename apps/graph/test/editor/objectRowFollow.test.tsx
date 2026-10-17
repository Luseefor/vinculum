import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import ObjectTree from "@/components/objects/ObjectTree";
import { useGraphStore } from "@/store/graphStore";

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

describe("S31 row-follow policy (Part 2)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("scrolls an offscreen selected row into view without expanding it", () => {
    const store = useGraphStore.getState();
    const first = store.addPointObject();
    store.addPointObject();
    const { container } = render(<ObjectTree />);
    const buttons = screen.getAllByRole("button", { name: /^(Select|Selected) Point #/ });
    expect(buttons).toHaveLength(2);
    const list = container.firstElementChild as HTMLElement;
    const row = buttons[0] as HTMLElement;
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 100));
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(500, 533));
    const scrolled = vi.fn();
    (row as unknown as Record<string, unknown>).scrollIntoView = scrolled;

    act(() => {
      useGraphStore.getState().selectObject(first);
    });

    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    // Selection never forces row expansion: the definition stays collapsed.
    expect(screen.queryByLabelText("Point x")).not.toBeInTheDocument();
  });

  it("leaves an already-visible selected row alone", () => {
    const store = useGraphStore.getState();
    store.addPointObject();
    const second = store.addPointObject();
    const { container } = render(<ObjectTree />);
    const buttons = screen.getAllByRole("button", { name: /^(Select|Selected) Point #/ });
    const list = container.firstElementChild as HTMLElement;
    const row = buttons[1] as HTMLElement;
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 500));
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(10, 43));
    const scrolled = vi.fn();
    (row as unknown as Record<string, unknown>).scrollIntoView = scrolled;

    act(() => {
      useGraphStore.getState().selectObject(second);
    });

    expect(scrolled).not.toHaveBeenCalled();
  });
});
