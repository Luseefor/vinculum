import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useGraphStore } from "@/store/graphStore";
import MatrixEntryEditor from "@/components/objects/MatrixEntryEditor";
import LinearTransformInspector from "@/components/inspector/LinearTransformInspector";

describe("MatrixEntryEditor (S28 PART 41/71)", () => {
  it("edits cells in row-major order with accessible labels", () => {
    useGraphStore.getState().resetScene();
    const id = useGraphStore.getState().addLinearTransformObject("2d");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(object?.kind).toBe("linearTransform");
    render(<MatrixEntryEditor object={object as never} />);
    expect(screen.getByLabelText("Row 1 column 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Row 2 column 2")).toBeInTheDocument();
    // DOM order is row-major: a11, a12, a21, a22.
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.map((input) => input.getAttribute("aria-label"))).toEqual([
      "Row 1 column 1",
      "Row 1 column 2",
      "Row 2 column 1",
      "Row 2 column 2"
    ]);
    fireEvent.change(screen.getByLabelText("Row 1 column 1"), { target: { value: "5" } });
    const updated = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    expect(updated?.kind === "linearTransform" && updated.m11).toBe("5");
  });

  it("rejects unsafe entries without crashing", () => {
    useGraphStore.getState().resetScene();
    const id = useGraphStore.getState().addLinearTransformObject("2d");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    render(<MatrixEntryEditor object={object as never} />);
    fireEvent.change(screen.getByLabelText("Row 1 column 1"), { target: { value: "sin(factorial(a))" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("LinearTransformInspector (S28 PART 23/24/25)", () => {
  it("shows determinant, rank, inverse, orientation for scale diag(2,3)", () => {
    useGraphStore.getState().resetScene();
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    store.updateLinearTransformEntry(id, "m11", "2");
    store.updateLinearTransformEntry(id, "m22", "3");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
    render(<LinearTransformInspector object={object as never} />);
    expect(screen.getByTestId("linear-fact-determinant")).toHaveTextContent("6");
    expect(screen.getByTestId("linear-fact-trace")).toHaveTextContent("5");
    expect(screen.getByTestId("linear-fact-rank")).toHaveTextContent("2");
    expect(screen.getByTestId("linear-fact-invertible")).toHaveTextContent("Yes");
    expect(screen.getByTestId("linear-fact-scale")).toHaveTextContent("6");
    expect(screen.getByTestId("linear-fact-orientation")).toHaveTextContent("Preserved");
    expect(screen.getByTestId("linear-fact-inverse")).toBeVisible();
  });

  it("reports singular matrices honestly and rotation eigenstate", () => {
    useGraphStore.getState().resetScene();
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    store.updateLinearTransformEntry(id, "m11", "1");
    store.updateLinearTransformEntry(id, "m12", "2");
    store.updateLinearTransformEntry(id, "m21", "2");
    store.updateLinearTransformEntry(id, "m22", "4");
    const singular = useGraphStore.getState().scene.objects.find((o) => o.id === id)!;
    const { unmount } = render(<LinearTransformInspector object={singular as never} />);
    expect(screen.getByTestId("linear-fact-rank")).toHaveTextContent("1");
    expect(screen.getByTestId("linear-fact-invertible")).toHaveTextContent("No");
    expect(screen.getByTestId("linear-fact-orientation")).toHaveTextContent("Collapsed / singular");
    unmount();
    const id2 = store.addLinearTransformObject("2d");
    store.updateLinearTransformEntry(id2, "m11", "0");
    store.updateLinearTransformEntry(id2, "m12", "-1");
    store.updateLinearTransformEntry(id2, "m21", "1");
    store.updateLinearTransformEntry(id2, "m22", "0");
    const rotation = useGraphStore.getState().scene.objects.find((o) => o.id === id2)!;
    render(<LinearTransformInspector object={rotation as never} />);
    expect(screen.getByTestId("linear-fact-eigen-none")).toHaveTextContent("No real eigendirections.");
  });

  it("applies the transform to a selected vector excluding origin", () => {
    useGraphStore.getState().resetScene();
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("3d");
    store.updateLinearTransformEntry(id, "m11", "2");
    store.updateLinearTransformEntry(id, "m22", "3");
    store.updateLinearTransformEntry(id, "m33", "4");
    const vectorId = store.addVectorObject();
    store.updateGeometryCoordinate(vectorId, "oxExpr", "10");
    store.updateGeometryCoordinate(vectorId, "oyExpr", "20");
    store.updateGeometryCoordinate(vectorId, "ozExpr", "30");
    store.updateGeometryCoordinate(vectorId, "vxExpr", "1");
    store.updateGeometryCoordinate(vectorId, "vyExpr", "2");
    store.updateGeometryCoordinate(vectorId, "vzExpr", "3");
    const object = useGraphStore.getState().scene.objects.find((o) => o.id === id)!;
    render(<LinearTransformInspector object={object as never} />);
    fireEvent.change(screen.getByLabelText("Vector for transformation analysis"), {
      target: { value: vectorId }
    });
    // diag(2,3,4)·<1,2,3> = <2,6,12>; origin (10,20,30) excluded.
    expect(screen.getByTestId("linear-fact-av")).toHaveTextContent("2");
    expect(screen.getByTestId("linear-fact-av")).toHaveTextContent("6");
    expect(screen.getByTestId("linear-fact-av")).toHaveTextContent("12");
    expect(screen.getByLabelText("Show transformed vector")).toBeInTheDocument();
    expect(screen.getByLabelText("Show eigendirections")).toBeInTheDocument();
    // Toggles commit to transient analysis state (visible, no history).
    fireEvent.click(screen.getByLabelText("Show transformed vector"));
    expect(useGraphStore.getState().ui.linearTransformAnalysisBySourceId[id]?.showVector).toBe(true);
    fireEvent.click(screen.getByLabelText("Show eigendirections"));
    expect(useGraphStore.getState().ui.linearTransformAnalysisBySourceId[id]?.showEigen).toBe(true);
  });
});
