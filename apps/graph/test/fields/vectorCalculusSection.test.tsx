import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { VectorFieldObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import VectorCalculusSection from "@/components/inspector/VectorCalculusSection";

function addField2D(): string {
  return useGraphStore.getState().addVectorFieldObject("2d");
}

function addField3D(): string {
  return useGraphStore.getState().addVectorFieldObject("3d");
}

function liveField(id: string): VectorFieldObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object || object.kind !== "vectorField") {
    throw new Error("field missing");
  }
  return object;
}

function identityOf(object: VectorFieldObject): string {
  const identity = vectorCalculusSourceIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (identity === null) {
    throw new Error("expected identity");
  }
  return identity;
}

describe("VectorCalculusSection (S22 PART 10/11/12)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("shows point inputs with no values before a point is set", () => {
    const id = addField2D();
    render(<VectorCalculusSection object={liveField(id)} />);
    expect(screen.getByText("Vector Calculus")).toBeDefined();
    expect(screen.getByLabelText("Analysis point x")).toBeDefined();
    expect(screen.getByLabelText("Analysis point y")).toBeDefined();
    expect(screen.queryByTestId("vector-calculus-jacobian")).toBeNull();
  });

  it("shows Jacobian, divergence, and scalar curl for a 2D radial field", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "pExpr", "x");
    store.updateVectorFieldExpression(id, "qExpr", "y");
    const object = liveField(id);
    store.setVectorCalculusPoint(id, { x: 1, y: 2, z: 0 }, identityOf(object));
    render(<VectorCalculusSection object={liveField(id)} />);
    expect(screen.getByTestId("vector-calculus-jacobian")).toBeDefined();
    expect(screen.getByTestId("vector-calculus-divergence").textContent).toMatch(/2/);
    expect(screen.getByTestId("vector-calculus-curl").textContent).toMatch(/0/);
    // 2D has Inspector values only — no 3D curl-vector toggle.
    expect(screen.queryByLabelText("Show curl vector")).toBeNull();
  });

  it("shows a 3D curl vector with toggle and curl components", () => {
    const id = addField3D();
    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "pExpr", "-y");
    store.updateVectorFieldExpression(id, "qExpr", "x");
    store.updateVectorFieldExpression(id, "rExpr", "0");
    const object = liveField(id);
    store.setVectorCalculusPoint(id, { x: 1, y: 1, z: 2 }, identityOf(object));
    render(<VectorCalculusSection object={liveField(id)} />);
    expect(screen.getByTestId("vector-calculus-curl").textContent).toMatch(/2/);
    const toggle = screen.getByLabelText("Show curl vector");
    fireEvent.click(toggle);
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]?.showCurl).toBe(true);
  });

  it("reports outside-domain points without evaluating", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    const object = liveField(id);
    store.setVectorCalculusPoint(id, { x: 999, y: 999, z: 0 }, identityOf(object));
    render(<VectorCalculusSection object={liveField(id)} />);
    expect(screen.getByText(/outside the field domain/)).toBeDefined();
    expect(screen.queryByTestId("vector-calculus-jacobian")).toBeNull();
  });

  it("gates invalid fields without marking the source equation invalid", () => {
    const id = addField3D();
    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "pExpr", "sin(factorial(x))");
    render(<VectorCalculusSection object={liveField(id)} />);
    expect(screen.getByText(/Field has errors/)).toBeDefined();
    // The source object itself still exists and stays selected/rendered.
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toBeDefined();
  });

  it("marks unsupported derivatives unavailable without zero-fill", () => {
    const id = addField3D();
    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "pExpr", "tan(x)");
    store.updateVectorFieldExpression(id, "qExpr", "y");
    store.updateVectorFieldExpression(id, "rExpr", "z");
    const object = liveField(id);
    store.setVectorCalculusPoint(id, { x: 0.5, y: 0, z: 0 }, identityOf(object));
    render(<VectorCalculusSection object={liveField(id)} />);
    expect(screen.getAllByText("unavailable").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it("clears the record from the section", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    const object = liveField(id);
    store.setVectorCalculusPoint(id, { x: 1, y: 1, z: 0 }, identityOf(object));
    render(<VectorCalculusSection object={liveField(id)} />);
    fireEvent.click(screen.getByLabelText("Clear vector calculus analysis"));
    expect(useGraphStore.getState().ui.vectorCalculusBySourceId[id]).toBeUndefined();
  });
});
