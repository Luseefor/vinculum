// S32 gap-fill: independent verification found four meaningful untested
// branches in the S32 presentation contract. ENGINE FREEZE: UI/store
// presentation only, no math/worker/persistence changes.

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import InspectorPanel from "@/components/layout/InspectorPanel";
import ObjectInspector from "@/components/inspector/ObjectInspector";
import VectorCalculusSection from "@/components/inspector/VectorCalculusSection";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";

function resetScene() {
  useGraphStore.getState().resetScene();
  useHistoryStore.getState().clear();
}

describe("S32 gaps: dimension-precise vector calculus wording", () => {
  beforeEach(() => {
    resetScene();
  });

  it("3D empty state says curl (not scalar curl) with matching header", () => {
    const state = useGraphStore.getState();
    const id = state.addVectorFieldObject("3d");
    state.selectObject(id);
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    if (!object || object.kind !== "vectorField") {
      throw new Error("expected 3d vector field");
    }
    render(<VectorCalculusSection object={object} />);
    // Header distinguishes the 3D vector curl from the 2D scalar curl.
    expect(screen.queryByText(/Pointwise Jacobian/)).toBeNull();
    expect(screen.queryByText(/scalar curl/)).toBeNull();
    // Empty state instructs with the same 3D wording, no Jacobian table.
    expect(screen.getByText(/Enter a point in the field domain/)).toBeDefined();
    expect(screen.getByText(/divergence, and curl\./)).toBeDefined();
    expect(screen.queryByTestId("vector-calculus-jacobian")).toBeNull();
  });

  it("2D header keeps the scalar-curl wording (contrast guard)", () => {
    const state = useGraphStore.getState();
    const id = state.addVectorFieldObject("2d");
    state.selectObject(id);
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    if (!object || object.kind !== "vectorField") {
      throw new Error("expected 2d vector field");
    }
    render(<VectorCalculusSection object={object} />);
    expect(screen.getAllByText(/scalar curl/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("S32 gaps: history/persistence isolation", () => {
  beforeEach(() => {
    resetScene();
  });

  it("history snapshots carry only objects/measurements/selection (no workspace/view/analysis)", () => {
    const state = useGraphStore.getState();
    const surfaceId = state.addSurfaceObject();
    state.updateSurfaceEquation(surfaceId, "x^2 + y^2");
    state.selectObject(surfaceId);
    const snapshot = getCurrentSceneSnapshot();
    // Exact key contract: UI-only state (workspace, graphMode, tabs,
    // analysis configs, streamline) must never enter undo history.
    expect(Object.keys(snapshot).sort()).toEqual(["measurements", "objects", "selection"]);
    expect(Object.keys(snapshot.selection).sort()).toEqual(["selectedObjectId"]);
  });

  it("pure UI nav (workspace/view/streamline) leaves snapshot and history untouched", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.updateSurfaceEquation(surfaceId, "x^2 + y^2");
    const fieldId = store.addVectorFieldObject("2d");
    store.updateVectorFieldExpression(fieldId, "pExpr", "-y");
    store.updateVectorFieldExpression(fieldId, "qExpr", "x");
    store.selectObject(surfaceId);
    const before = getCurrentSceneSnapshot();
    const pastBefore = useHistoryStore.getState().past.length;
    // Pure UI navigation: no object/selection edits.
    useGraphStore.getState().setWorkspace("geometry");
    useGraphStore.getState().setWorkspace("math");
    useGraphStore.getState().setGraphMode("2d");
    useGraphStore.getState().setGraphMode("3d");
    useGraphStore.getState().setStreamlineConfig(fieldId, { enabled: true }, "test-structure");
    useGraphStore.getState().clearStreamline(fieldId);
    // Analysis UI point (differential) must not leak into the snapshot either.
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === surfaceId);
    if (!object || object.kind !== "surface") {
      throw new Error("expected surface");
    }
    const identity = analysisSourceIdentity(object);
    if (identity) {
      useGraphStore.getState().setDifferentialAnalysisPoint(surfaceId, { x: 1, y: 1, z: 2 }, identity);
    }
    const after = getCurrentSceneSnapshot();
    expect(after).toEqual(before);
    expect(useHistoryStore.getState().past.length).toBe(pastBefore);
    // Cleanup analysis record so later tests start clean (resetScene covers
    // store, but be explicit about UI-only residue).
    useGraphStore.getState().clearDifferentialAnalysis(surfaceId);
  });
});

describe("S32 gaps: surface domain ordering and tuple draft preservation", () => {
  beforeEach(() => {
    resetScene();
  });

  it("surface domain follows x min → x max → y min → y max in DOM order", () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    state.selectObject(id);
    render(<ObjectInspector />);
    const order = [
      screen.getByLabelText("x min"),
      screen.getByLabelText("x max"),
      screen.getByLabelText("y min"),
      screen.getByLabelText("y max")
    ];
    const positions = order.map((element) =>
      Array.from(document.querySelectorAll("input, select, button, summary")).indexOf(element)
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("parametric tuple draft survives Object→Analyze→Object", () => {
    const state = useGraphStore.getState();
    const id = state.addParametricCurve();
    state.selectObject(id);
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    const xInput = screen.getByLabelText("Parametric x(t)") as HTMLInputElement;
    fireEvent.focus(xInput);
    fireEvent.change(xInput, { target: { value: "cos(t) + " } });
    // Per-keystroke canonical commit (shared ExpressionInput discipline).
    expect(
      (useGraphStore.getState().scene.objects.find((o) => o.id === id) as { xExpr: string }).xExpr
    ).toBe("cos(t) + ");
    fireEvent.click(screen.getByRole("tab", { name: "Analyze" }));
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    expect((screen.getByLabelText("Parametric x(t)") as HTMLInputElement).value).toBe("cos(t) + ");
  });
});
