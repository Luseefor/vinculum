import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByLabelText("Show projection")).toBeInTheDocument();
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

it("shows a surface intersection solution and clears the curve after a source edit", () => {
  useGraphStore.getState().resetScene();
  const store=useGraphStore.getState();
  const a=store.addSurfaceObject();
  store.updateSurfaceEquation(a,"x^2+y^2");
  const b=store.addPlaneObject();
  store.updatePlaneEquation(b,"z=1");
  const object=useGraphStore.getState().scene.objects.find(o => o.id===a)!;
  render(<GeometryAnalysisSection object={object} />);
  fireEvent.change(screen.getByLabelText("Second object for geometry analysis"),{target:{value:b}});
  expect(screen.getByTestId("surface-intersection-result")).toHaveTextContent("Intersection curve found");
  fireEvent.click(screen.getByLabelText("Show intersection curve"));
  expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a].showOverlay).toBe(true);
  fireEvent.click(screen.getByText("Solution",{exact:true}));
  expect(screen.getByTestId("intersection-reduced-equation")).toBeVisible();
  act(() => store.updatePlaneEquation(b,"z=-1"));
  expect(screen.getByTestId("surface-intersection-result")).toHaveTextContent("No sampled intersection");
  expect(screen.queryByLabelText("Show intersection curve")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Second object for geometry analysis"),{target:{value:""}});
  expect(screen.queryByTestId("surface-intersection-result")).not.toBeInTheDocument();
});
