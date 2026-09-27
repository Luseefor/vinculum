import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ObjectRow from "@/components/objects/ObjectRow";
import { useGraphStore } from "@/store/graphStore";

function addSurface(equation: string) {
  const state = useGraphStore.getState();
  state.resetScene();
  const id = state.addSurfaceObject();
  state.updateSurfaceEquation(id, equation);
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("surface object was not created");
  }
  return object;
}

describe("ObjectRow workspace behavior", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("selects via keyboard-accessible row button without nested interactivity", () => {
    const object = addSurface("z = x^2 + y^2");
    const onSelect = vi.fn();
    const { container } = render(
      <ObjectRow object={object} index={0} selected={false} onSelect={onSelect} onToggleVisibility={vi.fn()} />
    );
    // No nested interactive elements inside the select control.
    expect(container.querySelector("button button")).toBeNull();
    const selectButton = screen.getByRole("button", { name: "Select Surface #1" });
    selectButton.focus();
    expect(selectButton).toHaveFocus();
    fireEvent.click(selectButton);
    expect(onSelect).toHaveBeenCalledWith(object.id);
  });

  it("shows the equation snippet with full text available", () => {
    const object = addSurface("z = x^2 + y^2");
    render(
      <ObjectRow object={object} index={0} selected={true} onSelect={vi.fn()} onToggleVisibility={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Selected Surface #1" })).toBeInTheDocument();
    expect(screen.getByText("z = x^2 + y^2")).toHaveAttribute("title", "z = x^2 + y^2");
  });

  it("displays inline diagnostics for invalid equations and clears them when fixed", () => {
    const object = addSurface("z = x^2 + y^2");
    render(
      <ObjectRow object={object} index={0} selected={true} onSelect={vi.fn()} onToggleVisibility={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand definition" }));
    const input = screen.getByRole("textbox", { name: "Equation" });
    expect(screen.queryByTestId("expression-diagnostic")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "sin(" } });
    expect(screen.getByTestId("expression-diagnostic")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "z = sin(x)" } });
    expect(screen.queryByTestId("expression-diagnostic")).not.toBeInTheDocument();
  });

  it("keeps the visibility toggle discoverable without hover", () => {
    const object = addSurface("z = x^2 + y^2");
    render(
      <ObjectRow object={object} index={0} selected={false} onSelect={vi.fn()} onToggleVisibility={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Hide object" })).toBeVisible();
  });
});

describe("ObjectRow drag-transaction safety (S33-R7)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("refuses row-menu deletion while a drag transaction is active", async () => {
    const { beginDragTransaction, resetDragTransactionForTests } = await import(
      "@/lib/interaction/dragHistoryTransaction"
    );
    const object = addSurface("z = x^2 + y^2");
    render(
      <ObjectRow object={object} index={0} selected={true} onSelect={vi.fn()} onToggleVisibility={vi.fn()} />
    );
    expect(beginDragTransaction(object.id)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Object actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    // Guarded like the Delete key and palette paths: the object survives,
    // so no undo entry is silently lost mid-drag.
    expect(
      useGraphStore.getState().scene.objects.find((candidate) => candidate.id === object.id)
    ).toBeDefined();
    resetDragTransactionForTests();
    fireEvent.click(screen.getByRole("button", { name: "Object actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(
      useGraphStore.getState().scene.objects.find((candidate) => candidate.id === object.id)
    ).toBeUndefined();
  });
});
