import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AutomaticEquationInput } from "@/components/expressions/AutomaticEquationInput";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

vi.mock("@/components/math/MathInput", async () => {
  const { forwardRef } = await import("react");
  return { MathInput: forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input {...props} ref={ref} />) };
});
beforeEach(() => {
  vi.useFakeTimers();
  useGraphStore.getState().resetScene();
  useGraphStore.getState().setWorkspace("math");
  useEditorStore.getState().setViewportMode("3d");
});
afterEach(() => vi.useRealTimers());

it("keeps one focused editor and one object while adding or removing z", () => {
  render(<AutomaticEquationInput label="New equation" />);
  const input = screen.getByLabelText("New equation"); input.focus();
  fireEvent.change(input, { target: { value: "x=y^2" } });
  act(() => vi.advanceTimersByTime(350));
  const id = useGraphStore.getState().scene.objects[0].id;
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ id, kind: "implicitCurve" }]);
  expect(useEditorStore.getState().viewportMode).toBe("2d");
  fireEvent.change(input, { target: { value: "x=y^2+z^2" } });
  act(() => vi.advanceTimersByTime(350));
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ id, kind: "surface" }]);
  expect(useEditorStore.getState().viewportMode).toBe("3d");
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "x=y^2" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ id, kind: "implicitCurve", equation: "x=y^2" }]);
  expect(input).toHaveValue("");
});

it("keeps invalid drafts visible without overwriting the last valid equation", () => {
  render(<AutomaticEquationInput label="New equation" />);
  const input = screen.getByLabelText("New equation");
  fireEvent.change(input, { target: { value: "x=y^2" } });
  act(() => vi.advanceTimersByTime(350));
  fireEvent.change(input, { target: { value: "x=" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("x=");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("status")).toBeVisible();
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ equation: "x=y^2" }]);
});

it.each(["split", "quad"] as const)("keeps %s open when an equation changes dimension", layout => {
  useEditorStore.getState().setViewportMode(layout);
  render(<AutomaticEquationInput label="New equation" />);
  const input = screen.getByLabelText("New equation");
  for (const equation of ["x=y^2", "x=y^2+z^2", "x=y^2"]) {
    fireEvent.change(input, { target: { value: equation } });
    act(() => vi.advanceTimersByTime(350));
    expect(useEditorStore.getState().viewportMode).toBe(layout);
    expect(useGraphStore.getState().scene.objects).toHaveLength(1);
  }
});

it.each([
  ["x=y^2", "3d", "2d"],
  ["x=y^2+z^2", "2d", "3d"]
] as const)("reveals the first %s equation in an Add-created empty row from %s", (equation, initialView, expectedView) => {
  useEditorStore.getState().setViewportMode(initialView);
  const id = useGraphStore.getState().addEmptyObject();
  render(<AutomaticEquationInput objectId={id} value="" />);
  const input = screen.getByLabelText("Equation");
  input.focus();
  fireEvent.change(input, { target: { value: equation } });
  act(() => vi.advanceTimersByTime(350));
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ id, equation }]);
  expect(useEditorStore.getState().viewportMode).toBe(expectedView);
  expect(input).toHaveFocus();
});

it("does not duplicate a direct equation when Enter is followed by blur", () => {
  render(<AutomaticEquationInput label="New equation" />);
  const input = screen.getByLabelText("New equation");
  fireEvent.change(input, { target: { value: "y=x^2" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.blur(input);
  act(() => vi.advanceTimersByTime(350));
  expect(useGraphStore.getState().scene.objects).toMatchObject([{ equation: "y=x^2" }]);
  expect(useGraphStore.getState().scene.objects).toHaveLength(1);
  expect(input).toHaveValue("");
});
