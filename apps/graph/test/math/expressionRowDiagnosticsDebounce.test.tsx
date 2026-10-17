import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExpressionRow from "@/components/expressions/ExpressionRow";
import { useGraphStore } from "@/store/graphStore";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import type { ParametricCurveObject, SurfaceGraphObject } from "@vinculum/scene/types";

describe("ExpressionRow math input diagnostics + debounce", () => {
  it("shows inline diagnostics for invalid surface drafts and does not commit", () => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();

    const surface = createSurfaceGraph({ id: "surface-1", equation: "z = sin(x)" });
    const scene = createSceneDocument({ objects: [surface], metadata: { name: "Test" } });
    useGraphStore.setState((state) => ({ ...state, scene }));

    const committed = scene.objects.find((o): o is SurfaceGraphObject => o.kind === "surface")!;

    render(
      <ExpressionRow
        object={committed}
        isSelected={true}
        canRemoveWithBackspace={true}
        registerInputRef={() => {}}
        onSelect={() => {}}
        onMoveFocus={() => {}}
        onInsertBelow={() => {}}
        onRemove={() => {}}
        onOpenInspector={() => {}}
      />
    );

    const input = screen.getByLabelText("Surface equation") as HTMLInputElement;
    const before = useGraphStore.getState().scene.objects.find(
      (o): o is SurfaceGraphObject => o.id === committed.id && o.kind === "surface"
    )!.equation;

    fireEvent.change(input, { target: { value: "z = sin(" } });

    const diag = screen.getByTestId("expression-diagnostic");
    expect(input.getAttribute("aria-describedby")).toBe(diag.id);
    expect(diag).toHaveTextContent(/Invalid expression syntax/i);
    expect(diag.textContent).not.toMatch(/\b(at|stack)\b/i);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const after = useGraphStore.getState().scene.objects.find(
      (o): o is SurfaceGraphObject => o.id === committed.id && o.kind === "surface"
    )!.equation;
    expect(after).toBe(before);

    vi.useRealTimers();
  });

  it("commits valid surface drafts after debounce", () => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();

    const surface = createSurfaceGraph({ id: "surface-2", equation: "z = x" });
    const scene = createSceneDocument({ objects: [surface], metadata: { name: "Test" } });
    useGraphStore.setState((state) => ({ ...state, scene }));
    const committed = scene.objects.find((o): o is SurfaceGraphObject => o.kind === "surface")!;

    render(
      <ExpressionRow
        object={committed}
        isSelected={true}
        canRemoveWithBackspace={true}
        registerInputRef={() => {}}
        onSelect={() => {}}
        onMoveFocus={() => {}}
        onInsertBelow={() => {}}
        onRemove={() => {}}
        onOpenInspector={() => {}}
      />
    );

    const input = screen.getByLabelText("Surface equation") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "z = sin(x)" } });
    expect(screen.queryByTestId("expression-diagnostic")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const after = useGraphStore.getState().scene.objects.find(
      (o): o is SurfaceGraphObject => o.id === committed.id && o.kind === "surface"
    )!.equation;
    expect(after).toBe("z = sin(x)");

    vi.useRealTimers();
  });

  it("reverts invalid drafts on Escape", () => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();

    const surface = createSurfaceGraph({ id: "surface-esc", equation: "z = x" });
    const scene = createSceneDocument({ objects: [surface], metadata: { name: "Test" } });
    useGraphStore.setState((state) => ({ ...state, scene }));
    const committed = scene.objects.find((o): o is SurfaceGraphObject => o.kind === "surface")!;

    render(
      <ExpressionRow
        object={committed}
        isSelected={true}
        canRemoveWithBackspace={true}
        registerInputRef={() => {}}
        onSelect={() => {}}
        onMoveFocus={() => {}}
        onInsertBelow={() => {}}
        onRemove={() => {}}
        onOpenInspector={() => {}}
      />
    );

    const input = screen.getByLabelText("Surface equation") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "z = sin(" } });
    expect(screen.getByTestId("expression-diagnostic")).toHaveTextContent(/Invalid expression syntax/i);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("z = x");
    expect(screen.queryByTestId("expression-diagnostic")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("shows inline diagnostics for invalid parametric x drafts and does not commit", () => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    window.localStorage.clear();

    const curve = createParametricCurve({
      id: "curve-1",
      xExpr: "t",
      yExpr: "sin(t)",
      zExpr: "0"
    });

    const scene = createSceneDocument({ objects: [curve], metadata: { name: "Test" } });
    useGraphStore.setState((state) => ({ ...state, scene }));
    const committed = scene.objects.find((o): o is ParametricCurveObject => o.kind === "parametricCurve")!;

    render(
      <ExpressionRow
        object={committed}
        isSelected={true}
        canRemoveWithBackspace={true}
        registerInputRef={() => {}}
        onSelect={() => {}}
        onMoveFocus={() => {}}
        onInsertBelow={() => {}}
        onRemove={() => {}}
        onOpenInspector={() => {}}
      />
    );

    const xInput = screen.getByLabelText("Parametric x expression") as HTMLInputElement;
    expect(xInput.value).toBe(committed.xExpr);

    fireEvent.change(xInput, { target: { value: "factorial(t)" } });
    const diag = screen.getByTestId("expression-diagnostic");
    expect(xInput.getAttribute("aria-describedby")).toBe(diag.id);
    expect(diag).toHaveTextContent(/Unsupported function/i);
    expect(diag.textContent).not.toMatch(/\b(at|stack)\b/i);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    const after = useGraphStore.getState().scene.objects.find(
      (o): o is ParametricCurveObject => o.id === committed.id && o.kind === "parametricCurve"
    )!.xExpr;
    expect(after).toBe("t");

    vi.useRealTimers();
  });
});

