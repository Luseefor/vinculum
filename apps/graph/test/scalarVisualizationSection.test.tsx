import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import ScalarVisualizationSection from "@/components/inspector/ScalarVisualizationSection";

function addSurface(equation = "z = x^2 + y^2"): string {
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

function liveImplicit(id: string): ImplicitSurfaceObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object || object.kind !== "implicitSurface") {
    throw new Error("implicit missing");
  }
  return object;
}

describe("ScalarVisualizationSection explicit sources (S23 PART 19/54)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("renders toggles default-off with progressive disclosure", () => {
    const id = addSurface();
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    expect(screen.getByText("Scalar Visualization")).toBeDefined();
    expect(screen.getByLabelText("Show heat map")).toBeDefined();
    expect(screen.getByLabelText("Show contours")).toBeDefined();
    expect(screen.getByLabelText("Show gradient field")).toBeDefined();
    expect(screen.queryByLabelText("Contour count")).toBeNull();
    expect(screen.queryByLabelText("Gradient density")).toBeNull();
  });

  it("toggling heat creates a structured config", () => {
    const id = addSurface();
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    fireEvent.click(screen.getByLabelText("Show heat map"));
    const config = useGraphStore.getState().ui.scalarVizBySourceId[id];
    expect(config?.showHeatmap).toBe(true);
    expect(config?.structure).toContain("scalarViz|surface");
    fireEvent.click(screen.getByLabelText("Hide heat map"));
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.showHeatmap).toBe(false);
  });

  it("discloses and clamps contour count", () => {
    const id = addSurface();
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    fireEvent.click(screen.getByLabelText("Show contours"));
    const count = screen.getByLabelText("Contour count");
    fireEvent.change(count, { target: { value: "99" } });
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.contourCount).toBe(16);
    fireEvent.change(count, { target: { value: "0" } });
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.contourCount).toBe(1);
  });

  it("shows legend text when a heat result is cached", () => {
    const id = addSurface();
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    fireEvent.click(screen.getByLabelText("Show heat map"));
    act(() => {
      useScalarVizResultsStore.getState().setResult(`scalar:${id}`, {
      signature: "s",
      result: {
        status: "ok",
        values: new Float32Array([0, 50]),
        valid: new Uint8Array([1, 1]),
        width: 2,
        height: 1,
        domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 },
        min: 0,
        max: 50,
        validCount: 2,
        totalSamples: 2,
        levels: new Float32Array([25]),
        contourSegments: new Float32Array(0),
        contourSegmentCount: 0,
        contourStatus: "empty",
        gradientPositions: new Float32Array(0),
        gradientVectors: new Float32Array(0),
        gradientMagnitudes: new Float32Array(0),
        gradientValidCount: 0,
        gradientMaxMagnitude: 0,
        gradientStatus: "skipped"
        }
      });
    });
    expect(screen.getByTestId("scalar-viz-legend").textContent).toMatch(/Range/);
    expect(screen.getByTestId("scalar-viz-legend").textContent).toMatch(/50/);
    fireEvent.click(screen.getByLabelText("Show contours"));
    act(() => {
      const entry = useScalarVizResultsStore.getState().entries[`scalar:${id}`];
      if (entry.result.status !== "ok") throw new Error("Expected a computed field.");
      useScalarVizResultsStore.getState().setResult(`scalar:${id}`, { ...entry, result: { ...entry.result, min: -50, levels: new Float32Array([0]), contourStatus: "ok", contourSegmentCount: 1 } });
    });
    expect(screen.getByTestId("scalar-viz-legend")).toHaveTextContent(/Includes the.*contour/);
    fireEvent.click(screen.getByLabelText("Hide contours"));
    expect(screen.getByTestId("scalar-viz-legend")).not.toHaveTextContent(/Includes the/);

  });

  it("isolates unavailable gradients without disabling the section", () => {
    const id = addSurface("z = tan(x) + y");
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    fireEvent.click(screen.getByLabelText("Show gradient field"));
    act(() => {
      useScalarVizResultsStore.getState().setResult(`scalar:${id}`, {
      signature: "s",
      result: {
        status: "ok",
        values: new Float32Array([1]),
        valid: new Uint8Array([1]),
        width: 1,
        height: 1,
        domain: { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
        min: 1,
        max: 1,
        validCount: 1,
        totalSamples: 1,
        levels: new Float32Array([1]),
        contourSegments: new Float32Array(0),
        contourSegmentCount: 0,
        contourStatus: "degenerate",
        gradientPositions: new Float32Array(0),
        gradientVectors: new Float32Array(0),
        gradientMagnitudes: new Float32Array(0),
        gradientValidCount: 0,
        gradientMaxMagnitude: 0,
        gradientStatus: "unavailable"
        }
      });
    });
    expect(screen.getByText(/Gradient unavailable/)).toBeDefined();
    expect(screen.getByLabelText("Show heat map")).toBeDefined();
  });

  it("explains invalid sources without marking the equation", () => {
    const id = addSurface("zzz");
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    expect(screen.getByText(/Fix the source equation/)).toBeDefined();
    expect(screen.queryByLabelText("Show heat map")).toBeNull();
  });

  it("shows pending state while the worker computes", () => {
    const id = addSurface();
    render(<ScalarVisualizationSection object={liveSurface(id)} />);
    fireEvent.click(screen.getByLabelText("Show heat map"));
    act(() => {
      useGeometryComputeStore.getState().setStatus(`scalar:${id}`, "pending");
    });
    expect(screen.getByText(/Computing scalar field/)).toBeDefined();
    act(() => {
      useGeometryComputeStore.getState().clearStatus(`scalar:${id}`);
    });
  });
});

describe("ScalarVisualizationSection implicit sources (S23)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("offers slice plane/value with domain hints", () => {
    const id = useGraphStore.getState().addImplicitSurface();
    render(<ScalarVisualizationSection object={liveImplicit(id)} />);
    fireEvent.click(screen.getByLabelText("Show scalar slice"));
    expect(screen.getByLabelText("Slice plane")).toBeDefined();
    expect(screen.getByLabelText("Slice value")).toBeDefined();
    expect(screen.getByText(/z in \[/)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Slice value"), { target: { value: "0.8" } });
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.sliceValue).toBeCloseTo(0.8, 12);
  });

  it("updates the domain hint per plane", () => {
    const id = useGraphStore.getState().addImplicitSurface();
    const { rerender } = render(<ScalarVisualizationSection object={liveImplicit(id)} />);
    fireEvent.click(screen.getByLabelText("Show scalar slice"));
    const plane = screen.getByLabelText("Slice plane") as HTMLSelectElement;
    fireEvent.change(plane, { target: { value: "yz" } });
    rerender(<ScalarVisualizationSection object={liveImplicit(id)} />);
    expect(screen.getByText(/x in \[/)).toBeDefined();
  });
});
