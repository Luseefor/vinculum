import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ParametricCurveObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { buildIntegralJob } from "@/lib/compute/integralSync";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import IntegralAnalysisSection from "@/components/inspector/IntegralAnalysisSection";

function addCircle(): string {
  const store = useGraphStore.getState();
  const id = store.addParametricCurve();
  store.updateParametricExpression(id, "xExpr", "cos(t)");
  store.updateParametricExpression(id, "yExpr", "sin(t)");
  store.updateParametricExpression(id, "zExpr", "0");
  store.updateParametricExpression(id, "tMin", 0);
  store.updateParametricExpression(id, "tMax", 2 * Math.PI);
  return id;
}

function liveCurve(id: string): ParametricCurveObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object || object.kind !== "parametricCurve") {
    throw new Error("curve missing");
  }
  return object;
}

function addPlaneSurface(): string {
  const store = useGraphStore.getState();
  const id = store.addSurfaceObject();
  store.updateSurfaceEquation(id, "z = 0");
  store.updateSurfaceDomain(id, { xMin: -1, xMax: 1, yMin: -1, yMax: 1 });
  return id;
}

function liveSurface(id: string): SurfaceGraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object || object.kind !== "surface") {
    throw new Error("surface missing");
  }
  return object;
}

function okResult(value: number) {
  return {
    status: "ok" as const,
    value,
    coarseValue: value,
    estimatedError: 1e-9,
    convergenceWarning: false,
    evaluationCount: 100
  };
}

describe("IntegralAnalysisSection curves (S25 PART 27/53)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("auto-computes arc length with progressive disclosure", () => {
    const id = addCircle();
    render(<IntegralAnalysisSection object={liveCurve(id)} />);
    expect(screen.getByText("Integral Analysis")).toBeDefined();
    expect(screen.getByLabelText("Integral mode")).toBeDefined();
    expect(screen.getByLabelText("Integral quality")).toBeDefined();
    // Arc length needs no extra input: no integrand, no field selector,
    // no direction toggle.
    expect(screen.queryByLabelText("Scalar integrand g(x,y,z)")).toBeNull();
    expect(screen.queryByLabelText("Vector field")).toBeNull();
    expect(screen.queryByLabelText("Curve direction")).toBeNull();
  });

  it("discloses integrand input for scalar modes only", () => {
    const id = addCircle();
    render(<IntegralAnalysisSection object={liveCurve(id)} />);
    fireEvent.change(screen.getByLabelText("Integral mode"), { target: { value: "scalarLine" } });
    expect(screen.getByLabelText("Scalar integrand g(x,y,z)")).toBeDefined();
    expect(screen.getByText("Enter a scalar integrand to compute.")).toBeDefined();
    // Typing stays a local draft: no config, no job until commit.
    fireEvent.change(screen.getByLabelText("Scalar integrand g(x,y,z)"), { target: { value: "x" } });
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]?.scalarIntegrand ?? "").toBe("");
    fireEvent.keyDown(screen.getByLabelText("Scalar integrand g(x,y,z)"), { key: "Enter" });
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]?.scalarIntegrand).toBe("x");
  });

  it("discloses field selector and direction for work only", () => {
    const id = addCircle();
    render(<IntegralAnalysisSection object={liveCurve(id)} />);
    fireEvent.change(screen.getByLabelText("Integral mode"), { target: { value: "work" } });
    expect(screen.getByLabelText("Vector field")).toBeDefined();
    expect(screen.getByLabelText("Curve direction")).toBeDefined();
    expect(screen.getByText("Select a vector field to compute work.")).toBeDefined();
  });

  it("shows the computing state for a desired job without a result", () => {
    const id = addCircle();
    render(<IntegralAnalysisSection object={liveCurve(id)} />);
    act(() => {
      useGraphStore.getState().setIntegralConfig(id, { mode: "arcLength" });
      // jsdom has no Worker: the sync marks transport errors. Clear it to
      // pin the idle-desired display contract (production shows pending).
      useGeometryComputeStore.getState().clearStatus(`integral:${id}`);
    });
    expect(screen.getByText("Computing integral…")).toBeDefined();
  });

  it("renders stored ok results with value and error", () => {
    const id = addCircle();
    const { rerender } = render(<IntegralAnalysisSection object={liveCurve(id)} />);
    act(() => {
      useGraphStore.getState().setIntegralConfig(id, { mode: "arcLength" });
      // Signature match is evaluated live; force agreement by storing
      // under the exact desired signature the section computes.
      const job = buildIntegralJob(
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.integralAnalysisBySourceId[id],
        getEditorParameterScope()
      );
      if (job) {
        useIntegralResultsStore.getState().setResult(`integral:${id}`, {
          signature: job.signature,
          result: okResult(2 * Math.PI)
        });
      }
    });
    rerender(<IntegralAnalysisSection object={liveCurve(id)} />);
    expect(screen.getByTestId("integral-result-value").textContent).toContain("6.2832");
    expect(screen.getByTestId("integral-result-error").textContent).toContain("Estimated numerical error");
  });

  it("shows pending and error states", () => {
    const id = addCircle();
    render(<IntegralAnalysisSection object={liveCurve(id)} />);
    act(() => {
      useGraphStore.getState().setIntegralConfig(id, { mode: "arcLength" });
      useGeometryComputeStore.getState().setStatus(`integral:${id}`, "pending");
    });
    expect(screen.getByText("Computing integral…")).toBeDefined();
    act(() => {
      useGeometryComputeStore.getState().setStatus(`integral:${id}`, "error", "Integral too complex.");
    });
    // A stored result is absent, so the error message shows once pending clears.
    act(() => {
      useIntegralResultsStore.getState().removeForSource(id);
    });
    expect(screen.getByText(/too complex/)).toBeDefined();
    act(() => {
      useGeometryComputeStore.getState().clearStatus(`integral:${id}`);
    });
  });
});

describe("IntegralAnalysisSection surfaces (S25 PART 28)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("offers area/scalar/flux modes with orientation labels", () => {
    const id = addPlaneSurface();
    render(<IntegralAnalysisSection object={liveSurface(id)} />);
    const mode = screen.getByLabelText("Integral mode");
    expect(mode.textContent).toMatch(/Surface area/);
    expect(mode.textContent).toMatch(/Flux/);
    fireEvent.change(mode, { target: { value: "flux" } });
    expect(screen.getByLabelText("Surface orientation")).toBeDefined();
    expect(screen.getByLabelText("Surface orientation").textContent).toMatch(/\+z/);
  });

  it("labels x/y orientations with their positive axes", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.updateSurfaceEquation(id, "x = 0");
    store.updateSurfaceOrientation(id, "x");
    const object = liveSurface(id);
    render(<IntegralAnalysisSection object={object} />);
    fireEvent.change(screen.getByLabelText("Integral mode"), { target: { value: "flux" } });
    expect(screen.getByLabelText("Surface orientation").textContent).toMatch(/\+x/);
  });
});
