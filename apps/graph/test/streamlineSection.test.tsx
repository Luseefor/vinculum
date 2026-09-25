import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { VectorFieldObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import StreamlineSection from "@/components/inspector/StreamlineSection";

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

describe("StreamlineSection (S24 PART 18/55)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useStreamlineResultsStore.getState().clearAll();
  });

  it("renders default-off with progressive disclosure", () => {
    const id = addField3D();
    render(<StreamlineSection object={liveField(id)} />);
    expect(screen.getByText("Streamlines")).toBeDefined();
    expect(screen.getByText("Curves tangent to the vector field.")).toBeDefined();
    expect(screen.getByLabelText("Show streamlines")).toBeDefined();
    expect(screen.queryByLabelText("Seed density")).toBeNull();
    expect(screen.queryByLabelText("Trace length")).toBeNull();
    expect(screen.queryByLabelText("Quality")).toBeNull();
  });

  it("toggling on creates a structured config and discloses controls", () => {
    const id = addField3D();
    render(<StreamlineSection object={liveField(id)} />);
    fireEvent.click(screen.getByLabelText("Show streamlines"));
    const config = useGraphStore.getState().ui.streamlineVizBySourceId[id];
    expect(config?.enabled).toBe(true);
    expect(config?.dimension).toBe("3d");
    expect(config?.structure).toContain("vectorField|");
    expect(screen.getByLabelText("Seed density")).toBeDefined();
    expect(screen.getByLabelText("Trace length")).toBeDefined();
    expect(screen.getByLabelText("Quality")).toBeDefined();
    fireEvent.click(screen.getByLabelText("Hide streamlines"));
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.enabled).toBe(false);
  });

  it("clamps seed density to the dimension bounds", () => {
    const id = addField3D();
    render(<StreamlineSection object={liveField(id)} />);
    fireEvent.click(screen.getByLabelText("Show streamlines"));
    const density = screen.getByLabelText("Seed density");
    fireEvent.change(density, { target: { value: "99" } });
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.seedDensity).toBe(5);
    fireEvent.change(density, { target: { value: "0" } });
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.seedDensity).toBe(2);
  });

  it("shows the streamline count when a result is cached", () => {
    const id = addField3D();
    render(<StreamlineSection object={liveField(id)} />);
    fireEvent.click(screen.getByLabelText("Show streamlines"));
    act(() => {
      useStreamlineResultsStore.getState().setResult(`streamline:${id}`, {
        signature: "s",
        result: {
          status: "ok",
          dimension: "3d",
          points: new Float32Array([0, 0, 0, 1, 0, 0]),
          offsets: new Uint32Array([0, 2]),
          closed: new Uint8Array([0]),
          streamlineCount: 1,
          totalPoints: 2,
          evaluationCount: 8
        }
      });
    });
    expect(screen.getByTestId("streamline-count").textContent).toMatch(/1 curve/);
  });

  it("explains invalid sources without marking the equation", () => {
    const id = addField3D();
    const store = useGraphStore.getState();
    store.updateVectorFieldExpression(id, "pExpr", "sin(factorial(x))");
    render(<StreamlineSection object={liveField(id)} />);
    expect(screen.getByText(/Fix the component expressions/)).toBeDefined();
    expect(screen.queryByLabelText("Show streamlines")).toBeNull();
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toBeDefined();
  });

  it("shows pending and error states while enabled", () => {
    const id = addField3D();
    render(<StreamlineSection object={liveField(id)} />);
    fireEvent.click(screen.getByLabelText("Show streamlines"));
    act(() => {
      useGeometryComputeStore.getState().setStatus(`streamline:${id}`, "pending");
    });
    expect(screen.getByText(/Computing streamlines/)).toBeDefined();
    act(() => {
      useGeometryComputeStore.getState().setStatus(`streamline:${id}`, "error", "Streamlines too complex.");
    });
    expect(screen.getByText(/too complex/)).toBeDefined();
    act(() => {
      useGeometryComputeStore.getState().clearStatus(`streamline:${id}`);
    });
  });

  it("reports empty results compactly", () => {
    const id = addField3D();
    render(<StreamlineSection object={liveField(id)} />);
    fireEvent.click(screen.getByLabelText("Show streamlines"));
    act(() => {
      useStreamlineResultsStore.getState().setResult(`streamline:${id}`, {
        signature: "s",
        result: { status: "empty" }
      });
    });
    expect(screen.getByText(/No streamlines here/)).toBeDefined();
  });
});
