import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useGraphStore } from "@/store/graphStore";
import GeometryAnalysisSection from "@/components/inspector/GeometryAnalysisSection";

describe("GeometryAnalysisSection (S27 PART 22/56)", () => {
  it("pairs a point with a line and reports projection facts", () => {
    useGraphStore.getState().resetScene();
    const store = useGraphStore.getState();
    const pointId = store.addPointObject();
    store.updateGeometryCoordinate(pointId, "xExpr", "3");
    store.updateGeometryCoordinate(pointId, "yExpr", "4");
    store.updateGeometryCoordinate(pointId, "zExpr", "0");
    const lineId = store.addLineObject();
    store.updateGeometryCoordinate(lineId, "pxExpr", "0");
    store.updateGeometryCoordinate(lineId, "pyExpr", "0");
    store.updateGeometryCoordinate(lineId, "pzExpr", "0");
    store.updateGeometryCoordinate(lineId, "dxExpr", "2");
    store.updateGeometryCoordinate(lineId, "dyExpr", "0");
    store.updateGeometryCoordinate(lineId, "dzExpr", "0");
    const point = useGraphStore.getState().scene.objects.find((o) => o.id === pointId)!;
    render(<GeometryAnalysisSection object={point} />);
    expect(screen.getByLabelText("Second object for geometry analysis")).toBeInTheDocument();
    expect(screen.getByText("Select another object.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Second object for geometry analysis"), {
      target: { value: lineId }
    });
    expect(screen.getByTestId("geometry-fact-point")).toHaveTextContent("3");
    expect(screen.getByTestId("geometry-fact-distance")).toHaveTextContent("4");
    expect(screen.getByLabelText("Show construction overlay")).toBeInTheDocument();
  });

  it("filters incompatible secondaries and reports unresolved sources", () => {
    useGraphStore.getState().resetScene();
    const store = useGraphStore.getState();
    const pointId = store.addPointObject();
    const fieldId = store.addVectorFieldObject("3d");
    const lineId = store.addLineObject();
    const point = useGraphStore.getState().scene.objects.find((o) => o.id === pointId)!;
    const { unmount } = render(<GeometryAnalysisSection object={point} />);
    const options = Array.from(
      (screen.getByLabelText("Second object for geometry analysis") as HTMLSelectElement).options
    ).map((option) => option.value);
    expect(options).toContain(lineId);
    expect(options).not.toContain(fieldId);
    expect(options).not.toContain(pointId);
    unmount();
    store.updateGeometryCoordinate(pointId, "xExpr", "x");
    const bad = useGraphStore.getState().scene.objects.find((o) => o.id === pointId)!;
    render(<GeometryAnalysisSection object={bad} />);
    fireEvent.change(screen.getByLabelText("Second object for geometry analysis"), {
      target: { value: lineId }
    });
    expect(screen.getByRole("status")).toBeVisible();
  });
});
