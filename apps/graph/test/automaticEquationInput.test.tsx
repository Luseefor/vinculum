import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AutomaticEquationInput } from "@/components/expressions/AutomaticEquationInput";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

vi.mock("@/components/math/MathInput", async () => {
  const { forwardRef } = await import("react");
  return { MathInput: forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input {...props} ref={ref} />) };
});
beforeEach(() => { vi.useFakeTimers(); useGraphStore.getState().resetScene(); });
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
