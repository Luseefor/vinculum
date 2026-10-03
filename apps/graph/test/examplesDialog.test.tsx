import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ExamplesDialog from "@/components/templates/ExamplesDialog";
import { SCENE_EXAMPLES } from "@/lib/templates/examplesRegistry";

it("searches examples and opens the selected canonical scene", () => {
  const open = vi.fn();
  render(<ExamplesDialog open examples={SCENE_EXAMPLES} error={null} onClose={vi.fn()} onOpenExample={open} />);
  expect(screen.getByRole("searchbox", { name: "Search examples" })).toHaveFocus();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "helix" } });
  expect(screen.getAllByRole("button", { name: /^Open example:/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Open example: Helix Curve" }));
  expect(open).toHaveBeenCalledWith("curve-helix");
});

it("combines topic and search filters and recovers from no matches", () => {
  render(<ExamplesDialog open examples={SCENE_EXAMPLES} error={null} onClose={vi.fn()} onOpenExample={vi.fn()} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Example topic" }), { target: { value: "Planes" } });
  expect(screen.getAllByRole("button", { name: /^Open example:/ })).toHaveLength(SCENE_EXAMPLES.filter(e => e.category === "Planes").length);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "helix" } });
  expect(screen.getByRole("status")).toHaveTextContent("No examples match your search.");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getAllByRole("button", { name: /^Open example:/ })).toHaveLength(SCENE_EXAMPLES.length);
});

it("shows empty and error states and closes with Escape", () => {
  const close = vi.fn();
  render(<ExamplesDialog open examples={[]} error="Could not open this example. Try another scene." onClose={close} onOpenExample={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent("No examples are available.");
  expect(screen.getByRole("alert")).toHaveTextContent("Try another scene.");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(close).toHaveBeenCalled();
});

it("clears filters when the gallery is reopened", () => {
  const props = { examples: SCENE_EXAMPLES, error: null, onClose: vi.fn(), onOpenExample: vi.fn() };
  const { rerender } = render(<ExamplesDialog {...props} open />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "helix" } });
  rerender(<ExamplesDialog {...props} open={false} />);
  rerender(<ExamplesDialog {...props} open />);
  expect(screen.getByRole("searchbox")).toHaveValue("");
  expect(screen.getAllByRole("button", { name: /^Open example:/ })).toHaveLength(SCENE_EXAMPLES.length);
});
