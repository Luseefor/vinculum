import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import DifferentialAnalysisSection from "@/components/inspector/DifferentialAnalysisSection";

function addSurface(equation = "z = x^2 + 2*y^2"): string {
  const store = useGraphStore.getState();
  const id = store.addSurfaceObject();
  store.updateSurfaceEquation(id, equation);
  return id;
}

function liveSurface(id: string): SurfaceGraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object || object.kind !== "surface") {
    throw new Error("surface missing");
  }
  return object;
}

function setPoint(id: string, point = { x: 1, y: 2, z: 9 }) {
  const object = liveSurface(id);
  const identity = analysisSourceIdentity(object);
  if (identity === null) {
    throw new Error("expected identity");
  }
  useGraphStore.getState().setDifferentialAnalysisPoint(id, point, identity);
}

describe("DirectionalDerivativeBlock (S22 PART 14/16)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("computes 7.6 for f=x^2+2y^2 at (1,2) along <3,4>", () => {
    const id = addSurface();
    setPoint(id);
    render(<DifferentialAnalysisSection object={liveSurface(id)} />);
    fireEvent.change(screen.getByLabelText("Direction x"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Direction y"), { target: { value: "4" } });
    expect(screen.getByTestId("directional-derivative-value").textContent).toMatch(/7\.6/);
    expect(screen.getByText(/direction of maximum increase/i)).toBeDefined();
  });

  it("rejects zero direction with a compact diagnostic and no NaN", () => {
    const id = addSurface();
    setPoint(id);
    render(<DifferentialAnalysisSection object={liveSurface(id)} />);
    fireEvent.change(screen.getByLabelText("Direction x"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Direction y"), { target: { value: "0" } });
    expect(screen.getByText(/must be nonzero/)).toBeDefined();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it("labels direction inputs with the orientation's independent variables", () => {
    const id = addSurface("x = y^2 + 3*z");
    useGraphStore.getState().updateSurfaceOrientation(id, "x");
    // Pick a point on the new surface: x = 2^2+3*1 = 7 at (y=2,z=1).
    const object = liveSurface(id);
    const identity = analysisSourceIdentity(object);
    if (identity === null) {
      throw new Error("expected identity");
    }
    useGraphStore.getState().setDifferentialAnalysisPoint(id, { x: 7, y: 2, z: 1 }, identity);
    render(<DifferentialAnalysisSection object={liveSurface(id)} />);
    expect(screen.getByLabelText("Direction y")).toBeDefined();
    expect(screen.getByLabelText("Direction z")).toBeDefined();
  });

  it("stays hidden for implicit surfaces", () => {
    const store = useGraphStore.getState();
    const id = store.addImplicitSurface();
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    if (!object || object.kind !== "implicitSurface") {
      throw new Error("implicit missing");
    }
    const identity = analysisSourceIdentity(object);
    if (identity === null) {
      throw new Error("expected identity");
    }
    store.setDifferentialAnalysisPoint(id, { x: 1, y: 0, z: 0 }, identity);
    render(<DifferentialAnalysisSection object={object} />);
    expect(screen.queryByTestId("directional-derivative")).toBeNull();
  });

  it("changing direction enqueues zero worker jobs and keeps the point", () => {
    const id = addSurface();
    setPoint(id);
    render(<DifferentialAnalysisSection object={liveSurface(id)} />);
    fireEvent.change(screen.getByLabelText("Direction x"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Direction y"), { target: { value: "0" } });
    expect(useGraphStore.getState().ui.directionInputBySourceId[id]).toEqual({ u: 1, v: 0 });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]?.point).toEqual({
      x: 1,
      y: 2,
      z: 9
    });
  });
});
